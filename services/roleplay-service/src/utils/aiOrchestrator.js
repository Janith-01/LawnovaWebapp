import { GoogleGenerativeAI } from '@google/generative-ai';
import { getRelevantLaw, EVIDENCE_RULES } from '../data/sriLankaLaws.js';
import {
    bestOfNSelection,
    shouldUseRewardLoop,
    generatePromptAdjustment
} from './rewardEngine.js';


const genAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

const GEMINI_MODEL = 'gemini-flash-latest'; // Fast and cheaper model

const HEARTBEAT_INTERVAL_MS = 30000; // *   - Every 30 seconds of user silence → Director picks next speaker → Actor generates dialogue


const ROLE_PROMPTS = {
    Judge: {
        name: 'Judge Dissanayake',
        icon: 'gavel',
        borderColor: 'gold',
        systemPrompt: `You are Judge Dissanayake, a senior High Court Judge in Sri Lanka.

PERSONALITY:
- Strict, formal, and authoritative
- Commands respect in the courtroom
- Impatient with incompetence
- Fair but stern

LANGUAGE:
- Use "Sustained", "Overruled", "Proceed", "Order in the court"
- Address lawyers as "Counsel" or "Mr./Ms. [Name]"
- Never use casual language
- Rulings should be concise - match the complexity of the argument
- Rulings on simple matters should be under 50 words; complex rulings can be up to 500 words.

FORBIDDEN:
- Never say "The court acknowledges that" (too passive)
- Never repeat what was just said
- Never break character`,
        mood: 'Stern'
    },

    Prosecutor: {
        name: 'Prosecutor Mr. Ratnayake',
        icon: 'briefcase',
        borderColor: 'red',
        systemPrompt: `You are Prosecutor Mr. Ratnayake, the State's Attorney in a Sri Lankan court.

PERSONALITY:
- Aggressive and sharp
- Looks for holes in every story
- Confident, sometimes condescending
- Focused on winning at all costs

LANGUAGE:
- Use "Objection, Your Honor!" when appropriate
- Use "I put it to you that..." for accusations
- Sharp, pointed questions
- Keep responses between 100 and 500 words

FORBIDDEN:
- Never say "The court acknowledges" (only Judge says that)
- Never say "Sustained" or "Overruled" (only Judge rules)
- Never be passive or agreeable`,
        mood: 'Aggressive'
    },

    DefenseAttorney: {
        name: 'Defense Attorney Ms. Fernando',
        icon: 'shield',
        borderColor: 'cyan',
        systemPrompt: `You are Defense Attorney Ms. Fernando, representing the accused in a Sri Lankan court.

PERSONALITY:
- Strategic and composed
- Protective of your client
- Skilled at finding reasonable doubt
- Eloquent under pressure

LANGUAGE:
- Use "I object, Your Honor!" when prosecution overreaches
- Use "My client maintains that..." 
- Calm, measured responses
- Keep responses between 100 and 500 words

FORBIDDEN:
- Never say "The court acknowledges" or "Sustained/Overruled"
- Never admit guilt without client instruction`,
        mood: 'Strategic'
    },

    Witness: {
        name: 'Witness',
        icon: 'user',
        borderColor: 'blue',
        systemPrompt: `You are a witness testifying in a Sri Lankan court case.

PERSONALITY OPTIONS (choose based on context):
- NERVOUS: Hesitant, uses "um", "I think", fidgets
- HOSTILE: Defensive, evasive, short answers
- COOPERATIVE: Helpful, detailed, wants truth known
- CONFIDENT: Professional, clear, factual

LANGUAGE:
- Use natural speech patterns
- Can say "I don't remember" if appropriate
- Emotional reactions are allowed
- Keep responses between 100 and 500 words

FORBIDDEN:
- Never use legal jargon (you're not a lawyer)
- Never speak for the court`,
        mood: 'Emotional'
    },

    Clerk: {
        name: 'Court Clerk',
        icon: 'clipboard',
        borderColor: 'gray',
        systemPrompt: `You are the Court Clerk in a Sri Lankan High Court.

PERSONALITY:
- Neutral and robotic
- Purely procedural
- No emotional involvement

LANGUAGE:
- "All rise for the Honorable Judge Dissanayake"
- "Please state your full name and occupation for the record"
- "Do you swear to tell the truth, the whole truth, and nothing but the truth?"
- Maximum 3 sentences

FORBIDDEN:
- Never give opinions
- Never participate in arguments`,
        mood: 'Neutral'
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseStrictJSON(responseText) {
    try {
        let cleaned = responseText.trim();
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('JSON Parse Error:', responseText?.substring(0, 200));
        return null;
    }
}

function buildHistoryContext(history, userRole = 'Defense', limit = 10) {
    if (!history || history.length === 0) return '=== START OF TRIAL ===';

    // Take last N messages for context
    const recentHistory = history.slice(-limit);

    return recentHistory.map(entry => {
        if (entry.role === 'user') {
            return `[${userRole} Counsel]: "${entry.content}"`;
        }
        const speaker = entry.speaker || 'Court';
        const role = entry.speakerRole || 'Unknown';
        return `[${speaker} (${role})]: "${entry.content}"`;
    }).join('\n');
}

function getLastSpeaker(history) {
    const modelMessages = history?.filter(h => h.role === 'model') || [];
    return modelMessages[modelMessages.length - 1] || null;
}

function isExplicitObjectionMessage(text = '') {
    const normalized = text.trim().toLowerCase();
    return /^(objection\b|objection,\s*your honou?r\b|i object\b)/i.test(normalized);
}

function containsJudgeRulingMarkers(text = '') {
    return /\b(sustained|overruled)\b/i.test(text);
}

// ============================================================
// THE DIRECTOR (Router with Logic)
// Temperature: 0.2 (Low - for logical decisions)
// ============================================================

export async function directCourtroomScene(history, caseDetails, userMessage, runtimeState = {}) {
    // Default fallback - always have a valid response ready
    const DEFAULT_RESPONSE = {
        nextSpeakerRole: 'Judge',
        speakerName: 'Judge Dissanayake',
        instruction: 'Address the counsel and move the trial forward.'
    };

    if (!genAI) {
        console.error('❌ Gemini API key not configured');
        return DEFAULT_RESPONSE;
    }

    try {
        const userRole = caseDetails?.userRole || 'Defense';
        const opponentRole = userRole === 'Defense' ? 'Prosecutor' : 'DefenseAttorney';
        const opponentName = ROLE_PROMPTS[opponentRole]?.name || 'Opposing Counsel';
        const witnesses = caseDetails?.witnesses || [];
        const historyText = buildHistoryContext(history, userRole, 5);
        const lastSpeaker = getLastSpeaker(history);
        const lowerMessage = userMessage?.toLowerCase() || '';
        const pendingObjection = !!runtimeState.pendingObjection;

        // ========== VALIDATION: Never return user's role ==========
        const validRoles = ['Judge', 'Prosecutor', 'DefenseAttorney', 'Witness', 'Clerk'];
        const forbiddenRole = userRole === 'Defense' ? 'DefenseAttorney' : 'Prosecutor';

        // ========== HARD RULES (No AI needed) ==========

        // Rule 1: User objects → Judge MUST rule
        if (pendingObjection || isExplicitObjectionMessage(userMessage)) {
            console.log('[OBJECTION_GATE] DIRECTOR: Objection cycle active -> Forcing Judge ruling');
            return {
                nextSpeakerRole: 'Judge',
                speakerName: 'Judge Dissanayake',
                instruction: 'Rule on this objection. Say "Sustained" or "Overruled" with brief reasoning.'
            };
        }

        // Rule 2: User calls a witness → Clerk swears them in
        const calledWitness = witnesses.find(w =>
            lowerMessage.includes('call') &&
            (lowerMessage.includes(w.name?.toLowerCase().split(' ')[0]) || lowerMessage.includes('witness'))
        );

        // EVIDENCE PHASE CHECK: If we are in Evidence/Examination stage, prioritize Witness
        const caseStage = caseDetails?.caseStage || '';
        const isEvidentiaryPhase = caseStage.includes('Evidence') || caseStage.includes('Examination') || caseStage.includes('Testimony');

        if (calledWitness || (lowerMessage.includes('call') && lowerMessage.includes('stand'))) {
            console.log('📋 DIRECTOR: Witness call detected → Clerk to swear in');
            const witnessName = calledWitness?.name || witnesses[0]?.name || 'the witness';
            return {
                nextSpeakerRole: 'Clerk',
                speakerName: 'Court Clerk',
                instruction: `Formally call ${witnessName} to the stand and ask them to state their name for the record.`
            };
        }

        // Rule 2.5: Swearing-in procedure → Witness MUST respond
        if (lastSpeaker?.speakerRole === 'Clerk' &&
            (lastSpeaker.content.toLowerCase().includes('do you swear') ||
                lastSpeaker.content.toLowerCase().includes('state your name'))) {
            console.log('📋 DIRECTOR: Swearing-in handover detected → Forcing Witness');
            const witnessName = witnesses[0]?.name || 'Witness';
            return {
                nextSpeakerRole: 'Witness',
                speakerName: witnessName,
                instruction: 'Accept the oath and state your full name and occupation as per the record.'
            };
        }

        // Is this an autonomous background turn?
        const isAutonomous = lowerMessage.includes('[autonomous mode');

        // Rule 3: Prevent Judge from speaking twice in a row (but allow AI to decide in autonomous mode)
        if (lastSpeaker?.speakerRole === 'Judge' && !isAutonomous) {
            console.log('📋 DIRECTOR: Judge just spoke (User mode) → Forcing opponent or witness');
            if (lowerMessage.includes('?')) {
                const witnessName = witnesses[0]?.name || 'Witness';
                return {
                    nextSpeakerRole: 'Witness',
                    speakerName: witnessName,
                    instruction: 'Answer the Judge\'s question based on your character profile.'
                };
            } else {
                return {
                    nextSpeakerRole: opponentRole,
                    speakerName: opponentName,
                    instruction: 'Respond to the Judge\'s direction or continue your examination.'
                };
            }
        }

        // Rule 4: If user addresses "Your Honor" → Judge responds (skip if autonomous)
        if (!isAutonomous && (lowerMessage.includes('your honor') || lowerMessage.includes('your honour'))) {
            return {
                nextSpeakerRole: 'Judge',
                speakerName: 'Judge Dissanayake',
                instruction: 'Respond to counsel\'s address. Give direction or make a ruling.'
            };
        }

        // ========== AI DIRECTOR (Complex Decisions) ==========

        const DIRECTOR_PROMPT = `You are the COURTROOM DIRECTOR for a Sri Lankan trial simulation.
Your job is to decide WHO should speak next based on realistic court procedure.

CRITICAL RULE: The user is playing "${userRole}" counsel. You must NEVER select "${forbiddenRole}" as the next speaker because that is the user's role!

AVAILABLE SPEAKERS (choose one):
1. "Judge" (Judge Dissanayake) - Rules on procedure, sustains/overrules objections
2. "${opponentRole}" (${opponentName}) - Opposes the user's arguments
3. "Witness" (${witnesses[0]?.name || 'Current witness'}) - Answers questions
4. "Clerk" (Court Clerk) - Procedural announcements only

CURRENT STATE:
- User Role: ${userRole} Counsel
- Last Speaker: ${lastSpeaker?.speakerRole || 'None'}
- Witnesses Available: ${witnesses.map(w => w.name).join(', ') || 'None'}

DECISION RULES:
- If the previous speaker was the Clerk swearing in a witness → "Witness" MUST answer.
- If the previous speaker asked a question → "Witness" or "${opponentRole}" answers.
- EVIDENCE PHASE (Day 1 & 2): Currently in "${caseDetails?.caseStage || 'General'}" phase. If a witness is present, prioritize "Witness" for testimony or "${opponentRole}" for cross-examination.
- CLOSING PHASE (Day 3): Focus on "${opponentRole}" making final arguments or "Judge" preparing the verdict.
- STALLING PREVENTION: If the courtroom is silent ([AUTONOMOUS MODE]), and there is no obvious next step, select "Judge" to prompt the next logical speaker or give a ruling to keep the session alive.
- ALTERNATE SPEAKERS: In [AUTONOMOUS MODE], if the last speaker was "${opponentRole}", prioritize "Judge" or "Witness" to avoid counsel monologues. If the last speaker was "Witness", the next should be the examining counsel ("${opponentRole}" or User - but you can only pick AI).
- IMPORTANT: Under [AUTONOMOUS MODE], the Witness SHOULD speak if they were just asked a question or if they need to continue their testimony. Do not just loop between Judge and Counsel.
- Default to "Judge" if the trial is at a standstill, or "${opponentRole}" (Opposing Counsel) if you need a challenge.

USER/SYSTEM LATEST ACTION: "${userMessage}"

OUTPUT: Return ONLY valid JSON (no explanation):
{"nextSpeakerRole": "Judge|${opponentRole}|Witness|Clerk", "speakerName": "Full Name", "instruction": "What this person should do"}`;

        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
        }, { apiVersion: 'v1beta' });

        const result = await model.generateContent(DIRECTOR_PROMPT + `\n\nRECENT HISTORY:\n${historyText}`);
        const direction = parseStrictJSON(result.response.text());

        // Validate the response
        if (direction) {
            // Handle both 'nextSpeaker' and 'nextSpeakerRole' from AI
            const role = direction.nextSpeakerRole || direction.nextSpeaker;

            if (role && validRoles.includes(role) && role !== forbiddenRole) {
                console.log(`📋 DIRECTOR: AI decided → ${role} (${direction.speakerName || 'Unknown'})`);
                return {
                    nextSpeakerRole: role,
                    speakerName: direction.speakerName || ROLE_PROMPTS[role]?.name || 'Court',
                    instruction: direction.instruction || 'Respond to the situation.'
                };
            }
        }

        // Fallback: Opponent responds
        console.log('📋 DIRECTOR: Using fallback → Opponent');
        return {
            nextSpeakerRole: opponentRole,
            speakerName: opponentName,
            instruction: 'Respond to the opposing counsel.'
        };

    } catch (error) {
        console.error('❌ Director Error:', error.message);
        return DEFAULT_RESPONSE;
    }
}

// ============================================================
// THE ACTOR (Dialogue Generator with Personality)
// Temperature: 0.7 (High - for creativity)
// ============================================================

export async function generateActorDialogue(
    speakerRole,
    speakerName,
    caseDetails,
    userMessage,
    legalContext,
    history,
    instruction = '',
    promptAdjustment = '',
    runtimeState = {}
) {
    // Safety defaults - ALWAYS ensure we have valid role and name
    const safeRole = speakerRole || 'Judge';
    const safeName = speakerName || ROLE_PROMPTS[safeRole]?.name || 'Judge Dissanayake';

    console.log(`🎭 ACTOR: Generating dialogue for ${safeRole} (${safeName})`);

    if (!genAI) {
        console.error('❌ Gemini API key not configured');
        return getFallbackResponse(safeRole, safeName);
    }

    const userRole = caseDetails?.userRole || 'Defense';
    const pendingObjection = !!runtimeState.pendingObjection;
    const historyText = buildHistoryContext(history, userRole, 5);

    // Get role configuration
    const roleConfig = ROLE_PROMPTS[safeRole] || ROLE_PROMPTS['Judge'];

    // For witnesses, customize the name and personality
    let finalName = safeName;
    let personalityNote = '';

    if (safeRole === 'Witness') {
        // Try exact match first, then partial match
        let witnessData = caseDetails?.witnesses?.find(w => w.name === safeName);
        if (!witnessData && safeName) {
            witnessData = caseDetails?.witnesses?.find(w =>
                safeName.toLowerCase().includes(w.name.toLowerCase()) ||
                w.name.toLowerCase().includes(safeName.toLowerCase())
            );
        }

        if (witnessData) {
            personalityNote = `
YOUR PROFILE:
- Name: ${witnessData.name}
- Personality: ${witnessData.personality || 'Cooperative'}
- Role/Occupation: ${witnessData.role || 'Witness'}
- Affiliation: ${witnessData.affiliation || 'Neutral'}
- Testimony Focus: You must testify consistently with your role as ${witnessData.role}.
`;
        }

        // Include knowledge of ALL witnesses for context
        const allWitnesses = caseDetails?.witnesses?.map(w => `- ${w.name} (${w.role})`).join('\n') || 'None';
        personalityNote += `\nOTHER WITNESSES IN CASE:\n${allWitnesses}`;
    }

    // ============ CONTEXT INJECTION: SRI LANKAN LAWS ============
    const activeLaw = getRelevantLaw(caseDetails);
    console.log(`📜 Injecting law context for case: ${caseDetails?.title || 'Unknown'}`);

    // Build case facts summary for context
    const caseFacts = caseDetails?.facts?.join('\n- ') || 'No specific facts available';
    const caseEvidence = caseDetails?.userEvidence?.join('\n- ') || 'No evidence specified';

    // Role-specific instructions
    let roleInstructions = '';
    if (safeRole === 'Judge') {
        roleInstructions = `
🔨 JUDGE INSTRUCTIONS:
- NEVER just say "Sustained" or "Overruled" without explanation
- ALWAYS explain your reasoning by citing the specific law section
- Reference the Evidence Ordinance when ruling on admissibility
- Maintain strict courtroom decorum - reprimand counsel if needed
- Example: "Sustained. Under Section 60 of the Evidence Ordinance, hearsay is inadmissible. The witness cannot testify to what they heard from others."`;
    } else if (safeRole === 'Prosecutor' || safeRole === 'DefenseAttorney') {
        roleInstructions = `
⚔️ COUNSEL INSTRUCTIONS:
- Use the IRAC method implicitly: Issue → Rule → Application → Conclusion
- ATTACK the specific facts and inconsistencies in the opposing argument
- CITE the Penal Code sections or Evidence Ordinance to support your argument
- Point out logical fallacies, lack of evidence, or procedural errors
- Be AGGRESSIVE and STRATEGIC - this is an adversarial proceeding
- Example: "Your Honor, the prosecution's claim fails on two counts. First, under Section 366 of the Penal Code, dishonest intention must be proven. The evidence shows my client had permission..."`;
    } else if (safeRole === 'Witness') {
        roleInstructions = `
👤 WITNESS INSTRUCTIONS:
- Provide DETAILED, DESCRIPTIVE accounts - not one-word answers
- Describe what you SAW, HEARD, and FELT with specifics (times, places, people)
- Show emotion appropriate to your personality (${personalityNote || 'Neutral'})
- You can say "I don't remember" or "I'm not sure" if appropriate
- Example: "I clearly remember that night, around 9 PM. I was closing up the shop when I saw the defendant at the gate. He seemed agitated, pacing back and forth..."`;
    } else {
        roleInstructions = `
📋 CLERK INSTRUCTIONS:
- Keep responses brief and procedural
- Announce witnesses, call for order, administer oaths`;
    }

    const ACTOR_PROMPT = `🔴 SYSTEM OVERRIDE: ADVANCED LEGAL SIMULATION MODE 🔴

You are playing the role of: **${finalName}** (${safeRole})
${roleConfig.systemPrompt}${personalityNote}

--- 📋 CASE SUMMARY ---
Case: ${caseDetails?.title || 'Ongoing Trial'}
Relevant Law: ${caseDetails?.relevantLaw || 'Penal Code of Sri Lanka'}
Key Facts:
- ${caseFacts}

--- ⚖️ APPLICABLE LAW (SRI LANKA) ---
${activeLaw}

${EVIDENCE_RULES}

--- 🧠 RECENT CONTEXT ---
The User (${caseDetails?.userRole || 'Defense'} Counsel) just argued:
"${userMessage || 'No message provided'}"

RECENT COURT HISTORY:
${historyText}

${legalContext ? `\n--- 📚 ADDITIONAL LEGAL REFERENCE ---\n${legalContext.substring(0, 800)}` : ''}

--- 🎭 YOUR ROLE-SPECIFIC INSTRUCTIONS ---
${roleInstructions}

--- ⚡ RESPONSE REQUIREMENTS ---
1. **BE PROPORTIONAL:** If the user's message is a short greeting or simple phrase (< 10 words), keep your response brief (under 50 words). 
2. **BE SUBSTANTIVE:** If the user makes a complex legal point (> 10 words), generate a substantive response between 100 and 500 words.
3. **CITE SPECIFICS:** Reference case facts, dates, amounts, or witness names when making complex points.
${promptAdjustment ? `\n${promptAdjustment}\n` : ''}
3. **USE LEGAL LANGUAGE:** Cite law sections when relevant
4. **STAY IN CHARACTER:** Maintain ${finalName}'s personality throughout
5. **ADVANCE THE PLOT:** Your response should move the trial forward

DIRECTOR'S INSTRUCTION: ${instruction || 'Respond naturally to advance the proceedings.'}
${safeRole === 'Judge' && !pendingObjection ? 'ADDITIONAL CONSTRAINT: No objection is pending. Do NOT issue objection rulings and do NOT use the words "Sustained" or "Overruled". Continue procedurally.' : ''}
NOW RESPOND AS ${finalName}:`;

    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
        }, { apiVersion: 'v1beta' });

        const result = await model.generateContent(ACTOR_PROMPT);
        const dialogue = result.response.text().trim();

        // Clean up any unwanted prefixes the AI might add
        let cleanDialogue = dialogue
            .replace(/^(Judge Dissanayake:|Prosecutor:|Defense:|Witness:|Clerk:)\s*/i, '')
            .replace(/^\[.*?\]:\s*/, '')
            .replace(/^"/, '')
            .replace(/"$/, '');

        const hasRuling = containsJudgeRulingMarkers(cleanDialogue);
        const rulingAllowed = safeRole === 'Judge' ? pendingObjection : true;

        // Hard gate: block judge rulings when no objection is pending.
        if (safeRole === 'Judge' && hasRuling && !pendingObjection) {
            console.warn('[OBJECTION_GATE] Judge ruling blocked without pending objection. Triggering constrained regeneration.');

            const constrainedPrompt = `${ACTOR_PROMPT}

SAFETY RETRY CONSTRAINT:
- You must not rule on objections in this turn.
- Do not use the words "Sustained" or "Overruled".
- Continue the hearing procedurally (e.g., invite opening, call witness, ask question).`;

            const retryResult = await model.generateContent(constrainedPrompt);
            const retryDialogue = (retryResult.response.text() || '').trim();
            const retryClean = retryDialogue
                .replace(/^(Judge Dissanayake:|Prosecutor:|Defense:|Witness:|Clerk:)\s*/i, '')
                .replace(/^\[.*?\]:\s*/, '')
                .replace(/^"/, '')
                .replace(/"$/, '');

            if (!containsJudgeRulingMarkers(retryClean) && retryClean.length >= 5) {
                console.log('[OBJECTION_GATE] Constrained regeneration succeeded.');
                cleanDialogue = retryClean;
            } else {
                console.warn('[OBJECTION_GATE] Constrained regeneration still invalid. Applying neutral fallback.');
                cleanDialogue = 'Counsel, proceed with the next relevant submission. The court will continue with this phase.';
            }
        }

        // CRITICAL: Ensure we never return empty text
        if (!cleanDialogue || cleanDialogue.length < 5) {
            console.warn('⚠️ Actor returned empty/short response, using fallback');
            return getFallbackResponse(safeRole, finalName);
        }

        console.log(`[OBJECTION_GATE] turn speaker=${safeRole} pendingObjection=${pendingObjection} rulingAllowed=${rulingAllowed} rulingDetected=${containsJudgeRulingMarkers(cleanDialogue)}`);
        console.log(`✅ ACTOR (${safeRole}): ${finalName} responded`);

        return {
            speaker: finalName,
            speakerRole: safeRole,
            text: cleanDialogue,
            mood: roleConfig.mood,
            icon: roleConfig.icon,
            borderColor: roleConfig.borderColor
        };

    } catch (error) {
        console.error(`❌ Actor Error (${safeRole}):`, error.message);
        return getFallbackResponse(safeRole, finalName);
    }
}

// ============================================================
// REWARD-MODEL GUIDED ACTOR (Best-of-N with Audit Scoring)
// ============================================================

/**
 * Generate Actor dialogue with Reinforcement Learning reward loop.
 * For RL-eligible roles (Prosecutor, DefenseAttorney), generates N=3
 * candidates, scores them via the Dual-Model Audit Engine (Port 5009),
 * and selects the response with the highest Substantive Density Score.
 * 
 * For non-eligible roles (Judge, Witness, Clerk), falls through to
 * the standard single-generation path.
 * 
 * @param {string} speakerRole
 * @param {string} speakerName
 * @param {Object} caseDetails
 * @param {string} userMessage
 * @param {string} legalContext
 * @param {Array} history
 * @param {string} instruction
 * @param {string} sessionId - Required for reward logging
 * @param {number} turnNumber - Current turn number for logging
 * @returns {Promise<{response: Object, rewardEntry: Object|null}>}
 */
export async function generateActorDialogueWithRL(
    speakerRole, speakerName, caseDetails, userMessage,
    legalContext, history, instruction, sessionId, turnNumber, runtimeState = {}
) {
    // Non-RL path: Judge, Witness, Clerk → single generation (no reward loop)
    if (!shouldUseRewardLoop(speakerRole)) {
        const response = await generateActorDialogue(
            speakerRole, speakerName, caseDetails, userMessage,
            legalContext, history, instruction, '', runtimeState
        );
        return { response, rewardEntry: null };
    }

    console.log(`\n🧠 [RL ACTOR] Activating Reward-Model Guided Generation for ${speakerRole}`);

    // Get dynamic prompt adjustment from recent reward feedback
    const promptAdjustment = generatePromptAdjustment(sessionId, speakerRole);
    if (promptAdjustment) {
        console.log(`[RL ACTOR] Injecting performance feedback into prompt`);
    }

    // Define the generation function (called N times by bestOfNSelection)
    const generateFn = () => generateActorDialogue(
        speakerRole, speakerName, caseDetails, userMessage,
        legalContext, history, instruction, promptAdjustment, runtimeState
    );

    // Run Best-of-N selection
    const result = await bestOfNSelection(generateFn, sessionId, speakerRole, turnNumber);

    if (!result) {
        // All candidates failed — fall back to standard single generation
        console.warn('[RL ACTOR] Best-of-N failed, falling back to standard generation');
        const fallback = await generateActorDialogue(
            speakerRole, speakerName, caseDetails, userMessage,
            legalContext, history, instruction, '', runtimeState
        );
        return { response: fallback, rewardEntry: null };
    }

    return {
        response: result.selected,
        rewardEntry: result.rewardEntry
    };
}

// ============================================================
// FALLBACK RESPONSES (Role-Appropriate)
// ============================================================

function getFallbackResponse(speakerRole, speakerName) {
    const fallbacks = {
        Judge: {
            text: "Counsel, I need you to rephrase that. The court requires clarity.",
            mood: 'Stern',
            icon: 'gavel',
            borderColor: 'gold'
        },
        Prosecutor: {
            text: "I challenge that assertion, Your Honor. The evidence does not support this claim.",
            mood: 'Aggressive',
            icon: 'briefcase',
            borderColor: 'red'
        },
        DefenseAttorney: {
            text: "Your Honor, I object to this line of questioning as irrelevant.",
            mood: 'Strategic',
            icon: 'shield',
            borderColor: 'cyan'
        },
        Witness: {
            text: "I... I'm not sure I understand. Could you repeat the question?",
            mood: 'Nervous',
            icon: 'user',
            borderColor: 'blue'
        },
        Clerk: {
            text: "Order in the court. Please proceed.",
            mood: 'Neutral',
            icon: 'clipboard',
            borderColor: 'gray'
        }
    };

    const fallback = fallbacks[speakerRole] || fallbacks['Judge'];
    const config = ROLE_PROMPTS[speakerRole] || ROLE_PROMPTS['Judge'];

    return {
        speaker: speakerName || config.name,
        speakerRole: speakerRole,
        text: fallback.text,
        mood: fallback.mood,
        icon: fallback.icon,
        borderColor: fallback.borderColor
    };
}

// ============================================================
// VERDICT GENERATION
// ============================================================
export async function generateVerdict(history, caseDetails) {
    // Build comprehensive context from all 3 days of dialogue
    const fullHistoryText = buildHistoryContext(history, caseDetails?.userRole || 'Defense', 50); // Increased to capture all 3 days
    const activeLaw = getRelevantLaw(caseDetails);

    // Extract case facts and evidence
    const caseFacts = caseDetails?.facts?.join('\n• ') || 'No facts specified';
    const userEvidence = caseDetails?.userEvidence?.join('\n• ') || 'No evidence presented';
    const opponentEvidence = caseDetails?.opponentEvidence?.join('\n• ') || 'No opposing evidence';

    // Default fallback verdict
    const fallbackVerdict = {
        outcome: 'Not Guilty',
        confidence_score: 50,
        reasoning: 'The court was unable to reach a definitive conclusion based on the evidence presented.',
        citation: 'General principles of criminal law',
        sentence: 'None',
        judge_statement: 'After careful consideration, this court finds insufficient evidence to convict.',
        formal_judgment: generateFallbackJudgment(caseDetails)
    };

    if (!genAI) {
        console.error('❌ Gemini API key not configured for verdict');
        return fallbackVerdict;
    }

    const FORMAL_JUDGMENT_PROMPT = `You are Judge Dissanayake, High Court Judge of Sri Lanka.
The trial has concluded after 3 days of proceedings. You must now deliver your FINAL JUDGMENT.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CASE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Case Title: ${caseDetails?.title || 'The State v. Unknown'}
Case Type: ${caseDetails?.topic || 'Criminal Matter'}
User Role: ${caseDetails?.userRole || 'Defense'} Counsel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 APPLICABLE LEGAL FRAMEWORK (SRI LANKA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${activeLaw}

${EVIDENCE_RULES}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️ CASE FACTS (UNDISPUTED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ${caseFacts}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 EVIDENCE PRESENTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Defense Evidence:
• ${userEvidence}

Prosecution Evidence:
• ${opponentEvidence}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 COMPLETE TRIAL TRANSCRIPT (3 DAYS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${fullHistoryText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR TASK AS HIGH COURT JUDGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analyze the ENTIRE trial transcript (all 3 days of dialogue) and deliver a formal Final Judgment.

**Analysis Framework:**
1. Did the Prosecution prove their case "Beyond Reasonable Doubt"?
2. Did the Defense successfully create reasonable doubt?
3. Were proper legal procedures followed?
4. What evidence is admissible under the Evidence Ordinance?
5. What are the applicable law sections from the Penal Code?

**CRITICAL REQUIREMENTS:**
- Base your judgment ONLY on arguments ACTUALLY MADE during the trial
- Cross-reference with the Sri Lankan Penal Code sections provided above
- Cite specific evidence and testimony from the transcript
- Apply the correct standard of proof (criminal cases = beyond reasonable doubt)

**OUTPUT FORMAT: Return ONLY valid JSON:**
{
    "outcome": "Guilty" | "Not Guilty" | "Case Dismissed",
    "confidence_score": 0-100,
    "reasoning": "Brief summary of why you reached this verdict (2-3 sentences)",
    "citation": "Primary law section applied (e.g., 'Section 366 of the Penal Code')",
    "sentence": "Sentence if guilty (e.g., '2 Years Rigorous Imprisonment') or 'None'",
    "judge_statement": "Your closing statement (1-2 sentences)",
    "formal_judgment": "A formal 300-word judgment structured as:
        I. FACTS OF THE CASE (Summary of undisputed facts and timeline)
        II. LEGAL ISSUES (Questions of law to be determined)
        III. COURT'S REASONING (Analysis of evidence, application of law, evaluation of arguments)
        IV. FINAL ORDER (The verdict, sentence if applicable, and any directives)"
}

**TONE:** Formal, authoritative, judicial. Use Sri Lankan legal terminology.
**LENGTH:** The formal_judgment should be approximately 300 words total.`;

    try {
        console.log('⚖️ Generating formal Final Judgment based on 3 days of trial...');

        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
        }, { apiVersion: 'v1beta' });

        const result = await model.generateContent(FORMAL_JUDGMENT_PROMPT);
        const responseText = result.response.text().trim();

        // Parse the JSON response
        const verdictData = parseStrictJSON(responseText);

        if (verdictData && verdictData.outcome) {
            console.log(`✅ Formal Judgment generated: ${verdictData.outcome} (${verdictData.confidence_score}% confidence)`);

            // Ensure all required fields exist
            return {
                outcome: verdictData.outcome || 'Not Guilty',
                confidence_score: verdictData.confidence_score || 50,
                reasoning: verdictData.reasoning || 'Based on the evidence presented.',
                citation: verdictData.citation || 'General legal principles',
                sentence: verdictData.sentence || 'None',
                judge_statement: verdictData.judge_statement || 'The court has reached its decision.',
                formal_judgment: verdictData.formal_judgment || generateFallbackJudgment(caseDetails)
            };
        }

        console.warn('⚠️ Failed to parse verdict JSON, using fallback');
        return fallbackVerdict;

    } catch (error) {
        console.error('❌ Verdict Generation Error:', error.message);
        return fallbackVerdict;
    }
}

// Helper function to generate fallback judgment
function generateFallbackJudgment(caseDetails) {
    return `
I. FACTS OF THE CASE
This matter concerns ${caseDetails?.title || 'an unspecified legal dispute'}. The court has reviewed all evidence and testimony presented over the course of three days of proceedings.

II. LEGAL ISSUES
The central question before this court is whether the prosecution has proven the elements of the alleged offense beyond reasonable doubt.

III. COURT'S REASONING
After careful consideration of all evidence and arguments, the court finds that insufficient evidence was presented to meet the required burden of proof.

IV. FINAL ORDER
The accused is found NOT GUILTY. This matter is hereby dismissed.

Judgment entered this day.
Judge Dissanayake
High Court of Sri Lanka
    `.trim();
}

// ============================================================
// CASE SCENARIO GENERATION
// ============================================================

export async function generateCaseScenario(difficulty, topic, userRole) {
    if (!genAI) {
        throw new Error('Gemini API key not configured');
    }

    const prompt = `Generate a Sri Lankan legal case scenario for a courtroom simulation.

PARAMETERS:
- Difficulty: ${difficulty}
- Topic: ${topic === 'Random' ? 'Any civil or criminal matter' : topic}
- User plays: ${userRole} Counsel

OUTPUT FORMAT (strict JSON):
{
    "title": "Case Name v. Party (e.g., 'State v. Silva')",
    "summary": "2-3 sentence case overview",
    "difficulty": "${difficulty}",
    "caseStage": "Opening Statements",
    "relevantLaw": "Applicable Sri Lankan statute or common law principle",
    "facts": ["Fact 1", "Fact 2", "Fact 3"],
    "userEvidence": ["Evidence item 1", "Evidence item 2"],
    "opponentEvidence": ["Counter-evidence 1", "Counter-evidence 2"],
    "witnesses": [
        {"name": "Full Name", "role": "Job/Relation", "personality": "Nervous/Confident/Hostile", "affiliation": "User/Opponent/Neutral"},
        {"name": "Full Name 2", "role": "Job/Relation", "personality": "Type", "affiliation": "User/Opponent/Neutral"}
    ],
    "openingHint": "Strategic advice for the ${userRole}",
    "userRole": "${userRole}"
}`;

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
    }, { apiVersion: 'v1beta' });

    try {
        const result = await model.generateContent(prompt);
        const caseDetails = parseStrictJSON(result.response.text());

        if (!caseDetails || !caseDetails.title) {
            throw new Error('Invalid case generation response');
        }

        console.log(`✅ Case generated: ${caseDetails.title}`);
        return caseDetails;

    } catch (error) {
        console.error('Case Generation Error:', error.message);
        throw error;
    }
}

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================
// PHASE 1: DIRECTOR AGENT ARCHITECTURE
// ============================================================

/**
 * Helper: Clean and parse JSON from Gemini response
 * Handles markdown code blocks and extracts valid JSON
 */
function parseGeminiJSON(responseText) {
    let cleaned = responseText.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Try to extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }

    return JSON.parse(cleaned);
}

/**
 * Helper: Create a Gemini model with system instruction
 */
function createModel(systemPrompt) {
    return genAI.getGenerativeModel(
        {
            model: 'gemini-2.5-flash-lite',
            systemInstruction: { parts: [{ text: systemPrompt }] }
        },
        { apiVersion: 'v1' }
    );
}

/**
 * Build formatted history context for AI prompts
 */
function buildHistoryContext(history, userRole = 'Defense') {
    if (!history || history.length === 0) {
        return '=== START OF SESSION ===\nNo previous exchanges.';
    }

    const lines = history.map((entry) => {
        if (entry.role === 'user') {
            return `[${userRole} Counsel]: "${entry.content}"`;
        } else {
            const speaker = entry.speaker || 'Court';
            const action = entry.action ? ` (${entry.action})` : '';
            return `[${speaker}]${action}: "${entry.content}"`;
        }
    });

    return `=== CONVERSATION HISTORY ===\n${lines.join('\n')}\n=== END OF HISTORY ===`;
}

// ============================================================
// STEP A: THE DIRECTOR (ROUTER)
// Decides WHO should speak next based on courtroom logic
// ============================================================

/**
 * Director Agent - Routes to the appropriate courtroom persona
 * @param {Array} history - Conversation history
 * @param {Object} caseDetails - The case dossier
 * @param {string} userMessage - The user's latest message
 * @returns {Promise<Object>} - { nextSpeaker, speakerName, speakerRole, reason }
 */
async function directCourtroomScene(history, caseDetails, userMessage) {
    try {
        const userRole = caseDetails?.userRole || 'Defense';
        const opponentRole = userRole === 'Defense' ? 'Prosecution' : 'Defense';
        const opponentName = opponentRole === 'Prosecution'
            ? 'Prosecutor Mr. Ratnayake'
            : 'Defense Attorney Ms. Fernando';

        // Build witness list for context
        const witnessNames = (caseDetails?.witnesses || [])
            .map(w => `"${w.name}" (${w.role}, ${w.affiliation === 'User' ? 'Your witness' : w.affiliation === 'Opponent' ? 'Their witness' : 'Neutral'})`)
            .join(', ');

        const DIRECTOR_PROMPT = `You are the DIRECTOR of a Sri Lankan courtroom simulation.
Your ONLY job is to decide WHO should respond next based on courtroom logic and the user's input.

=== AVAILABLE PERSONAS ===
1. "Judge Dissanayake" (Role: Judge) - Presiding High Court Judge
2. "${opponentName}" (Role: Opponent) - Opposing counsel  
3. Witnesses: ${witnessNames || 'None defined'}

=== USER'S ROLE ===
The user is playing as ${userRole} Counsel.

=== ROUTING RULES ===

**Route to WITNESS when:**
- User directly addresses a witness by name (e.g., "Mr. Perera, tell us...")
- User says "I ask the witness..." or "I call [name] to the stand"
- User poses a direct question meant for testimony
- User is conducting cross-examination of a specific person

**Route to OPPONENT (${opponentName}) when:**
- User makes a procedural error (leading question, hearsay, speculation)
- User presents evidence that can be challenged
- User makes a strong legal claim that needs rebuttal
- Opponent should object based on courtroom procedure

**Route to JUDGE when:**
- User addresses the court directly ("Your Honor...", "I submit to the court...")
- A previous objection needs ruling
- User makes a motion or formal request
- Procedural guidance or instruction is needed
- User requests admission of evidence

=== OUTPUT FORMAT ===
Return ONLY valid JSON (no markdown):
{
    "nextSpeaker": "Judge Dissanayake" | "${opponentName}" | "<Witness Name>",
    "speakerRole": "Judge" | "Opponent" | "Witness",
    "reason": "Brief explanation of why this persona should respond"
}`;

        const directorModel = createModel(DIRECTOR_PROMPT);

        const formattedHistory = buildHistoryContext(history, userRole);

        const prompt = `${formattedHistory}

=== USER'S LATEST INPUT ===
"${userMessage}"

Analyze this input and decide who should respond. Return JSON only.`;

        const result = await directorModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 150,
                temperature: 0.3, // Low temperature for consistent routing
            }
        });

        const decision = parseGeminiJSON(result.response.text());

        console.log(`🎬 Director Decision: ${decision.speakerRole} (${decision.nextSpeaker})`);
        console.log(`   Reason: ${decision.reason}`);

        return {
            nextSpeaker: decision.nextSpeaker || 'Judge Dissanayake',
            speakerRole: decision.speakerRole || 'Judge',
            reason: decision.reason || 'Default routing'
        };

    } catch (error) {
        console.error('❌ Director Error:', error.message);

        // Fallback: Default to Judge
        return {
            nextSpeaker: 'Judge Dissanayake',
            speakerRole: 'Judge',
            reason: 'Fallback - Director error'
        };
    }
}

// ============================================================
// PHASE 2: THE ACTOR SYSTEM
// Generate specific dialogue for each courtroom persona
// ============================================================

/**
 * Get dynamic opponent name based on user role
 */
function getOpponentInfo(caseDetails) {
    const userRole = caseDetails?.userRole || 'Defense';
    const opponentRole = userRole === 'Defense' ? 'Prosecution' : 'Defense';
    const opponentName = opponentRole === 'Prosecution'
        ? 'Prosecutor Mr. Ratnayake'
        : 'Defense Attorney Ms. Fernando';
    return { opponentRole, opponentName };
}

/**
 * Find witness from case details by name
 */
function findWitness(caseDetails, speakerName) {
    const witnesses = caseDetails?.witnesses || [];

    // Try exact match first
    let witness = witnesses.find(w =>
        w.name.toLowerCase() === speakerName.toLowerCase()
    );

    // Try partial match
    if (!witness) {
        const nameParts = speakerName.toLowerCase().split(' ');
        witness = witnesses.find(w =>
            nameParts.some(part => w.name.toLowerCase().includes(part))
        );
    }

    // Default witness if not found
    return witness || {
        name: speakerName,
        role: 'Eyewitness',
        personality: 'Neutral',
        affiliation: 'Neutral'
    };
}

/**
 * Generate dialogue for JUDGE persona
 * Tone: Neutral, authoritative, formal, fair
 */
async function generateJudgeDialogue(speakerName, caseDetails, userMessage, legalContext, winProbability, history) {
    const userRole = caseDetails?.userRole || 'Defense';
    const caseFacts = (caseDetails?.facts || []).join('; ');

    // Build dynamic system instruction
    const systemInstruction = `You are ${speakerName || 'Judge Dissanayake'}, the presiding High Court Judge in a Sri Lankan courtroom.

=== YOUR CHARACTER ===
- Stern but fair, neutral arbiter of justice
- Authoritative, formal, and deeply knowledgeable in Sri Lankan law
- Values proper courtroom procedure and decorum
- References specific legal provisions when ruling

=== LEGAL KNOWLEDGE (MUST USE IF RELEVANT) ===
${legalContext || 'Apply general principles of Sri Lankan law and the Evidence Ordinance.'}

=== CASE CONTEXT ===
Facts of this case: ${caseFacts || 'Standard criminal/civil matter'}

=== BEHAVIORAL GUIDELINES ===
Based on the Legal Validity Score of ${winProbability.toFixed(1)}%:
${winProbability < 40
            ? '- Be SKEPTICAL. The argument is weak. Point out flaws, ask for clarification, or dismiss weak reasoning.'
            : winProbability > 70
                ? '- Be FAVORABLE. The argument is strong. Acknowledge the merit, accept the point, move the case forward.'
                : '- Be NEUTRAL. The argument is moderate. Request more evidence or clarification before ruling.'}

=== RESPONSE RULES ===
1. Speak in FIRST PERSON as a judge would in court
2. Keep response between 200 and 800 WORDS
3. If an objection was raised, you MUST rule (Sustained/Overruled)
4. If evidence is presented, decide on its admissibility
5. Do NOT mention probability scores or that you are an AI
6. Cite the specific law from LEGAL KNOWLEDGE if applicable

=== OUTPUT ===
Respond ONLY with your dialogue as the Judge. No JSON, no explanations.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }, { apiVersion: 'v1' });
        const formattedHistory = buildHistoryContext(history, userRole);

        const prompt = `${systemInstruction}

=== CONVERSATION HISTORY ===
${formattedHistory}

=== COUNSEL'S STATEMENT ===
"${userMessage}"

Respond as ${speakerName || 'Judge Dissanayake'}:`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 1500,
                temperature: 0.6,
            }
        });

        const dialogue = result.response.text().trim();

        // Determine mood and action based on response content
        const lowerDialogue = dialogue.toLowerCase();
        let mood = 'Neutral';
        let action = 'Instruction';

        if (lowerDialogue.includes('sustained') || lowerDialogue.includes('overruled')) {
            action = 'Ruling';
        } else if (lowerDialogue.includes('admitted') || lowerDialogue.includes('accept')) {
            action = 'Admission';
            mood = 'Impressed';
        } else if (lowerDialogue.includes('clarif') || lowerDialogue.includes('?')) {
            action = 'Question';
        }

        if (winProbability < 40) mood = 'Skeptical';
        else if (winProbability > 70) mood = 'Impressed';

        console.log(`⚖️ Judge Response: "${dialogue.substring(0, 60)}..."`);

        return {
            speaker: speakerName || 'Judge Dissanayake',
            speakerRole: 'Judge',
            text: dialogue || 'The court acknowledges your statement. Please proceed.',
            mood,
            action
        };

    } catch (error) {
        console.error('❌ Judge Dialogue Error:', error.message);

        // Fallback response
        const fallbackResponses = {
            low: 'Counsel, your argument lacks sufficient legal foundation. Please provide supporting evidence.',
            mid: 'The court notes your submission. Please continue with your examination.',
            high: 'The court finds merit in your argument. You may proceed.'
        };

        return {
            speaker: speakerName || 'Judge Dissanayake',
            speakerRole: 'Judge',
            text: winProbability < 40 ? fallbackResponses.low : winProbability > 70 ? fallbackResponses.high : fallbackResponses.mid,
            mood: winProbability < 40 ? 'Skeptical' : winProbability > 70 ? 'Impressed' : 'Neutral',
            action: 'Instruction'
        };
    }
}

/**
 * Generate dialogue for OPPONENT persona
 * Tone: Aggressive, strategic, sharp, competitive
 */
async function generateOpponentDialogue(speakerName, caseDetails, userMessage, legalContext, winProbability, history) {
    const userRole = caseDetails?.userRole || 'Defense';
    const { opponentRole, opponentName } = getOpponentInfo(caseDetails);
    const finalSpeakerName = speakerName || opponentName;

    const opponentEvidence = (caseDetails?.opponentEvidence || []).join('; ');
    const caseFacts = (caseDetails?.facts || []).join('; ');

    // Build dynamic system instruction
    const systemInstruction = `You are ${finalSpeakerName}, the ${opponentRole} Counsel in a Sri Lankan High Court.

=== YOUR CHARACTER ===
- Aggressive and strategic advocate
- Sharp, competitive, but maintains courtroom decorum
- Quick to identify procedural errors and object
- Uses legal jargon naturally and confidently
- Your goal is to WIN the case against opposing counsel

=== YOUR EVIDENCE ===
${opponentEvidence || 'Standard case materials and witness testimonies'}

=== CASE FACTS ===
${caseFacts}

=== LEGAL KNOWLEDGE (USE FOR OBJECTIONS) ===
${legalContext || 'Standard courtroom procedure and Evidence Ordinance apply.'}

=== BEHAVIORAL GUIDELINES ===
The opposing counsel's argument scored ${winProbability.toFixed(1)}%:
${winProbability < 40
            ? '- Be AGGRESSIVE! Their argument is WEAK. Object confidently, press your advantage, discredit their reasoning.'
            : winProbability > 70
                ? '- Be DEFENSIVE. Their argument is STRONG. Try to undermine it, request clarification, find procedural flaws.'
                : '- Be STRATEGIC. Look for opportunities to object. Challenge evidence if possible.'}

=== WHEN TO OBJECT ===
Object if the opposing counsel:
- Asks leading questions to their own witness
- Introduces hearsay evidence
- Speculates or makes unsupported claims
- Violates courtroom procedure

=== RESPONSE RULES ===
1. Speak in FIRST PERSON as opposing counsel
2. Keep response between 100 and 500 WORDS
3. Start with "Objection, Your Honor!" if objecting (state grounds)
4. If rebutting, challenge their logic or evidence directly
5. Be realistic - don't object to everything, pick your battles
6. Do NOT mention scores or that you are an AI

=== OUTPUT ===
Respond ONLY with your dialogue. No JSON, no explanations.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }, { apiVersion: 'v1' });
        const formattedHistory = buildHistoryContext(history, userRole);

        const prompt = `${systemInstruction}

=== CONVERSATION HISTORY ===
${formattedHistory}

=== OPPOSING COUNSEL JUST SAID ===
"${userMessage}"

Respond as ${finalSpeakerName}:`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 1500,
                temperature: 0.75,
            }
        });

        const dialogue = result.response.text().trim();

        // Determine mood and action
        const lowerDialogue = dialogue.toLowerCase();
        let mood = 'Neutral';
        let action = 'Cross-Argument';

        if (lowerDialogue.includes('objection')) {
            action = 'Objection';
            mood = 'Aggressive';
        } else if (lowerDialogue.includes('?')) {
            action = 'Question';
        }

        if (winProbability < 40) mood = 'Aggressive';
        else if (winProbability > 70) mood = 'Defensive';

        console.log(`⚔️ Opponent Response: "${dialogue.substring(0, 60)}..."`);

        return {
            speaker: finalSpeakerName,
            speakerRole: 'Opponent',
            text: dialogue || 'I have no objection at this time, Your Honor.',
            mood,
            action
        };

    } catch (error) {
        console.error('❌ Opponent Dialogue Error:', error.message);

        return {
            speaker: finalSpeakerName,
            speakerRole: 'Opponent',
            text: "Objection, Your Honor! Counsel's statement lacks proper legal foundation and should be stricken from the record.",
            mood: 'Aggressive',
            action: 'Objection'
        };
    }
}

/**
 * Generate dialogue for WITNESS persona
 * Tone: Variable based on personality (Nervous, Confident, Hostile, etc.)
 */
async function generateWitnessDialogue(speakerName, personality, caseDetails, userMessage, winProbability, history) {
    const userRole = caseDetails?.userRole || 'Defense';
    const witness = findWitness(caseDetails, speakerName);
    const finalPersonality = personality || witness.personality || 'Neutral';
    const caseFacts = (caseDetails?.facts || []).join('; ');

    // Personality-specific behavior instructions
    const personalityBehaviors = {
        'Nervous': 'Hesitant speech, sometimes contradicts yourself, asks for clarification, uses filler words like "um" and "well".',
        'Confident': 'Clear and direct answers, maintains composure under pressure, speaks with certainty.',
        'Hostile': 'Reluctant to answer, gives short responses, challenges the question, slight antagonism.',
        'Arrogant': 'Condescending tone, thinks you know better than the lawyers, dismissive of simple questions.',
        'Evasive': 'Avoids direct answers, provides vague responses, says "I don\'t recall" frequently.',
        'Cooperative': 'Helpful and detailed, eager to assist the court, provides additional context.',
        'Neutral': 'Straightforward and matter-of-fact, neither helpful nor hostile.'
    };

    const behaviorInstruction = personalityBehaviors[finalPersonality] || personalityBehaviors['Neutral'];

    // Build dynamic system instruction
    const systemInstruction = `You are ${witness.name}, a ${witness.role} testifying in a Sri Lankan court case.

=== YOUR CHARACTER ===
- Role: ${witness.role}
- Personality: ${finalPersonality}
- Affiliation: ${witness.affiliation === 'User' ? 'Sympathetic to the questioning lawyer' :
            witness.affiliation === 'Opponent' ? 'Hostile to the questioning lawyer' :
                'Neutral - just telling the truth as you saw it'}

=== YOUR PERSONALITY BEHAVIOR ===
${behaviorInstruction}

=== CASE FACTS YOU KNOW ===
${caseFacts}

=== BEHAVIORAL MODIFIER ===
${winProbability < 40
            ? 'Be MORE EVASIVE or difficult, even if normally cooperative. Hesitate, ask for clarification.'
            : winProbability > 70
                ? 'Be MORE COOPERATIVE, even if normally hostile. Provide helpful details.'
                : 'Act according to your natural personality.'}

=== RESPONSE RULES ===
1. Speak in FIRST PERSON ("I saw...", "I heard...", "I was...")
2. Keep response between 100 and 500 WORDS
3. Only answer what you would REASONABLY KNOW based on your role
4. You CAN ask for clarification ("Could you repeat that?")
5. You CAN say "I don't recall" or "I'm not sure" if appropriate
6. Do NOT invent facts that contradict the case summary
7. Stay in character throughout

=== OUTPUT ===
Respond ONLY with your testimony. No JSON, no explanations.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }, { apiVersion: 'v1' });
        const formattedHistory = buildHistoryContext(history, userRole);

        const prompt = `${systemInstruction}

=== PREVIOUS EXCHANGES ===
${formattedHistory}

=== COUNSEL ASKS YOU ===
"${userMessage}"

Respond as ${witness.name} (${witness.role}, ${finalPersonality}):`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 1500,
                temperature: 0.85, // Higher temperature for more varied responses
            }
        });

        const dialogue = result.response.text().trim();

        // Determine mood and action
        let mood = finalPersonality;
        let action = 'Testimony';

        const lowerDialogue = dialogue.toLowerCase();
        if (lowerDialogue.includes('yes') && lowerDialogue.includes('did') ||
            lowerDialogue.includes('admit') || lowerDialogue.includes('confess')) {
            action = 'Admission';
        }

        console.log(`👤 Witness Response (${finalPersonality}): "${dialogue.substring(0, 60)}..."`);

        return {
            speaker: witness.name,
            speakerRole: 'Witness',
            text: dialogue || 'I... I need a moment to think about that.',
            mood,
            action
        };

    } catch (error) {
        console.error('❌ Witness Dialogue Error:', error.message);

        // Personality-based fallback
        const fallbacks = {
            'Nervous': 'I... um... I\'m not entirely sure. Could you please repeat the question?',
            'Hostile': 'I don\'t see why I should answer that.',
            'Confident': 'Yes, I remember that clearly.',
            'Evasive': 'I don\'t recall the specifics of that.',
            'Arrogant': 'As I\'ve already indicated, the answer should be obvious.',
            'Cooperative': 'Yes, I can tell you what I observed.',
            'Neutral': 'To the best of my recollection, that is correct.'
        };

        return {
            speaker: witness.name,
            speakerRole: 'Witness',
            text: fallbacks[finalPersonality] || fallbacks['Neutral'],
            mood: finalPersonality,
            action: 'Testimony'
        };
    }
}

// ============================================================
// MAIN ACTOR DISPATCHER
// Routes to the appropriate persona based on speakerRole
// ============================================================

/**
 * Generate Actor Dialogue - Main dispatcher function
 * @param {string} speakerRole - 'Judge' | 'Opponent' | 'Witness'
 * @param {string} speakerName - Name of the speaker (e.g., "Judge Dissanayake", "Mr. Ratnayake")
 * @param {string} personality - Witness personality (only used for Witness role)
 * @param {Object} caseDetails - Full case dossier
 * @param {string} userMessage - The user's latest message
 * @param {string} legalContext - RAG data (relevant laws)
 * @param {number} winProbability - Current score (0-100)
 * @param {Array} history - Conversation history
 * @returns {Promise<Object>} - { speaker, speakerRole, text, mood, action }
 */
async function generateActorDialogue(speakerRole, speakerName, personality, caseDetails, userMessage, legalContext, winProbability, history) {
    console.log(`\n🎭 Actor System: Generating ${speakerRole} dialogue for "${speakerName}"`);

    try {
        switch (speakerRole) {
            case 'Judge':
                return await generateJudgeDialogue(
                    speakerName,
                    caseDetails,
                    userMessage,
                    legalContext,
                    winProbability,
                    history
                );

            case 'Opponent':
                return await generateOpponentDialogue(
                    speakerName,
                    caseDetails,
                    userMessage,
                    legalContext,
                    winProbability,
                    history
                );

            case 'Witness':
                return await generateWitnessDialogue(
                    speakerName,
                    personality,
                    caseDetails,
                    userMessage,
                    winProbability,
                    history
                );

            default:
                console.warn(`⚠️ Unknown speaker role: "${speakerRole}", defaulting to Judge`);
                return await generateJudgeDialogue(
                    'Judge Dissanayake',
                    caseDetails,
                    userMessage,
                    legalContext,
                    winProbability,
                    history
                );
        }
    } catch (error) {
        console.error(`❌ Actor Dispatch Error: ${error.message}`);

        // Ultimate fallback
        return {
            speaker: speakerName || 'Judge Dissanayake',
            speakerRole: speakerRole || 'Judge',
            text: 'The court acknowledges your statement. Please continue.',
            mood: 'Neutral',
            action: 'Instruction'
        };
    }
}

// ============================================================
// MAIN ORCHESTRATOR: Combines Director + Actor
// ============================================================

/**
 * Full Courtroom Response - Director + Actor Pipeline
 * This is the main function called by the controller
 */
async function generateCourtroomResponse(history, caseDetails, userMessage, winProbability, turnNumber, legalContext) {
    try {
        console.log(`\n🎬 === DIRECTOR AGENT PIPELINE (Turn ${turnNumber}) ===`);

        // STEP 1: Director decides who speaks
        const direction = await directCourtroomScene(history, caseDetails, userMessage);

        // Get witness personality if applicable
        let witnessPersonality = null;
        if (direction.speakerRole === 'Witness') {
            const witness = findWitness(caseDetails, direction.nextSpeaker);
            witnessPersonality = witness?.personality || 'Neutral';
        }

        // STEP 2: Actor generates dialogue
        // New signature: (speakerRole, speakerName, personality, caseDetails, userMessage, legalContext, winProbability, history)
        const actorResponse = await generateActorDialogue(
            direction.speakerRole,
            direction.nextSpeaker,
            witnessPersonality,
            caseDetails,
            userMessage,
            legalContext,
            winProbability,
            history
        );

        console.log(`🎭 ${actorResponse.speakerRole}: ${actorResponse.speaker} (${actorResponse.action})`);
        console.log(`   "${actorResponse.text.substring(0, 50)}..."`);

        return {
            ...actorResponse,
            winProbability: winProbability,
            directorReason: direction.reason
        };

    } catch (error) {
        console.error('❌ Courtroom Response Pipeline Error:', error.message);
        return generateFallbackCourtroomResponse(winProbability, caseDetails);
    }
}

// ============================================================
// LEGACY & UTILITY FUNCTIONS
// ============================================================

/**
 * Fallback courtroom response when AI fails
 */
function generateFallbackCourtroomResponse(winProbability, caseDetails) {
    const userRole = caseDetails?.userRole || 'Defense';
    const opponentRole = userRole === 'Defense' ? 'Prosecution' : 'Defense';
    const opponentName = opponentRole === 'Prosecution' ? 'Prosecutor Mr. Ratnayake' : 'Defense Attorney Ms. Fernando';

    if (winProbability < 35) {
        return {
            speaker: opponentName,
            speakerRole: 'Opponent',
            text: "Objection, Your Honor! Counsel's argument lacks proper legal foundation.",
            mood: 'Aggressive',
            action: 'Objection',
            winProbability: winProbability
        };
    } else if (winProbability > 70) {
        return {
            speaker: 'Judge Dissanayake',
            speakerRole: 'Judge',
            text: "The court finds merit in counsel's argument. You may proceed.",
            mood: 'Impressed',
            action: 'Ruling',
            winProbability: winProbability
        };
    } else {
        return {
            speaker: 'Judge Dissanayake',
            speakerRole: 'Judge',
            text: "The court acknowledges your statement. Please continue.",
            mood: 'Neutral',
            action: 'Instruction',
            winProbability: winProbability
        };
    }
}

/**
 * Generates a final verdict summary
 */
async function generateVerdict(history, avgProbability) {
    const VERDICT_PROMPT = `You are Judge Dissanayake delivering a final verdict in a Sri Lankan High Court case.

=== VERDICT GUIDELINES ===
- Average Score: ${avgProbability.toFixed(1)}%
- Outcome: ${avgProbability >= 60 ? 'SUCCESSFUL' : avgProbability >= 40 ? 'PARTIALLY SUCCESSFUL' : 'UNSUCCESSFUL'}

=== INSTRUCTIONS ===
1. State the verdict clearly
2. Summarize the key strength or weakness of counsel's arguments
3. End with a formal court dismissal
4. Maximum 75 words`;

    try {
        const verdictModel = createModel(VERDICT_PROMPT);
        const historyContext = buildHistoryContext(history);

        const result = await verdictModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: `${historyContext}\n\nDeliver your final verdict.` }] }],
            generationConfig: { maxOutputTokens: 2000, temperature: 0.6 }
        });

        const text = result.response.text().trim();

        let outcome = 'draw';
        if (avgProbability >= 60) outcome = 'win';
        else if (avgProbability < 40) outcome = 'lose';

        return { outcome, summary: text };

    } catch (error) {
        console.error('❌ Verdict Generation Error:', error.message);

        let outcome = 'draw';
        if (avgProbability >= 60) outcome = 'win';
        else if (avgProbability < 40) outcome = 'lose';

        return {
            outcome,
            summary: 'The court has reviewed all arguments. This court is now adjourned.'
        };
    }
}

/**
 * Check if Gemini is configured
 */
function isGeminiConfigured() {
    return !!process.env.GEMINI_API_KEY;
}

// ============================================================
// CASE SCENARIO GENERATOR
// ============================================================

const SRI_LANKAN_LAW_REFERENCES = {
    'Theft': ['Penal Code Section 366-370', 'Penal Code Section 380 (Theft in dwelling house)', 'Penal Code Section 401 (Robbery)'],
    'Contract': ['Sale of Goods Ordinance', 'Contract Act', 'Civil Procedure Code'],
    'Murder': ['Penal Code Section 294', 'Penal Code Section 296 (Culpable Homicide)', 'Penal Code Section 300'],
    'Assault': ['Penal Code Section 314-316', 'Penal Code Section 351 (Criminal Force)'],
    'Fraud': ['Penal Code Section 398-403', 'Computer Crimes Act No. 24 of 2007'],
    'Property': ['Land Registration Ordinance', 'Partition Law', 'Rent Act'],
    'Family': ['Marriage Registration Ordinance', 'Maintenance Act', 'Matrimonial Causes Ordinance'],
    'Random': ['Penal Code', 'Civil Procedure Code', 'Evidence Ordinance']
};

/**
 * Generates a detailed legal case scenario (Case Dossier)
 */
async function generateCaseScenario(difficulty = 'Medium', topic = 'Random', userRole = null) {
    try {
        const lawReferences = SRI_LANKAN_LAW_REFERENCES[topic] || SRI_LANKAN_LAW_REFERENCES['Random'];
        const suggestedLaw = lawReferences[Math.floor(Math.random() * lawReferences.length)];

        const finalUserRole = userRole || (Math.random() > 0.5 ? 'Defense' : 'Prosecution');
        const opponentRole = finalUserRole === 'Defense' ? 'Prosecution' : 'Defense';

        const caseStages = {
            'Easy': ['Opening Statements', 'Examination of Single Witness'],
            'Medium': ['Cross-Examination of Key Witness', 'Presentation of Evidence'],
            'Hard': ['Rebuttal Arguments', 'Closing Arguments', 'Cross-Examination of Expert Witness']
        };
        const stageOptions = caseStages[difficulty] || caseStages['Medium'];
        const selectedStage = stageOptions[Math.floor(Math.random() * stageOptions.length)];

        const witnessCount = difficulty === 'Easy' ? 1 : difficulty === 'Hard' ? 3 : 2;

        const prompt = `You are a legal case generator for a Sri Lankan law training simulation.
Generate a DETAILED and REALISTIC legal case scenario.

=== CONFIGURATION ===
Topic: ${topic === 'Random' ? 'Any criminal or civil matter under Sri Lankan law' : topic}
Difficulty: ${difficulty}
User Role: ${finalUserRole} Counsel
Opponent: ${opponentRole} Counsel (AI-controlled)
Suggested Law: ${suggestedLaw}
Number of Witnesses: ${witnessCount}

=== DIFFICULTY GUIDELINES ===
- Easy: Clear-cut case, obvious evidence, one key witness, straightforward legal issues
- Medium: Some ambiguity, conflicting testimonies, requires careful argumentation
- Hard: Complex facts, multiple witnesses, expert testimony, nuanced legal interpretation

=== WITNESS PERSONALITIES ===
Create witnesses with DISTINCT personalities:
- Nervous: Hesitant, contradicts self, needs reassurance
- Confident: Clear answers, maintains composure under pressure
- Hostile: Reluctant, gives short answers, challenges questions
- Arrogant: Condescending, thinks they know better than lawyers
- Evasive: Avoids direct answers, provides vague responses
- Cooperative: Helpful, detailed answers, eager to assist

=== OUTPUT FORMAT ===
Return ONLY valid JSON (no markdown):
{
    "title": "Creative case name",
    "summary": "3-4 sentences describing the incident with Sri Lankan names, locations, dates",
    "relevantLaw": "The most applicable Sri Lankan law section",
    "caseStage": "${selectedStage}",
    "facts": [
        "Indisputable fact 1",
        "Indisputable fact 2",
        "Indisputable fact 3"
    ],
    "userEvidence": [
        "Evidence for ${finalUserRole}",
        "Another evidence piece"
    ],
    "opponentEvidence": [
        "Evidence for ${opponentRole}",
        "Another opposing evidence"
    ],
    "witnesses": [
        {
            "name": "Full Sri Lankan name",
            "role": "Eyewitness/Expert/Police Officer/Character Witness/Victim",
            "personality": "Nervous/Confident/Hostile/Arrogant/Evasive/Cooperative",
            "affiliation": "User/Opponent/Neutral"
        }
    ],
    "openingHint": "Strategic advice for ${finalUserRole}"
}`;

        const caseModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }, { apiVersion: 'v1' });

        const result = await caseModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 1500,
                temperature: 0.85,
            }
        });

        const caseData = parseGeminiJSON(result.response.text());

        console.log(`📋 Generated Case Dossier: "${caseData.title}"`);
        console.log(`   Role: ${finalUserRole} | Stage: ${caseData.caseStage} | Witnesses: ${caseData.witnesses?.length || 0}`);

        return {
            title: caseData.title || 'Legal Case',
            summary: caseData.summary || 'A legal dispute requiring resolution.',
            relevantLaw: caseData.relevantLaw || suggestedLaw,
            caseStage: caseData.caseStage || selectedStage,
            userRole: finalUserRole,
            difficulty: difficulty,
            topic: topic,
            facts: caseData.facts || [],
            userEvidence: caseData.userEvidence || [],
            opponentEvidence: caseData.opponentEvidence || [],
            witnesses: (caseData.witnesses || []).map(w => ({
                name: w.name || 'Unknown Witness',
                role: w.role || 'Eyewitness',
                personality: w.personality || 'Neutral',
                affiliation: w.affiliation || 'Neutral',
                hasTestified: false
            })),
            openingHint: caseData.openingHint || null,
            maxTurns: difficulty === 'Easy' ? 3 : difficulty === 'Medium' ? 5 : 7
        };

    } catch (error) {
        console.error('❌ Case Generation Error:', error.message);
        return generateFallbackCase(difficulty, topic, userRole);
    }
}

/**
 * Fallback case if Gemini fails
 */
function generateFallbackCase(difficulty, topic, userRole = null) {
    const finalUserRole = userRole || (Math.random() > 0.5 ? 'Defense' : 'Prosecution');

    const fallbackCases = {
        'Theft': {
            title: 'The Missing Temple Jewelry',
            summary: 'A caretaker named Sunil Perera at the Kelaniya Raja Maha Viharaya is accused of stealing ancient jewelry valued at Rs. 5 million on January 15th, 2024. The defendant claims he was framed by a jealous colleague.',
            relevantLaw: 'Penal Code Section 366 (Theft)',
            facts: [
                'The jewelry was last seen on January 14th, 2024 at 6:00 PM',
                'Only three people had keys to the storage room',
                'The defendant was on duty the night the jewelry went missing',
                'No signs of forced entry were found'
            ],
            userEvidence: finalUserRole === 'Defense'
                ? ['Character reference letters', 'CCTV showing defendant leaving at 8 PM']
                : ['Fingerprints on jewelry box', 'Witness testimony of suspicious behavior'],
            opponentEvidence: finalUserRole === 'Defense'
                ? ['Fingerprints on jewelry box', 'Witness testimony of suspicious behavior']
                : ['Character reference letters', 'CCTV showing defendant leaving at 8 PM'],
            witnesses: [
                { name: 'Nimal Fernando', role: 'Eyewitness', personality: 'Hostile', affiliation: 'Opponent', hasTestified: false },
                { name: 'Kamala Silva', role: 'Character Witness', personality: 'Nervous', affiliation: 'User', hasTestified: false }
            ]
        },
        'Contract': {
            title: 'The Broken Tea Estate Agreement',
            summary: 'Ranjith Jayawardena claims breach of contract when Ceylon Premium Exports refused delivery of 10,000kg premium Ceylon tea on March 1st, 2024.',
            relevantLaw: 'Sale of Goods Ordinance',
            facts: [
                'Contract signed December 15th, 2023',
                'Sample tea approved before signing',
                'Delivery made March 1st, 2024',
                'Payment of Rs. 8 million due upon delivery'
            ],
            userEvidence: finalUserRole === 'Defense'
                ? ['Quality test report', 'Email chain showing acceptance']
                : ['Photos of damaged leaves', 'Expert opinion on grade mismatch'],
            opponentEvidence: finalUserRole === 'Defense'
                ? ['Photos of damaged leaves', 'Expert opinion on grade mismatch']
                : ['Quality test report', 'Email chain showing acceptance'],
            witnesses: [
                { name: 'Dr. Lakshmi Rodrigo', role: 'Expert', personality: 'Arrogant', affiliation: 'Neutral', hasTestified: false },
                { name: 'Ajith Bandara', role: 'Eyewitness', personality: 'Cooperative', affiliation: 'User', hasTestified: false }
            ]
        },
        'Random': {
            title: 'The Disputed Ancestral Land',
            summary: 'The Senanayake and Gunawardena families dispute ownership of 5 acres of ancestral paddy fields in Polonnaruwa.',
            relevantLaw: 'Land Registration Ordinance',
            facts: [
                'Land cultivated since 1920',
                'Both families have deed documents',
                'Boundary dispute arose in 2023',
                'Land valued at Rs. 25 million'
            ],
            userEvidence: finalUserRole === 'Defense'
                ? ['Original deed from 1952', 'Surveyor report']
                : ['Forensic analysis suggesting forgery', 'Village elder testimony'],
            opponentEvidence: finalUserRole === 'Defense'
                ? ['Forensic analysis suggesting forgery', 'Village elder testimony']
                : ['Original deed from 1952', 'Surveyor report'],
            witnesses: [
                { name: 'Piyasena Abeysekara', role: 'Expert', personality: 'Confident', affiliation: 'User', hasTestified: false },
                { name: 'Somadasa Gunaratne', role: 'Character Witness', personality: 'Evasive', affiliation: 'Opponent', hasTestified: false }
            ]
        }
    };

    const fallback = fallbackCases[topic] || fallbackCases['Random'];
    const caseStage = difficulty === 'Easy' ? 'Opening Statements' :
        difficulty === 'Hard' ? 'Cross-Examination of Key Witness' :
            'Presentation of Evidence';

    return {
        title: fallback.title,
        summary: fallback.summary,
        relevantLaw: fallback.relevantLaw,
        caseStage: caseStage,
        userRole: finalUserRole,
        difficulty: difficulty,
        topic: topic,
        facts: fallback.facts,
        userEvidence: fallback.userEvidence,
        opponentEvidence: fallback.opponentEvidence,
        witnesses: fallback.witnesses,
        openingHint: `Focus on establishing your key evidence early in the ${caseStage.toLowerCase()} phase.`,
        maxTurns: difficulty === 'Easy' ? 3 : difficulty === 'Medium' ? 5 : 7
    };
}

// ============================================================
// EXPORTS
// ============================================================

export {
    // Main Director+Actor pipeline
    generateCourtroomResponse,
    directCourtroomScene,
    generateActorDialogue,

    // Individual actors
    generateJudgeDialogue,
    generateOpponentDialogue,
    generateWitnessDialogue,

    // Case generation
    generateCaseScenario,

    // Verdict
    generateVerdict,

    // Utilities
    isGeminiConfigured,
    parseGeminiJSON,
    buildHistoryContext,
    findWitness,
    getOpponentInfo
};

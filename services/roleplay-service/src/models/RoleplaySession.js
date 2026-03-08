import mongoose from 'mongoose';

// Sub-schema for witnesses
const WitnessSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true  // Removed enum to allow any AI-generated role
    },
    personality: {
        type: String,
        default: 'Neutral'
    },
    affiliation: {
        type: String,
        enum: ['User', 'Opponent', 'Neutral'],
        default: 'Neutral'
    },
    // Track if witness has been examined
    hasTestified: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Sub-schema for case details (structured data)
const CaseDetailsSchema = new mongoose.Schema({
    title: {
        type: String,
        default: null
    },
    summary: {
        type: String,
        default: null
    },
    relevantLaw: {
        type: String,
        default: null
    },
    caseStage: {
        type: String,
        default: 'Opening Statements'
    },
    userRole: {
        type: String,
        enum: ['Defense', 'Prosecution', null],
        default: null
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard', null],
        default: null
    },
    topic: {
        type: String,
        default: null
    },
    // Indisputable facts agreed by both sides
    facts: [{
        type: String
    }],
    // Evidence available to the user (player)
    userEvidence: [{
        type: String
    }],
    // Evidence held by the AI opponent
    opponentEvidence: [{
        type: String
    }],
    // Witnesses with personality profiles
    witnesses: [WitnessSchema],
    // Strategic hint for the player
    openingHint: {
        type: String,
        default: null
    },
    // Maximum turns for this case
    maxTurns: {
        type: Number,
        default: 5
    }
}, { _id: false });

// Sub-schema for conversation history entries
const HistoryEntrySchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'model'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    // Multi-role speaker information
    speaker: {
        type: String,
        default: null // e.g., "Judge Dissanayake", "Prosecutor Mr. Ratnayake"
    },
    speakerRole: {
        type: String,
        default: null // Removed enum to allow dynamic AI-generated roles (Judge, Prosecutor, Witness, Clerk, etc.)
    },
    action: {
        type: String,
        default: null // Removed enum to allow dynamic actions (Testimony, ADJOURN, Waiting, etc.)
    },
    mood: {
        type: String,
        default: null
    },
    winProbability: {
        type: Number,
        default: null
    },
    // RAG data associated with this turn
    relevantLaws: {
        type: String,
        default: null
    },
    // Flag: was this turn generated autonomously by the heartbeat engine?
    isAutonomous: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

// Main RoleplaySession Schema
const roleplaySessionSchema = new mongoose.Schema({
    // Unique session identifier
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // User who owns this session
    userId: {
        type: String,
        default: null
    },

    // Case identifier for scenario tracking
    caseId: {
        type: String,
        default: 'case_default'
    },

    // Case metadata (legacy support)
    caseTitle: {
        type: String,
        default: 'Practice Case'
    },

    caseStage: {
        type: String,
        default: 'Cross-Examination'
    },

    // ============ NEW PHASE 1 FIELDS ============

    // Game mode configuration
    gameMode: {
        type: String,
        enum: ['TimeBased', 'TurnBased', 'Freeform'],
        default: 'TimeBased'  // Changed default to TimeBased
    },

    // Day-based progression (for TimeBased mode)
    currentDay: {
        type: Number,
        default: 1,
        min: 1
    },

    maxDays: {
        type: Number,
        default: 3
    },

    // ============ PHASE 3: TIME MANAGEMENT ============

    // Time elapsed in current day (in simulated seconds)
    timeElapsedCurrentDay: {
        type: Number,
        default: 0
    },

    // Time limit per day (in simulated seconds) - 4 minutes = 240s
    timeLimitPerDay: {
        type: Number,
        default: 240
    },

    // Legacy: total time elapsed across all days
    timeElapsed: {
        type: Number,
        default: 0
    },

    // ============ END PHASE 3 FIELDS ============

    // Turn counter
    turnCount: {
        type: Number,
        default: 0,
        min: 0
    },

    // Maximum turns allowed (set to unlimited)
    maxTurns: {
        type: Number,
        default: 9999  // Effectively unlimited
    },

    // Generated case details (Full Case Dossier - Structured)
    caseDetails: CaseDetailsSchema,

    // Conversation history with multi-role support
    history: [HistoryEntrySchema],

    // Current win probability score
    currentWinProbability: {
        type: Number,
        default: 50,
        min: 0,
        max: 100
    },

    // Session status
    status: {
        type: String,
        enum: ['active', 'adjourned', 'finished', 'abandoned', 'paused', 'completed'],
        default: 'active'
    },

    // Verdict (set when session ends)
    verdict: {
        outcome: {
            type: String,
            enum: ['win', 'lose', 'draw', null],
            default: null
        },
        summary: {
            type: String,
            default: null
        },
        verdict_data: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        }
    },
    // Audit report from ML service for user arguments
    auditReport: [{
        originalText: String,
        score: Number,
        verdict: String,
        reason: String
    }],
    // Track which AI persona spoke last
    lastSpeaker: {
        name: {
            type: String,
            default: null
        },
        role: {
            type: String,
            default: null // Removed enum to allow dynamic AI-generated roles
        }
    },

    // ============ AUTONOMOUS MODE FIELDS ============
    // Whether the courtroom simulation is actively generating autonomous dialogue
    autonomousMode: {
        type: Boolean,
        default: false
    },
    // When the user last interacted (for idle detection)
    lastUserInteraction: {
        type: Date,
        default: Date.now
    },
    // Count of autonomous turns generated
    autonomousTurnCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Indexes for faster queries
roleplaySessionSchema.index({ userId: 1, createdAt: -1 });
roleplaySessionSchema.index({ status: 1 });
roleplaySessionSchema.index({ gameMode: 1, status: 1 });

// Virtual: Check if session is at turn limit (disabled - unlimited turns)
roleplaySessionSchema.virtual('isAtLimit').get(function () {
    return false; // Never limit turns
});

// Virtual: Check if session is at day limit (for TimeBased mode)
roleplaySessionSchema.virtual('isAtDayLimit').get(function () {
    return this.currentDay >= this.maxDays;
});

// Virtual: Get opponent role based on user role
roleplaySessionSchema.virtual('opponentRole').get(function () {
    const userRole = this.caseDetails?.userRole;
    return userRole === 'Defense' ? 'Prosecution' : 'Defense';
});

// Method: Add user message to history
roleplaySessionSchema.methods.addUserMessage = function (content) {
    this.history.push({
        role: 'user',
        content,
        timestamp: new Date()
    });
};

// Method: Add AI response to history with full metadata
roleplaySessionSchema.methods.addAIResponse = function (response, winProbability, relevantLaws = null) {
    this.history.push({
        role: 'model',
        content: response.text,
        speaker: response.speaker,
        speakerRole: response.speakerRole,
        action: response.action,
        mood: response.mood,
        winProbability: winProbability,
        relevantLaws: relevantLaws,
        timestamp: new Date()
    });

    // Update last speaker
    this.lastSpeaker = {
        name: response.speaker,
        role: response.speakerRole
    };

    this.currentWinProbability = winProbability;
    this.turnCount += 1;
};

// Method: Get formatted history for AI context
roleplaySessionSchema.methods.getFormattedHistory = function () {
    if (this.history.length === 0) return '=== START OF SESSION ===\nNo previous exchanges.';

    const userRole = this.caseDetails?.userRole || 'Defense';

    const lines = this.history.map((entry) => {
        if (entry.role === 'user') {
            return `[${userRole} Counsel]: "${entry.content}"`;
        } else {
            const speaker = entry.speaker || 'Court';
            const action = entry.action ? ` (${entry.action})` : '';
            return `[${speaker}]${action}: "${entry.content}"`;
        }
    });

    return `=== CONVERSATION HISTORY ===\n${lines.join('\n')}\n=== END OF HISTORY ===`;
};

// Method: Get witness by name
roleplaySessionSchema.methods.getWitness = function (name) {
    return this.caseDetails?.witnesses?.find(
        w => w.name.toLowerCase().includes(name.toLowerCase())
    );
};

// Method: Mark witness as having testified
roleplaySessionSchema.methods.markWitnessTestified = function (witnessName) {
    const witness = this.getWitness(witnessName);
    if (witness) {
        witness.hasTestified = true;
    }
};

// Method: Finalize session with verdict
roleplaySessionSchema.methods.finalize = function (outcome, summary) {
    this.status = 'finished';
    this.verdict = { outcome, summary };
};

// ============ PHASE 3: TIME MANAGEMENT METHODS ============

// Method: Advance to next day (for TimeBased mode)
roleplaySessionSchema.methods.advanceDay = function () {
    if (this.currentDay < this.maxDays) {
        this.currentDay += 1;
        this.timeElapsedCurrentDay = 0;  // Reset time for new day
        this.status = 'active';  // Reactivate session
        return true;
    }
    return false;
};

// Method: Adjourn the court (day ended due to time)
roleplaySessionSchema.methods.adjournDay = function () {
    if (this.currentDay >= this.maxDays) {
        // Final day ended - game over
        this.status = 'finished';
        return { status: 'finished', newDay: null };
    } else {
        // More days remaining - adjourn
        this.currentDay += 1;
        this.timeElapsedCurrentDay = 0;
        this.status = 'adjourned';
        return { status: 'adjourned', newDay: this.currentDay };
    }
};

// Method: Add time and check if day is over
roleplaySessionSchema.methods.addTimeAndCheck = function (seconds) {
    this.timeElapsedCurrentDay += seconds;
    this.timeElapsed += seconds;  // Track total time

    return this.timeElapsedCurrentDay >= this.timeLimitPerDay;
};

// Method: Get remaining time for current day
roleplaySessionSchema.methods.getRemainingTime = function () {
    return Math.max(0, this.timeLimitPerDay - this.timeElapsedCurrentDay);
};

// Legacy: Add elapsed time
roleplaySessionSchema.methods.addTime = function (seconds) {
    this.timeElapsed += seconds;
    this.timeElapsedCurrentDay += seconds;
};

// ============ END PHASE 3 METHODS ============

// Static: Generate unique session ID
roleplaySessionSchema.statics.generateSessionId = function () {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `rp_${timestamp}_${random}`;
};

const RoleplaySession = mongoose.model('RoleplaySession', roleplaySessionSchema);

export default RoleplaySession;

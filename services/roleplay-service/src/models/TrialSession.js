import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Transcript Entry Schema
 * Stores each message/action in the roleplay trial session
 */
const transcriptEntrySchema = new Schema({
    role: {
        type: String,
        required: [true, 'Role is required for transcript entry'],
        enum: {
            values: ['Lawyer', 'Opposition', 'Judge', 'Witness', 'System', 'User'],
            message: '{VALUE} is not a valid transcript role'
        }
    },
    content: {
        type: String,
        required: [true, 'Content is required for transcript entry'],
        trim: true,
        maxlength: [10000, 'Content cannot exceed 10000 characters']
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    // Additional metadata for AI analysis
    metadata: {
        tokenCount: { type: Number, default: null },
        sentiment: { type: String, default: null },
        legalReferencesUsed: [{ type: String }]
    }
}, { _id: true });

/**
 * Scenario Schema
 * AI-generated case scenario for the roleplay session
 */
const scenarioSchema = new Schema({
    title: {
        type: String,
        required: [true, 'Scenario title is required'],
        trim: true,
        maxlength: [300, 'Title cannot exceed 300 characters']
    },
    facts: {
        type: String,
        required: [true, 'Case facts are required'],
        trim: true,
        maxlength: [5000, 'Facts cannot exceed 5000 characters']
    },
    legalIssues: {
        type: [String],
        required: [true, 'Legal issues are required'],
        validate: {
            validator: function (v) {
                return v && v.length > 0;
            },
            message: 'At least one legal issue is required'
        }
    },
    goal: {
        type: String,
        required: [true, 'Goal is required'],
        trim: true,
        maxlength: [2000, 'Goal cannot exceed 2000 characters']
    },
    // Sri Lankan Law specific fields
    relevantStatutes: [{
        name: { type: String, required: true },
        sections: [{ type: String }],
        description: { type: String }
    }],
    jurisdiction: {
        type: String,
        default: 'Sri Lanka',
        enum: ['Sri Lanka']
    },
    caseType: {
        type: String,
        enum: {
            values: ['Criminal', 'Civil', 'Commercial', 'Constitutional', 'Family', 'Labour'],
            message: '{VALUE} is not a valid case type'
        },
        default: 'Criminal'
    },
    difficulty: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        default: 'Intermediate'
    },
    // Parties involved in the case
    parties: {
        prosecution: { type: String, default: 'The State' },
        defense: { type: String, default: '' },
        victim: { type: String, default: '' },
        witnesses: [{ type: String }]
    }
}, { _id: false });

/**
 * Day Progress Schema
 * Tracks progress for each trial day
 */
const dayProgressSchema = new Schema({
    dayNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    stage: {
        type: String,
        enum: ['Opening', 'Examination', 'Cross-Examination', 'Arguments', 'Closing', 'Verdict'],
        default: 'Opening'
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    },
    summary: {
        type: String,
        default: ''
    },
    score: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    }
}, { _id: true });

/**
 * Trial Session Schema
 * Main schema for storing AI roleplay trial sessions
 */
const trialSessionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: [true, 'User ID is required'],
        ref: 'User',
        index: true
    },
    role: {
        type: String,
        required: [true, 'Role is required'],
        enum: {
            values: ['Lawyer', 'Opposition'],
            message: '{VALUE} is not a valid role. Must be either Lawyer or Opposition.'
        }
    },
    caseStage: {
        type: String,
        required: [true, 'Case stage is required'],
        trim: true,
        enum: {
            values: [
                'Pre-Trial',
                'Opening Statements',
                'Prosecution Evidence',
                'Defense Evidence',
                'Cross-Examination',
                'Closing Arguments',
                'Verdict',
                'Full Trial'
            ],
            message: '{VALUE} is not a valid case stage'
        }
    },
    status: {
        type: String,
        required: true,
        enum: {
            values: ['Active', 'Completed', 'Paused', 'Abandoned'],
            message: '{VALUE} is not a valid status'
        },
        default: 'Active'
    },
    scenario: {
        type: scenarioSchema,
        required: [true, 'Scenario is required']
    },
    transcript: {
        type: [transcriptEntrySchema],
        default: []
    },
    dayCount: {
        type: Number,
        required: true,
        default: 1,
        min: [1, 'Day count must be at least 1'],
        max: [10, 'Day count cannot exceed 10']
    },
    currentDay: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
    },
    dayProgress: {
        type: [dayProgressSchema],
        default: []
    },
    // AI Configuration used for this session
    aiConfig: {
        model: {
            type: String,
            default: 'gemini-2.5-flash-lite'
        },
        temperature: {
            type: Number,
            default: 0.7,
            min: 0,
            max: 2
        },
        maxTokens: {
            type: Number,
            default: 2000
        }
    },
    // Performance tracking
    performance: {
        overallScore: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        legalAccuracy: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        argumentation: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        statuteUsage: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        feedback: {
            type: String,
            default: null
        },
        evaluatedAt: {
            type: Date,
            default: null
        }
    },
    // Session metadata
    completedAt: {
        type: Date,
        default: null
    },
    totalDuration: {
        type: Number, // in seconds
        default: null
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for efficient querying
trialSessionSchema.index({ userId: 1, status: 1 });
trialSessionSchema.index({ userId: 1, createdAt: -1 });
trialSessionSchema.index({ status: 1, lastActivityAt: -1 });
trialSessionSchema.index({ 'scenario.caseType': 1 });

/**
 * Virtual: Message count
 */
trialSessionSchema.virtual('messageCount').get(function () {
    return this.transcript ? this.transcript.length : 0;
});

/**
 * Virtual: Is session active
 */
trialSessionSchema.virtual('isActive').get(function () {
    return this.status === 'Active';
});

/**
 * Virtual: Progress percentage
 */
trialSessionSchema.virtual('progressPercentage').get(function () {
    const stages = ['Pre-Trial', 'Opening Statements', 'Prosecution Evidence',
        'Defense Evidence', 'Cross-Examination', 'Closing Arguments', 'Verdict'];
    const currentIndex = stages.indexOf(this.caseStage);
    if (currentIndex === -1) return 0;
    return Math.round(((currentIndex + 1) / stages.length) * 100);
});

/**
 * Instance method: Add message to transcript
 */
trialSessionSchema.methods.addTranscriptEntry = function (role, content, metadata = {}) {
    this.transcript.push({
        role,
        content,
        timestamp: new Date(),
        metadata
    });
    this.lastActivityAt = new Date();
    return this.save();
};

/**
 * Instance method: Complete session
 */
trialSessionSchema.methods.completeSession = function (performance = {}) {
    this.status = 'Completed';
    this.completedAt = new Date();
    this.performance = {
        ...this.performance,
        ...performance,
        evaluatedAt: new Date()
    };
    this.totalDuration = Math.floor((this.completedAt - this.createdAt) / 1000);
    return this.save();
};

/**
 * Instance method: Advance to next day
 */
trialSessionSchema.methods.advanceDay = function () {
    if (this.currentDay < this.dayCount) {
        // Complete current day
        const currentDayProgress = this.dayProgress.find(d => d.dayNumber === this.currentDay);
        if (currentDayProgress) {
            currentDayProgress.completedAt = new Date();
        }

        // Start next day
        this.currentDay += 1;
        this.dayProgress.push({
            dayNumber: this.currentDay,
            stage: 'Opening',
            startedAt: new Date()
        });
        this.lastActivityAt = new Date();
        return this.save();
    }
    return this;
};

/**
 * Static method: Find active sessions for user
 */
trialSessionSchema.statics.findActiveByUser = function (userId) {
    return this.find({ userId, status: 'Active' })
        .sort({ lastActivityAt: -1 });
};

/**
 * Static method: Find completed sessions for user
 */
trialSessionSchema.statics.findCompletedByUser = function (userId) {
    return this.find({ userId, status: 'Completed' })
        .sort({ completedAt: -1 });
};

/**
 * Static method: Get user statistics
 */
trialSessionSchema.statics.getUserStats = async function (userId) {
    const stats = await this.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                completedSessions: {
                    $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
                },
                avgScore: { $avg: '$performance.overallScore' },
                totalDuration: { $sum: '$totalDuration' },
                rolesPlayed: { $addToSet: '$role' }
            }
        }
    ]);
    return stats[0] || {
        totalSessions: 0,
        completedSessions: 0,
        avgScore: null,
        totalDuration: 0,
        rolesPlayed: []
    };
};

const TrialSession = mongoose.model('TrialSession', trialSessionSchema);

export default TrialSession;

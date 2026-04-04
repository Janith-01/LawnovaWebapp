import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Trial Session Schema - Runtime state for a live trial
 * Handles time allocations, current stage, and synchronization.
 */
const trialSessionSchema = new Schema({
    roomId: {
        type: Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
        unique: true,
        index: true
    },
    totalDurationMinutes: {
        type: Number,
        required: true,
        default: 60
    },
    stages: [{
        name: { type: String, required: true },
        percentage: { type: Number, required: true },
        allocatedMinutes: { type: Number, required: true },
        status: {
            type: String,
            enum: ['pending', 'active', 'completed'],
            default: 'pending'
        },
        detectedKeywords: { type: [String], default: [] }, // Requirement 2
        isStageRequirementsMet: { type: Boolean, default: false }, // Requirement 1
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        totalPenaltyPoints: { type: Number, default: 0 }
    }],
    currentStageIndex: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: false
    },
    startedAt: {
        type: Date,
        default: null
    },
    lastPausedAt: {
        type: Date,
        default: null
    },
    totalPausedMs: {
        type: Number,
        default: 0
    },
    _lastPenaltyAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

const TrialSession = mongoose.model('TrialSession', trialSessionSchema);

export default TrialSession;

import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Available Trial Roles with their complexity weights
 * Higher complexity roles require better performing students
 */
export const TRIAL_ROLES = {
    JUDGE: { key: 'Judge', dbKey: 'judge', complexity: 5, required: 1 },
    DEFENSE_LAWYER: { key: 'Defense Lawyer', dbKey: 'defenseLawyer', complexity: 4, required: 1 },
    PROSECUTION_LAWYER: { key: 'Prosecution Lawyer', dbKey: 'prosecutionLawyer', complexity: 4, required: 1 },
    VICTIM: { key: 'Victim', dbKey: 'victim', complexity: 2, required: 1 },
    WITNESS: { key: 'Witness', dbKey: 'witness', complexity: 2, required: 0 }, // Flexible count
    CLIENT: { key: 'Client', dbKey: 'client', complexity: 3, required: 1 },
    JURY_FOREMAN: { key: 'Jury Foreman', dbKey: 'juryForeman', complexity: 3, required: 1 },
    EXPERT_WITNESS: { key: 'Expert Witness', dbKey: 'expertWitness', complexity: 4, required: 1 },
    EYEWITNESS: { key: 'Eyewitness', dbKey: 'eyewitness', complexity: 2, required: 1 },
    COURT_CLERK: { key: 'Court Clerk', dbKey: 'courtClerk', complexity: 2, required: 1 },
    BAILIFF: { key: 'Bailiff', dbKey: 'bailiff', complexity: 1, required: 1 },
    COURT_REPORTER: { key: 'Court Reporter', dbKey: 'courtReporter', complexity: 2, required: 1 },
    INVESTIGATING_OFFICER: { key: 'Investigating Officer', dbKey: 'investigatingOfficer', complexity: 3, required: 1 },

};

/**
 * Enhanced Participant Schema with role assignment tracking
 */
const participantSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    email: {
        type: String,
        required: [true, 'Participant email is required'],
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    // Initial role from invitation (can be 'Unassigned')
    invitedRole: {
        type: String,
        enum: {
            values: ['Judge', 'Defense Lawyer', 'Prosecution Lawyer', 'Victim', 'Witness', 'Client', 'Jury Foreman', 'Expert Witness', 'Eyewitness', 'Court Clerk', 'Bailiff', 'Court Reporter', 'Investigating Officer', 'Unassigned'],

            message: '{VALUE} is not a valid role'
        },
        default: 'Unassigned'
    },
    // Algorithmically assigned role (set by Fair Rotation Engine)
    assignedRole: {
        type: String,
        enum: {
            values: ['Judge', 'Defense Lawyer', 'Prosecution Lawyer', 'Victim', 'Witness', 'Client', 'Jury Foreman', 'Expert Witness', 'Eyewitness', 'Court Clerk', 'Bailiff', 'Court Reporter', 'Investigating Officer', null],

            message: '{VALUE} is not a valid assigned role'
        },
        default: null
    },
    roleAssignedAt: {
        type: Date,
        default: null
    },
    // Priority score calculated by algorithm (for transparency)
    rolePriorityScore: {
        type: Number,
        default: null
    },
    isSubstitute: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: {
            values: ['Pending', 'Accepted', 'Declined'],
            message: '{VALUE} is not a valid status'
        },
        default: 'Pending'
    },
    invitedAt: {
        type: Date,
        default: Date.now
    },
    // Performance metrics for this specific trial (post-trial)
    trialPerformance: {
        score: { type: Number, default: null },
        feedback: { type: String, default: null },
        evaluatedAt: { type: Date, default: null }
    }
}, { _id: true });

/**
 * Room Schema - Main schema for mock trial rooms
 */
const roomSchema = new Schema({
    topic: {
        type: String,
        required: [true, 'Trial topic is required'],
        trim: true,
        minlength: [5, 'Topic must be at least 5 characters'],
        maxlength: [200, 'Topic cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
        default: ''
    },
    scheduledDate: {
        type: Date,
        required: [true, 'Scheduled date is required']
    },
    scheduledTime: {
        type: String,
        required: [true, 'Scheduled time is required'],
        trim: true,
        match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
    },
    duration: {
        type: Number,
        default: 60, // Default duration in minutes
        min: [15, 'Duration must be at least 15 minutes'],
        max: [480, 'Duration cannot exceed 8 hours']
    },
    agenda: {
        type: String,
        trim: true,
        maxlength: [5000, 'Agenda cannot exceed 5000 characters'],
        default: ''
    },
    ownerId: {
        type: Schema.Types.ObjectId,
        required: [true, 'Owner ID is required'],
        index: true
    },
    participants: {
        type: [participantSchema],
        default: []
    },
    roomStatus: {
        type: String,
        enum: {
            values: ['Scheduled', 'RolesAssigned', 'Live', 'Completed'],
            message: '{VALUE} is not a valid room status'
        },
        default: 'Scheduled'
    },
    // Role assignment metadata
    roleAssignment: {
        isLocked: { type: Boolean, default: false },
        lockedAt: { type: Date, default: null },
        lockedBy: { type: Schema.Types.ObjectId, default: null },
        algorithmVersion: { type: String, default: null },
        assignmentLog: [{
            userId: Schema.Types.ObjectId,
            email: String,
            role: String,
            priorityScore: Number,
            reason: String,
            assignedAt: { type: Date, default: Date.now }
        }]
    },
    // Required roles configuration for this trial
    requiredRoles: {
        type: Map,
        of: Number,
        default: () => new Map([
            ['Judge', 1],
            ['Defense Lawyer', 1],
            ['Prosecution Lawyer', 1],
            ['Victim', 1],
            ['Witness', 2],
            ['Client', 1],
            ['Jury Foreman', 1],
            ['Expert Witness', 1],
            ['Eyewitness', 1],
            ['Court Clerk', 1],
            ['Bailiff', 1],
            ['Court Reporter', 1],
            ['Investigating Officer', 1]

        ])
    },
    // Unique room code for joining
    roomCode: {
        type: String,
        unique: true,
        sparse: true
    },
    // Meeting link (can be generated or set by user)
    meetingLink: {
        type: String,
        trim: true,
        default: ''
    },
    dailyRoomUrl: {
        type: String,
        trim: true,
        default: ''
    },
    dailyRoomName: {
        type: String,
        trim: true,
        default: ''
    },
    // Chat history with AI Legal Assistant
    chatHistory: [{
        sender: {
            type: String,
            enum: ['User', 'AI'],
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        userName: {
            type: String,
            default: null
        },
        message: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    // Session completion tracking
    completedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
roomSchema.index({ ownerId: 1, scheduledDate: -1 });
roomSchema.index({ 'participants.email': 1 });
roomSchema.index({ 'participants.userId': 1 });
roomSchema.index({ roomStatus: 1 });
roomSchema.index({ 'roleAssignment.isLocked': 1 });

// Generate unique room code before saving
roomSchema.pre('save', async function (next) {
    if (!this.roomCode) {
        this.roomCode = generateRoomCode();
    }
    next();
});

/**
 * Generate a unique 8-character room code
 */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Virtual for participant count
roomSchema.virtual('participantCount').get(function () {
    return this.participants.length;
});

// Virtual for accepted participants count
roomSchema.virtual('acceptedCount').get(function () {
    return this.participants.filter(p => p.status === 'Accepted').length;
});

// Virtual for assigned roles count
roomSchema.virtual('assignedCount').get(function () {
    return this.participants.filter(p => p.assignedRole !== null).length;
});

// Instance method to check if user is owner
roomSchema.methods.isOwner = function (userId) {
    return this.ownerId.toString() === userId.toString();
};

// Instance method to check if user is participant
roomSchema.methods.isParticipant = function (email) {
    return this.participants.some(p => p.email === email.toLowerCase());
};

// Instance method to check if roles are locked
roomSchema.methods.isRolesLocked = function () {
    return this.roleAssignment.isLocked === true;
};

// Instance method to get participants by assigned role
roomSchema.methods.getParticipantsByRole = function (role) {
    return this.participants.filter(p => p.assignedRole === role);
};

// Static method to find rooms by user (owner or participant)
roomSchema.statics.findByUser = async function (userId, userEmail) {
    return this.find({
        $or: [
            { ownerId: userId },
            { 'participants.email': userEmail?.toLowerCase() },
            { 'participants.userId': userId }
        ]
    }).sort({ scheduledDate: -1 });
};

const Room = mongoose.model('Room', roomSchema);

export default Room;

import mongoose from 'mongoose';

const masteryTrackerSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        roomId: {
            type: String, // String ID for room cross-service reference
            required: true
        },
        topic: {
            type: String,
            required: true,
            default: 'General Legal Practice'
        },
        quizScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        totalQuestions: {
            type: Number,
            required: true
        },
        correctAnswers: {
            type: Number,
            required: true
        },
        answers: [{
            questionIndex: Number,
            userAnswer: Number,
            correct: Boolean
        }],
        completedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model('MasteryTracker', masteryTrackerSchema);

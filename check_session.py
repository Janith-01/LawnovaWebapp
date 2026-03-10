import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '../.env' });

const HistoryEntrySchema = new mongoose.Schema({
    role: String,
    content: String,
    speaker: String,
    speakerRole: String,
    action: String,
    mood: String,
    winProbability: Number
}, { _id: False });

const roleplaySessionSchema = new mongoose.Schema({
    sessionId: String,
    history: [HistoryEntrySchema],
    auditReport: [{
        originalText: String,
        score: Number,
        verdict: String,
        reason: String
    }],
    verdict: mongoose.Schema.Types.Mixed
});

const RoleplaySession = mongoose.model('RoleplaySession', roleplaySessionSchema);

async function checkSession(sessionId) {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lawnova');
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) {
            print(f"Session {sessionId} not found.");
            return;
        }
        print(f"Session: {session.sessionId}");
        print(f"History count: {len(session.history)}");
        print(f"Audit report count: {len(session.auditReport)}");
        for r in session.auditReport:
            print(f" - {r.originalText[:30]}... | {r.verdict} | {r.score}")
    } finally {
        await mongoose.disconnect();
    }
}

// sessionId from screenshot: rp_mmivo3bb_yphjui
checkSession('rp_mmivo3bb_yphjui');

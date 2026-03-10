import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const roleplaySessionSchema = new mongoose.Schema({
    sessionId: String,
    history: Array,
    auditReport: Array,
    verdict: mongoose.Schema.Types.Mixed
});

const RoleplaySession = mongoose.models.RoleplaySession || mongoose.model('RoleplaySession', roleplaySessionSchema);

async function checkSession(sessionId) {
    try {
        console.log(`Connecting to ${process.env.MONGODB_URI || 'mongodb://localhost:27017/lawnova'}...`);
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lawnova');
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) {
            console.log(`Session ${sessionId} not found.`);
            return;
        }
        console.log(`Session: ${session.sessionId}`);
        console.log(`History count: ${session.history?.length || 0}`);
        console.log(`Audit report count: ${session.auditReport?.length || 0}`);
        (session.auditReport || []).forEach(r => {
            console.log(` - ${r.originalText?.substring(0, 30)}... | ${r.verdict} | ${r.score}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

const sid = process.argv[2] || 'rp_mmivo3bb_yphjui';
checkSession(sid);

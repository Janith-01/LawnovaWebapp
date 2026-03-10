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
    auditReport: Array
});

const RoleplaySession = mongoose.models.RoleplaySession || mongoose.model('RoleplaySession', roleplaySessionSchema);

async function checkReasoning(sessionId) {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) return;
        (session.auditReport || []).forEach(r => {
            if (r.verdict === 'Strong') {
                console.log(`\nArgument: ${r.originalText}`);
                console.log(`Verdict: ${r.verdict}`);
                console.log(`Reason: ${r.reason}`);
            }
        });
    } finally {
        await mongoose.disconnect();
    }
}

checkReasoning(process.argv[2] || 'rp_mmivo3bb_yphjui');

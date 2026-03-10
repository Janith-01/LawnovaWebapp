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
    verdict: mongoose.Schema.Types.Mixed,
    status: String
});

const RoleplaySession = mongoose.models.RoleplaySession || mongoose.model('RoleplaySession', roleplaySessionSchema);

async function reAuditSession(sessionId) {
    try {
        console.log(`Connecting to DB...`);
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lawnova');
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) {
            console.log(`Session ${sessionId} not found.`);
            return;
        }

        console.log(`Auditing session ${sessionId} with ${session.history.length} messages...`);
        const auditUrl = 'http://127.0.0.1:5002/api/audit-transcript';

        const response = await fetch(auditUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: session.history })
        });

        const data = await response.json();

        if (data?.status === 'success') {
            const results = data.results;
            const auditReport = results.map(r => ({
                originalText: r.argument,
                score: r.score,
                verdict: r.status,
                reason: r.reason
            }));

            session.auditReport = auditReport;
            await session.save();
            console.log(`Successfully re-audited and saved ${auditReport.length} arguments.`);
        } else {
            console.log(`Audit service returned error:`, data);
        }
    } catch (err) {
        console.error(`Error:`, err.message);
    } finally {
        await mongoose.disconnect();
    }
}

const sid = process.argv[2] || 'rp_mmivo3bb_yphjui';
reAuditSession(sid);

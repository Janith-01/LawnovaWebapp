import { Router } from 'express';
import { streamChat, askAgent, testConnection, generateLearningMaterials } from '../controllers/aiController.js';
import transcriptIngestion from '../services/transcriptIngestionService.js';
import { predictJudgment, getMockCases } from '../controllers/predictionController.js';

const router = Router();

/**
 * @route   GET /ai/test
 * @desc    Test Gemini AI connection
 * @access  Private
 */
router.get('/test', testConnection);

/**
 * @route   POST /ai/chat/stream
 * @desc    Stream chat completions for AI Legal Assistant
 * @access  Private
 */
router.post('/chat/stream', streamChat);
router.post('/chat/ask', askAgent);

/**
 * @route   POST /ai/predict-judgment
 * @desc    Predict legal judgment based on case facts
 * @access  Public
 */
router.post('/predict-judgment', predictJudgment);

/**
 * @route   POST /ai/generate-learning
 * @desc    Generate learning materials from transcript via RAG/Gemini
 * @access  Internal
 */
router.post('/generate-learning', generateLearningMaterials);

/**
 * @route   GET /ai/cases
 * @desc    Get reference cases
 * @access  Public
 */
router.get('/cases', getMockCases);

/**
 * @route   POST /ai/transcript/ingest
 * @desc    Receive live transcript updates from mocktrial-service
 * @access  Internal (from mocktrial-service)
 * 
 * @body    {
 *   type: 'TRANSCRIPTION_MESSAGE' | 'TRANSCRIPT_READY',
 *   roomId: string,
 *   sessionId: string,
 *   message: { speakerRole, speakerName, text, timestamp, confidence }
 * }
 */
router.post('/transcript/ingest', (req, res) => {
    const { type, roomId, sessionId, message, ...data } = req.body;

    console.log('[AI Service] Transcript ingestion:', type, sessionId);

    try {
        if (type === 'TRANSCRIPTION_MESSAGE' && message) {
            // Real-time message ingestion
            transcriptIngestion.ingestMessage(sessionId || roomId, message);
            res.json({ success: true, ingested: true });
        } else if (type === 'TRANSCRIPT_READY') {
            // Full transcript ready for analysis
            transcriptIngestion.updateMetadata(sessionId || roomId, {
                status: 'completed',
                messageCount: data.messageCount,
                speakerSummary: data.speakerSummary
            });
            res.json({ success: true, status: 'marked_ready' });
        } else if (type === 'METADATA_UPDATE') {
            // Update stage or other trial state
            transcriptIngestion.updateMetadata(sessionId || roomId, req.body.metadata || {});
            res.json({ success: true, status: 'metadata_updated' });
        } else {
            res.json({ success: true, ignored: true });
        }
    } catch (error) {
        console.error('[AI Service] Ingestion error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /ai/transcript/sessions
 * @desc    Get active transcript sessions
 * @access  Internal
 */
router.get('/transcript/sessions', (req, res) => {
    const sessions = transcriptIngestion.getActiveSessions();
    res.json({ success: true, data: { sessions } });
});

/**
 * @route   GET /ai/transcript/:sessionId/context
 * @desc    Get transcript context for a session
 * @access  Internal
 */
router.get('/transcript/:sessionId/context', (req, res) => {
    const { sessionId } = req.params;
    const { maxMessages } = req.query;

    const context = transcriptIngestion.getContext(sessionId, parseInt(maxMessages) || 10);

    if (!context) {
        return res.json({ success: true, data: { messages: [], sessionId } });
    }

    res.json({ success: true, data: context });
});

export default router;

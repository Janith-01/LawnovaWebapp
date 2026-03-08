import axios from 'axios';

class TranscriptIngestionService {
    constructor() {
        this.transcriptCache = new Map();
        this.maxMessagesPerSession = 100; // Increased window for better analysis
        this.cacheTTL = 30 * 60 * 1000;
        this.penaltyCheckInterval = 30000; // Requirement 2: 30-second window
    }

    ingestMessage(sessionId, message) {
        if (!sessionId || !message) return;

        if (!this.transcriptCache.has(sessionId)) {
            this.transcriptCache.set(sessionId, {
                messages: [],
                metadata: {
                    currentStage: 'Opening Statements' // Default
                },
                lastUpdated: Date.now(),
                lastPenaltyCheckAt: 0
            });
        }

        const session = this.transcriptCache.get(sessionId);

        // Track time for window logic
        const now = Date.now();

        session.messages.push({
            speakerRole: message.speakerRole || 'Unknown',
            speakerName: message.speakerName || 'Speaker',
            text: message.text,
            timestamp: message.timestamp || new Date(),
            confidence: message.confidence
        });

        // Parallel Stage Validation (Requirement 4: Safety Rule)
        // Only run every 30 seconds to avoid API spam
        if (now - session.lastPenaltyCheckAt > this.penaltyCheckInterval) {
            session.lastPenaltyCheckAt = now;
            this.runPenaltyValidation(sessionId, session);
        }

        // Keep only last N messages
        if (session.messages.length > this.maxMessagesPerSession) {
            session.messages = session.messages.slice(-this.maxMessagesPerSession);
        }

        session.lastUpdated = now;
        console.log(`[TranscriptIngestion] Session ${sessionId}: ${session.messages.length} messages`);
    }

    /**
     * Requirement 1 & 2: Trigger Stage Validator in Python core
     */
    async runPenaltyValidation(sessionId, session) {
        try {
            const now = Date.now();
            // Get last 30 seconds of transcript context
            const windowText = session.messages
                .filter(m => (now - new Date(m.timestamp).getTime()) < 35000)
                .map(m => m.text)
                .join(' ');

            if (!windowText.trim()) return;

            const pythonUrl = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:5009';
            const currentStage = session.metadata?.currentStage || 'Opening Statements';

            console.log(`[AI Penalty] Validating stage: ${currentStage} for session: ${sessionId}`);

            // 🔥 Run this in parallel (Safety Rule)
            axios.post(`${pythonUrl}/validate-stage`, {
                transcript: windowText,
                stage: currentStage,
                roomId: sessionId
            }).then(async (resp) => {
                if (resp.data.success && resp.data.found_keywords?.length > 0) {
                    console.log(`[AI Penalty] Found ${resp.data.found_keywords.length} keywords in stage ${currentStage}`);

                    // Requirement 2: Notify MockTrial Service to aggregate keywords (Requirement 1 & 2)
                    const mocktrialUrl = process.env.MOCKTRIAL_SERVICE_URL || 'http://localhost:10004';
                    await axios.post(`${mocktrialUrl}/api/rooms/${sessionId}/session/update-requirements`, {
                        foundKeywords: resp.data.found_keywords,
                        isMet: resp.data.valid
                    }).catch(err => console.debug('[AI Penalty] Sync Error:', err.message));
                }
            }).catch(err => console.debug('[AI Penalty] Pipeline Skip:', err.message));

        } catch (error) {
            console.error('[AI Penalty] Validator Trigger Error:', error.message);
        }
    }

    /**
     * Get transcript context for a session
     */
    getContext(sessionId, maxMessages = 10) {
        const session = this.transcriptCache.get(sessionId);

        if (!session) {
            return null;
        }

        // Check TTL
        if (Date.now() - session.lastUpdated > this.cacheTTL) {
            this.transcriptCache.delete(sessionId);
            return null;
        }

        const recentMessages = session.messages.slice(-maxMessages);

        return {
            sessionId,
            messageCount: session.messages.length,
            lastUpdated: session.lastUpdated,
            formatted: recentMessages.map(m =>
                `[${m.speakerRole}] ${m.text}`
            ).join('\n'),
            messages: recentMessages,
            metadata: session.metadata
        };
    }

    /**
     * Update session metadata
     */
    updateMetadata(sessionId, metadata) {
        const session = this.transcriptCache.get(sessionId);
        if (session) {
            session.metadata = { ...session.metadata, ...metadata };
        }
    }

    /**
     * Clear session cache
     */
    clearSession(sessionId) {
        this.transcriptCache.delete(sessionId);
    }

    /**
     * Get all active sessions
     */
    getActiveSessions() {
        const now = Date.now();
        const active = [];

        for (const [sessionId, session] of this.transcriptCache.entries()) {
            if (now - session.lastUpdated < this.cacheTTL) {
                active.push({
                    sessionId,
                    messageCount: session.messages.length,
                    lastUpdated: session.lastUpdated
                });
            } else {
                this.transcriptCache.delete(sessionId);
            }
        }

        return active;
    }

    /**
     * Analyze argument strength based on transcript context
     */
    analyzeContext(sessionId) {
        const context = this.getContext(sessionId);
        if (!context) return null;

        // Simple analysis of transcript patterns
        const analysis = {
            totalExchanges: context.messageCount,
            speakerDistribution: {},
            keyPhrases: [],
            suggestedTopics: []
        };

        // Count speaker contributions
        for (const msg of context.messages) {
            const role = msg.speakerRole;
            analysis.speakerDistribution[role] = (analysis.speakerDistribution[role] || 0) + 1;
        }

        // Extract potential legal keywords
        const legalTerms = ['section', 'evidence', 'witness', 'objection', 'sustained',
            'overruled', 'guilty', 'innocent', 'prosecution', 'defense', 'murder',
            'theft', 'negligence', 'intent', 'reasonable doubt'];

        const allText = context.messages.map(m => m.text.toLowerCase()).join(' ');
        for (const term of legalTerms) {
            if (allText.includes(term)) {
                analysis.keyPhrases.push(term);
            }
        }

        return analysis;
    }
}

// Export singleton
const transcriptIngestion = new TranscriptIngestionService();
export default transcriptIngestion;

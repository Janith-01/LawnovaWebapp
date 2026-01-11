class TranscriptIngestionService {
    constructor() {
        this.transcriptCache = new Map();
        this.maxMessagesPerSession = 50;
        this.cacheTTL = 30 * 60 * 1000;
    }


    ingestMessage(sessionId, message) {
        if (!sessionId || !message) return;

        if (!this.transcriptCache.has(sessionId)) {
            this.transcriptCache.set(sessionId, {
                messages: [],
                metadata: {},
                lastUpdated: Date.now()
            });
        }

        const session = this.transcriptCache.get(sessionId);

        session.messages.push({
            speakerRole: message.speakerRole || 'Unknown',
            speakerName: message.speakerName || 'Speaker',
            text: message.text,
            timestamp: message.timestamp || new Date(),
            confidence: message.confidence
        });

        // Keep only last N messages
        if (session.messages.length > this.maxMessagesPerSession) {
            session.messages = session.messages.slice(-this.maxMessagesPerSession);
        }

        session.lastUpdated = Date.now();

        console.log(`[TranscriptIngestion] Session ${sessionId}: ${session.messages.length} messages`);
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

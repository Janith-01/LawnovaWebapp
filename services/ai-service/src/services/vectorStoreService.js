/**
 * Vector Store Service - Localized RAG Pipeline
 * 
 * Provides semantic search over Sri Lankan legal corpus using:
 * 1. In-memory TF-IDF based search (default, no external dependencies)
 * 2. Optional: Pinecone integration for production scale
 * 
 * The in-memory implementation is optimized for the legal domain and 
 * provides fast, accurate retrieval without requiring external services.
 */

import { getAllDocuments, TRIAL_STAGES } from '../data/legalKnowledgeBase.js';

class VectorStoreService {
    constructor() {
        this.documents = [];
        this.termFrequencies = new Map();
        this.documentFrequencies = new Map();
        this.totalDocuments = 0;
        this.initialized = false;
        this.pineconeClient = null;
    }

    /**
     * Initialize the vector store with legal knowledge base
     */
    async init() {
        if (this.initialized) return;

        console.log('[VectorStore] Initializing with Sri Lankan legal corpus...');

        // Load all documents from knowledge base
        this.documents = getAllDocuments();
        this.totalDocuments = this.documents.length;

        // Build TF-IDF index
        this._buildIndex();

        // Optionally initialize Pinecone if configured
        if (process.env.PINECONE_API_KEY) {
            await this._initPinecone();
        }

        this.initialized = true;
        console.log(`[VectorStore] Initialized with ${this.totalDocuments} documents`);
    }

    /**
     * Build TF-IDF index for semantic search
     */
    _buildIndex() {
        // Calculate document frequencies
        for (const doc of this.documents) {
            const terms = this._tokenize(doc.content);
            const uniqueTerms = new Set(terms);

            // Store term frequencies for this document
            const tf = new Map();
            for (const term of terms) {
                tf.set(term, (tf.get(term) || 0) + 1);
            }
            this.termFrequencies.set(doc.id, tf);

            // Update document frequencies
            for (const term of uniqueTerms) {
                this.documentFrequencies.set(term, (this.documentFrequencies.get(term) || 0) + 1);
            }
        }

        console.log(`[VectorStore] Built index with ${this.documentFrequencies.size} unique terms`);
    }

    /**
     * Tokenize text into terms
     */
    _tokenize(text) {
        if (!text) return [];

        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(term => term.length > 2)
            .filter(term => !this._isStopWord(term));
    }

    /**
     * Check if term is a stop word
     */
    _isStopWord(term) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
            'before', 'after', 'above', 'below', 'between', 'under', 'again',
            'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
            'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
            'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
            'can', 'will', 'just', 'should', 'now', 'also', 'which', 'that', 'this',
            'these', 'those', 'what', 'who', 'whom', 'whose', 'may', 'shall', 'any',
            'been', 'being', 'have', 'has', 'had', 'having', 'does', 'did', 'doing',
            'would', 'could', 'might', 'must', 'was', 'were', 'are', 'is', 'am', 'be'
        ]);
        return stopWords.has(term);
    }

    /**
     * Calculate TF-IDF score for a term in a document
     */
    _tfidf(term, docId) {
        const tf = this.termFrequencies.get(docId)?.get(term) || 0;
        if (tf === 0) return 0;

        const df = this.documentFrequencies.get(term) || 0;
        if (df === 0) return 0;

        const idf = Math.log(this.totalDocuments / df);
        return tf * idf;
    }

    /**
     * Search for relevant documents
     * @param {string} query - Search query
     * @param {number} topK - Number of results to return
     * @param {Object} filters - Optional filters (type, category)
     * @returns {Array} Ranked documents with scores
     */
    async search(query, topK = 5, filters = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const queryTerms = this._tokenize(query);

        if (queryTerms.length === 0) {
            return [];
        }

        // Calculate scores for all documents
        const scores = [];

        for (const doc of this.documents) {
            // Apply filters
            if (filters.type && doc.type !== filters.type) continue;
            if (filters.category && doc.metadata?.category !== filters.category) continue;

            // Calculate TF-IDF score
            let score = 0;
            for (const term of queryTerms) {
                score += this._tfidf(term, doc.id);
            }

            // Boost score based on keyword matches in metadata
            if (doc.metadata?.keywords) {
                const keywordMatch = doc.metadata.keywords.some(kw =>
                    queryTerms.some(qt => kw.toLowerCase().includes(qt))
                );
                if (keywordMatch) {
                    score *= 1.5;
                }
            }

            // Boost exact section matches
            if (doc.metadata?.section) {
                const sectionMatch = query.toLowerCase().includes(doc.metadata.section.toLowerCase());
                if (sectionMatch) {
                    score *= 2.0;
                }
            }

            if (score > 0) {
                scores.push({
                    document: doc,
                    score,
                    relevanceReason: this._explainRelevance(doc, queryTerms)
                });
            }
        }

        // Sort by score and return top K
        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, topK);
    }

    /**
     * Explain why a document is relevant
     */
    _explainRelevance(doc, queryTerms) {
        const docTerms = this._tokenize(doc.content);
        const matchedTerms = queryTerms.filter(qt => docTerms.includes(qt));

        if (matchedTerms.length === 0) return 'Semantic similarity';

        return `Matches: ${matchedTerms.slice(0, 5).join(', ')}`;
    }

    /**
     * Get trial stage guidance
     */
    getTrialStageGuidance(stage) {
        return TRIAL_STAGES[stage] || null;
    }

    /**
     * Semantic search combining legal knowledge with trial context
     */
    async searchWithContext(query, trialContext = {}) {
        const results = await this.search(query, 5);

        // Add trial stage guidance if applicable
        if (trialContext.currentStage && TRIAL_STAGES[trialContext.currentStage]) {
            const stageGuidance = TRIAL_STAGES[trialContext.currentStage];
            results.unshift({
                document: {
                    id: 'stage-guidance',
                    type: 'trial_guidance',
                    content: `Current Stage: ${trialContext.currentStage}\n\n${stageGuidance.description}\n\nTips:\n${stageGuidance.tips.map(t => `• ${t}`).join('\n')}`,
                    metadata: { type: 'guidance' }
                },
                score: 1.5,
                relevanceReason: 'Current trial stage guidance'
            });
        }

        return results;
    }

    /**
     * Initialize Pinecone for production (optional)
     */
    async _initPinecone() {
        try {
            // Dynamic import for Pinecone (optional dependency)
            const { Pinecone } = await import('@pinecone-database/pinecone');

            this.pineconeClient = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY
            });

            console.log('[VectorStore] Pinecone client initialized');
        } catch (error) {
            console.log('[VectorStore] Pinecone not available, using in-memory search');
        }
    }

    /**
     * Get document by ID
     */
    getDocument(docId) {
        return this.documents.find(d => d.id === docId) || null;
    }

    /**
     * Get all documents of a specific type
     */
    getDocumentsByType(type) {
        return this.documents.filter(d => d.type === type);
    }

    /**
     * Get statistics about the knowledge base
     */
    getStats() {
        const stats = {
            totalDocuments: this.totalDocuments,
            byType: {
                penal_code: this.documents.filter(d => d.type === 'penal_code').length,
                syllabus: this.documents.filter(d => d.type === 'syllabus').length,
                case_law: this.documents.filter(d => d.type === 'case_law').length
            },
            uniqueTerms: this.documentFrequencies.size,
            isPineconeEnabled: !!this.pineconeClient
        };
        return stats;
    }
}

// Export singleton instance
const vectorStore = new VectorStoreService();
export default vectorStore;

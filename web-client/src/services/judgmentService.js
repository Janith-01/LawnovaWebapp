import api from './api';

/**
 * Judgment Prediction Service
 * Routes through API Gateway: /api/judgment/* → judgment-prediction-service (8000)
 */
const judgmentService = {
    /**
     * Predict judgment outcome from free-text case facts
     * @param {string} text - The case facts / scenario text
     * @returns {Promise} - { prediction, confidence: { dismissed, allowed } }
     */
    predictJudgment: async (text) => {
        const response = await api.post('/api/judgment/predict/judgment', null, {
            params: { text },
        });
        return response.data;
    },

    /**
     * Predict judgment with AI-generated explanation (Gemini + RAG)
     * @param {string} text - The case facts / scenario text
     * @param {string} [caseNumber] - Optional case number for context
     * @returns {Promise} - { prediction, confidence, explanation, citing_documents }
     */
    predictWithExplanation: async (text, caseNumber = null) => {
        const params = { text };
        if (caseNumber) params.case_number = caseNumber;
        const response = await api.post('/api/judgment/predict/with-explanation', null, {
            params,
        });
        return response.data;
    },

    /**
     * Predict by existing case number (lookup + predict)
     * @param {string} caseNumber - The case number to look up
     * @returns {Promise}
     */
    predictByCaseNumber: async (caseNumber) => {
        const response = await api.post('/api/judgment/predict/by-case-number', null, {
            params: { case_number: caseNumber },
        });
        return response.data;
    },

    /**
     * Semantic search over judgments and acts
     * @param {string} query - Search query
     * @param {number} [limit=5] - Max results
     * @returns {Promise}
     */
    searchDocuments: async (query, limit = 5) => {
        const response = await api.post('/api/judgment/search', null, {
            params: { query, limit },
        });
        return response.data;
    },

    /**
     * Get dashboard stats for the judgment prediction service
     * @returns {Promise}
     */
    getDashboardStats: async () => {
        const response = await api.get('/api/judgment/dashboard/stats');
        return response.data;
    },
};

export default judgmentService;

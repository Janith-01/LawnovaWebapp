import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * Service Client for inter-service communication
 * Handles HTTP requests to other microservices
 */
class ServiceClient {
    constructor() {
        this.clients = {};
        this.initialized = false;
    }

    /**
     * Initialize service clients with configuration
     */
    init() {
        if (this.initialized) return;

        // User Service Client
        this.clients.userService = axios.create({
            baseURL: process.env.USER_SERVICE_URL || 'http://127.0.0.1:3001',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Name': 'mocktrial-service'
            }
        });

        // AI Service Client
        this.clients.aiService = axios.create({
            baseURL: process.env.AI_SERVICE_URL || 'http://127.0.0.1:5008',
            timeout: 30000, // AI requests may take longer
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Name': 'mocktrial-service'
            }
        });

        // API Gateway Client (for notifications)
        this.clients.gateway = axios.create({
            baseURL: process.env.API_GATEWAY_URL || 'http://127.0.0.1:3000',
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Name': 'mocktrial-service'
            }
        });

        // Add request/response interceptors for logging
        Object.entries(this.clients).forEach(([name, client]) => {
            client.interceptors.request.use(
                (config) => {
                    logger.debug({ service: name, url: config.url }, 'Outgoing service request');
                    return config;
                },
                (error) => {
                    logger.error({ service: name, error: error.message }, 'Service request error');
                    return Promise.reject(error);
                }
            );

            client.interceptors.response.use(
                (response) => response,
                (error) => {
                    if (error.response) {
                        logger.warn({
                            service: name,
                            status: error.response.status,
                            data: error.response.data
                        }, 'Service response error');
                    } else if (error.code === 'ECONNREFUSED') {
                        logger.error({ service: name }, 'Service unavailable - connection refused');
                    }
                    return Promise.reject(error);
                }
            );
        });

        this.initialized = true;
        logger.info('Service clients initialized');
    }

    /**
     * Get user data including mock trial profile
     * @param {string} userId - User ID
     * @returns {Object} User data with roleHistory
     */
    async getUserProfile(userId) {
        try {
            const response = await this.clients.userService.get(`/api/users/${userId}/profile`);
            return response.data.data?.user || response.data;
        } catch (error) {
            logger.error({ userId, error: error.message }, 'Failed to fetch user profile');
            // Return default profile if service unavailable
            return this._getDefaultUserProfile(userId);
        }
    }

    /**
     * Get multiple users' mock trial profiles by their emails
     * @param {string[]} emails - Array of user emails
     * @returns {Object[]} Array of user profiles
     */
    async getUsersByEmails(emails) {
        try {
            const response = await this.clients.userService.post('/api/users/by-emails', { emails });
            return response.data.data?.users || [];
        } catch (error) {
            logger.error({ emails, error: error.message }, 'Failed to fetch users by emails');
            // Return empty profiles for fallback
            return emails.map(email => this._getDefaultUserProfile(null, email));
        }
    }

    /**
     * Get user's performance score from AI service
     * @param {string} userId - User ID
     * @returns {Object} Performance data
     */
    async getUserPerformance(userId) {
        try {
            const response = await this.clients.aiService.get(`/api/performance/${userId}`);
            return response.data.data || { score: 50, syllabusProgress: {} };
        } catch (error) {
            logger.warn({ userId, error: error.message }, 'AI service unavailable, using default performance');
            return { score: 50, syllabusProgress: {} };
        }
    }

    /**
     * Update user's role history after trial
     * @param {string} userId - User ID
     * @param {string} role - Role played
     */
    async updateUserRoleHistory(userId, role) {
        try {
            await this.clients.userService.patch(`/api/users/${userId}/mock-trial-profile`, {
                incrementRole: role,
                lastTrialDate: new Date()
            });
            logger.info({ userId, role }, 'User role history updated');
        } catch (error) {
            logger.error({ userId, role, error: error.message }, 'Failed to update user role history');
        }
    }

    /**
     * Send notification to user via API gateway
     * @param {string} userId - User ID
     * @param {Object} notification - Notification payload
     */
    async sendNotification(userId, notification) {
        try {
            await this.clients.gateway.post('/api/notifications', {
                userId,
                type: 'ROLE_ASSIGNMENT',
                ...notification
            });
            logger.info({ userId }, 'Notification sent');
        } catch (error) {
            logger.warn({ userId, error: error.message }, 'Failed to send notification');
        }
    }

    /**
     * Batch send notifications
     * @param {Object[]} notifications - Array of { userId, notification }
     */
    async sendBatchNotifications(notifications) {
        const results = await Promise.allSettled(
            notifications.map(({ userId, notification }) =>
                this.sendNotification(userId, notification)
            )
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        logger.info({ succeeded, failed }, 'Batch notifications completed');
        return { succeeded, failed };
    }

    // ============================================
    // AI SERVICE METHODS
    // ============================================

    /**
     * Stream transcription message to AI service for real-time processing
     * @param {Object} data - Transcription message data
     */
    async streamTranscription(data) {
        try {
            await this.clients.aiService.post('/api/transcription/stream', data);
        } catch (error) {
            // Non-blocking - log but don't throw
            logger.debug({ error: error.message }, 'AI transcription stream failed');
        }
    }

    /**
     * Send completed transcript to AI service for processing
     * @param {Object} transcriptData - Complete transcript data
     */
    async sendToAIService(transcriptData) {
        try {
            // Use the transcript ingestion endpoint
            const response = await this.clients.aiService.post('/ai/transcript/ingest', transcriptData);
            logger.info({
                transcriptId: transcriptData.transcriptId,
                type: transcriptData.type
            }, 'Transcript sent to AI service');
            return response.data;
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to send transcript to AI service');
            // Non-blocking - don't throw as this is a secondary operation
            return null;
        }
    }

    /**
     * Request quiz generation from AI service
     * @param {string} transcriptId - Transcript ID
     * @param {Object} options - Quiz generation options
     */
    async generateQuiz(transcriptId, options = {}) {
        try {
            const response = await this.clients.aiService.post('/api/quiz/generate', {
                transcriptId,
                ...options
            });
            logger.info({ transcriptId }, 'Quiz generation requested');
            return response.data;
        } catch (error) {
            logger.error({ transcriptId, error: error.message }, 'Quiz generation request failed');
            throw error;
        }
    }

    /**
     * Get AI analysis for a transcript
     * @param {string} transcriptId - Transcript ID
     */
    async getTranscriptAnalysis(transcriptId) {
        try {
            const response = await this.clients.aiService.get(`/api/analysis/${transcriptId}`);
            return response.data.data;
        } catch (error) {
            logger.warn({ transcriptId, error: error.message }, 'Transcript analysis unavailable');
            return null;
        }
    }

    /**
     * Update student performance based on trial
     * @param {string} userId - User ID
     * @param {Object} performanceData - Performance metrics
     */
    async updatePerformance(userId, performanceData) {
        try {
            await this.clients.aiService.post('/api/performance/update', {
                userId,
                ...performanceData
            });
            logger.info({ userId }, 'Performance updated in AI service');
        } catch (error) {
            logger.warn({ userId, error: error.message }, 'Performance update failed');
        }
    }

    /**
     * Get default user profile when service is unavailable
     */
    _getDefaultUserProfile(userId, email = null) {
        return {
            _id: userId,
            email,
            fullName: email ? email.split('@')[0] : 'Unknown',
            mockTrialProfile: {
                roleCounts: {
                    judge: 0,
                    defenseLawyer: 0,
                    prosecutionLawyer: 0,
                    victim: 0,
                    witness: 0,
                    client: 0
                },
                performanceScore: 50,
                syllabusProgress: {
                    crossExamination: 0,
                    legalArgumentation: 0,
                    caseAnalysis: 0,
                    courtProcedure: 0,
                    evidencePresentation: 0
                },
                totalTrialsParticipated: 0
            }
        };
    }
}

// Export singleton instance
const serviceClient = new ServiceClient();
export default serviceClient;


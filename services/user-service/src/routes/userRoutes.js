import express from 'express';
import {
  getMeController,
  updateMeController,
  changePasswordController,
  deactivateAccountController,
  searchUsers,
  getUserProfileById,
  getUsersByEmails,
  updateMockTrialProfile,
  updateMasteryTrackerController,
} from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  updateProfileSchema,
  changePasswordSchema,
} from '../utils/validators.js';

const router = express.Router();

// ============================================
// SEARCH ENDPOINT (Before authenticated routes)
// ============================================

/**
 * GET /search
 * Search for users by name or email
 */
router.get('/search', searchUsers);

// ============================================
// AUTHENTICATED USER ENDPOINTS
// ============================================

/**
 * GET /me
 * Get current user profile
 */
router.get('/me', requireAuth, getMeController);

/**
 * PATCH /me
 * Update current user profile
 */
router.patch('/me', requireAuth, validate(updateProfileSchema), updateMeController);

/**
 * POST /me/change-password
 * Change current user password
 */
router.post('/me/change-password', requireAuth, validate(changePasswordSchema), changePasswordController);

/**
 * POST /me/deactivate
 * Deactivate own account
 */
router.post('/me/deactivate', requireAuth, deactivateAccountController);

/**
 * POST /mastery-tracker
 * Sync quiz results to mastery tracker
 */
router.post('/mastery-tracker', requireAuth, updateMasteryTrackerController);

// ============================================
// MOCK TRIAL SERVICE INTEGRATION
// Service-to-Service endpoints (no auth required)
// These endpoints are called by mocktrial-service
// ============================================

/**
 * GET /users/:userId/profile
 * Get user profile by ID (for mock trial role assignment)
 */
router.get('/:userId/profile', getUserProfileById);

/**
 * POST /users/by-emails
 * Get multiple users by their emails (bulk lookup for role assignment)
 */
router.post('/by-emails', getUsersByEmails);

/**
 * PATCH /users/:userId/mock-trial-profile
 * Update user's mock trial profile (increment role counts, update performance)
 */
router.patch('/:userId/mock-trial-profile', updateMockTrialProfile);

export default router;

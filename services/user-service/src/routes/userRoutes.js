import express from 'express';
import {
  getMeController,
  updateMeController,
  changePasswordController,
  deactivateAccountController,
} from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /me
 * Get current user profile
 */
router.get('/me', requireAuth, getMeController);

/**
 * PATCH /me
 * Update current user profile
 */
router.patch('/me', requireAuth, updateMeController);

/**
 * POST /me/change-password
 * Change current user password
 */
router.post('/me/change-password', requireAuth, changePasswordController);

/**
 * POST /me/deactivate
 * Deactivate own account
 */
router.post('/me/deactivate', requireAuth, deactivateAccountController);

export default router;

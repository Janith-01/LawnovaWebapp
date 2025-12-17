import express from 'express';
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', authLimiter, registerController);

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login', authLimiter, loginController);

/**
 * POST /auth/refresh
 * Refresh access token with token rotation
 */
router.post('/refresh', refreshController);

/**
 * POST /auth/logout
 * Logout user (revoke refresh token)
 */
router.post('/logout', requireAuth, logoutController);

/**
 * POST /auth/forgot-password
 * Request password reset (always returns 200)
 */
router.post('/forgot-password', passwordResetLimiter, forgotPasswordController);

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', passwordResetLimiter, resetPasswordController);

export default router;

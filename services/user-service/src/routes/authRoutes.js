import express from 'express';
import {
  registerController,
  loginController,
  googleLoginController,
  refreshController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
  verifyOTPController,
  resendOTPController,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOTPSchema,
  resendOTPSchema,
} from '../utils/validators.js';

const router = express.Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', authLimiter, validate(registerSchema), registerController);

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login', authLimiter, validate(loginSchema), loginController);

/**
 * POST /auth/google
 * Authenticate user via Google OAuth and return tokens
 */
router.post('/google', authLimiter, googleLoginController);

/**
 * POST /auth/verify-otp
 * Verify email with 6-digit OTP code
 */
router.post('/verify-otp', authLimiter, validate(verifyOTPSchema), verifyOTPController);

/**
 * POST /auth/resend-otp
 * Resend verification OTP email
 */
router.post('/resend-otp', authLimiter, validate(resendOTPSchema), resendOTPController);

/**
 * POST /auth/refresh
 * Refresh access token with token rotation
 */
router.post('/refresh', validate(refreshSchema), refreshController);

/**
 * POST /auth/logout
 * Logout user (revoke refresh token)
 */
router.post('/logout', requireAuth, logoutController);

/**
 * POST /auth/forgot-password
 * Request password reset (always returns 200)
 */
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), forgotPasswordController);

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), resetPasswordController);

export default router;

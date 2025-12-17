import express from 'express';
import {
  listUsersController,
  getUserController,
  updateUserController,
  activateUserController,
  deactivateUserController,
  issuePasswordResetController,
  getAuditLogsController,
} from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /admin/users
 * List all users (with pagination and filtering)
 */
router.get('/users', requireAuth, requireAdmin, listUsersController);

/**
 * GET /admin/users/:id
 * Get specific user
 */
router.get('/users/:id', requireAuth, requireAdmin, getUserController);

/**
 * PATCH /admin/users/:id
 * Update user
 */
router.patch('/users/:id', requireAuth, requireAdmin, updateUserController);

/**
 * POST /admin/users/:id/activate
 * Activate user
 */
router.post('/users/:id/activate', requireAuth, requireAdmin, activateUserController);

/**
 * POST /admin/users/:id/deactivate
 * Deactivate user
 */
router.post('/users/:id/deactivate', requireAuth, requireAdmin, deactivateUserController);

/**
 * POST /admin/users/:id/reset-password
 * Issue password reset token
 */
router.post('/users/:id/reset-password', requireAuth, requireAdmin, issuePasswordResetController);

/**
 * GET /admin/audit-logs
 * Get audit logs
 */
router.get('/audit-logs', requireAuth, requireAdmin, getAuditLogsController);

export default router;

import express from 'express';
import {
  listUsersController,
  getUserController,
  updateUserController,
  activateUserController,
  deactivateUserController,
  issuePasswordResetController,
  searchUsersController,
  getAuditLogsController,
} from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { adminUpdateUserSchema } from '../utils/validators.js';

const router = express.Router();

/**
 * Service-to-service authentication middleware
 * Validates x-service-auth header for internal service calls
 */
const requireServiceAuth = (req, res, next) => {
  const serviceToken = req.get('x-service-auth');
  const validToken = process.env.SERVICE_AUTH_TOKEN || 'dev-token';

  if (!serviceToken || serviceToken !== validToken) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SERVICE_TOKEN',
        message: 'Invalid service authentication token',
      },
    });
  }

  next();
};

/**
 * GET /admin/users/search
 * Search for user by email or username (service-to-service call)
 */
router.get('/users/search', requireServiceAuth, searchUsersController);

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
router.patch('/users/:id', requireAuth, requireAdmin, validate(adminUpdateUserSchema), updateUserController);

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

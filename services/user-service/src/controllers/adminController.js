import { successResponse } from '../utils/responses.js';
import {
  getAllUsers,
  getUserById,
  updateUser,
  activateUser,
  deactivateUser,
  issuePasswordReset,
  getAuditLogs,
} from '../services/adminService.js';
import logger from '../utils/logger.js';

/**
 * GET /admin/users
 */
export const listUsersController = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const q = req.query.q || '';
    const isActive = req.query.isActive !== 'false';

    const result = await getAllUsers(page, limit, q, isActive);

    return res.status(200).json(successResponse(result.data, result.pagination));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/users/:id
 */
export const getUserController = async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);

    return res.status(200).json(successResponse(user));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/users/:id
 */
export const updateUserController = async (req, res, next) => {
  try {
    const user = await updateUser(
      req.params.id,
      req.body,
      req.user.id,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(user, {
        message: 'User updated successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/users/:id/activate
 */
export const activateUserController = async (req, res, next) => {
  try {
    const user = await activateUser(
      req.params.id,
      req.user.id,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(user, {
        message: 'User activated successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/users/:id/deactivate
 */
export const deactivateUserController = async (req, res, next) => {
  try {
    const user = await deactivateUser(
      req.params.id,
      req.user.id,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(user, {
        message: 'User deactivated successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/users/:id/reset-password
 */
export const issuePasswordResetController = async (req, res, next) => {
  try {
    const result = await issuePasswordReset(
      req.params.id,
      req.user.id,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(null, {
        message: result.message,
        resetToken: result.resetToken,
        resetLink: result.resetLink,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/audit-logs
 */
export const getAuditLogsController = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const userId = req.query.userId || null;
    const action = req.query.action || null;

    const result = await getAuditLogs(page, limit, userId, action);

    return res.status(200).json(successResponse(result.data, result.pagination));
  } catch (error) {
    next(error);
  }
};

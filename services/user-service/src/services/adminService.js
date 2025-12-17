import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import RefreshToken from '../models/RefreshToken.js';
import { generateRandomToken, hashToken } from '../utils/tokenUtils.js';
import { validate, adminUpdateUserSchema } from '../utils/validators.js';
import { ERROR_CODES } from '../utils/responses.js';
import logger from '../utils/logger.js';

/**
 * Get all users with pagination and filtering
 */
export const getAllUsers = async (page = 1, limit = 20, query = '', isActive = true) => {
  const skip = (page - 1) * limit;

  const filter = {
    ...(isActive !== undefined && { isActive }),
    ...(query && {
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { fullName: { $regex: query, $options: 'i' } },
      ],
    }),
  };

  const users = await User.find(filter)
    .skip(skip)
    .limit(limit)
    .select('-security.failedLoginAttempts -security.lockUntil')
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(filter);

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get user by ID
 */
export const getUserById = async (userId) => {
  const user = await User.findById(userId).select('-security.failedLoginAttempts -security.lockUntil');

  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    };
  }

  return user;
};

/**
 * Update user (admin only)
 */
export const updateUser = async (userId, updateData, adminId, ipAddress, userAgent) => {
  const validated = validate(updateData, adminUpdateUserSchema);

  const user = await User.findById(userId);
  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    };
  }

  // Track what was changed
  const changes = {};

  if (validated.fullName) {
    changes.fullName = validated.fullName;
    user.fullName = validated.fullName;
  }

  if (validated.role) {
    changes.role = validated.role;
    user.role = validated.role;
  }

  if (validated.isActive !== undefined) {
    changes.isActive = validated.isActive;
    user.isActive = validated.isActive;

    // If deactivating, revoke all tokens
    if (!validated.isActive) {
      await RefreshToken.updateMany(
        { userId },
        { revokedAt: new Date() }
      );
    }
  }

  if (validated.profile) {
    changes.profile = validated.profile;
    user.profile = { ...user.profile, ...validated.profile };
  }

  await user.save();

  // Log action
  await AuditLog.create({
    actorUserId: adminId,
    action: 'admin_user_updated',
    targetUserId: userId,
    meta: changes,
    ip: ipAddress,
    userAgent,
  });

  logger.info('User updated by admin', { userId, adminId, changes });

  return user.toJSON();
};

/**
 * Activate user (admin only)
 */
export const activateUser = async (userId, adminId, ipAddress, userAgent) => {
  const user = await User.findById(userId);
  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    };
  }

  user.isActive = true;
  await user.save();

  // Log action
  await AuditLog.create({
    actorUserId: adminId,
    action: 'admin_user_activated',
    targetUserId: userId,
    ip: ipAddress,
    userAgent,
  });

  logger.info('User activated by admin', { userId, adminId });

  return user.toJSON();
};

/**
 * Deactivate user (admin only)
 */
export const deactivateUser = async (userId, adminId, ipAddress, userAgent) => {
  const user = await User.findById(userId);
  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    };
  }

  user.isActive = false;
  await user.save();

  // Revoke all refresh tokens
  await RefreshToken.updateMany(
    { userId },
    { revokedAt: new Date() }
  );

  // Log action
  await AuditLog.create({
    actorUserId: adminId,
    action: 'admin_user_deactivated',
    targetUserId: userId,
    ip: ipAddress,
    userAgent,
  });

  logger.info('User deactivated by admin', { userId, adminId });

  return user.toJSON();
};

/**
 * Issue password reset token (admin only)
 */
export const issuePasswordReset = async (userId, adminId, ipAddress, userAgent) => {
  const user = await User.findById(userId);
  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    };
  }

  // Generate reset token
  const resetToken = generateRandomToken();

  // Log action
  await AuditLog.create({
    actorUserId: adminId,
    action: 'admin_password_reset_issued',
    targetUserId: userId,
    meta: { email: user.email },
    ip: ipAddress,
    userAgent,
  });

  logger.info('Admin issued password reset', { userId, adminId });

  // In production, send email with reset link
  return {
    message: 'Password reset token issued',
    resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    resetLink: process.env.NODE_ENV === 'development' 
      ? `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`
      : undefined,
  };
};

/**
 * Get audit logs
 */
export const getAuditLogs = async (page = 1, limit = 50, userId = null, action = null) => {
  const skip = (page - 1) * limit;

  const filter = {
    ...(userId && { actorUserId: userId }),
    ...(action && { action }),
  };

  const logs = await AuditLog.find(filter)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await AuditLog.countDocuments(filter);

  return {
    data: logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

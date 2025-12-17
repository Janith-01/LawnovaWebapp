import User from '../models/User.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import AuditLog from '../models/AuditLog.js';
import RefreshToken from '../models/RefreshToken.js';
import { generateRandomToken, hashToken, decodeToken } from '../utils/tokenUtils.js';
import { validate, changePasswordSchema, updateProfileSchema } from '../utils/validators.js';
import { ERROR_CODES } from '../utils/responses.js';
import logger from '../utils/logger.js';

/**
 * Get user profile
 */
export const getUserProfile = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    };
  }

  return user.toJSON();
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId, updateData, ipAddress, userAgent) => {
  const validated = validate(updateData, updateProfileSchema);

  const user = await User.findById(userId);
  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    };
  }

  // Update fields
  if (validated.fullName) {
    user.fullName = validated.fullName;
  }

  if (validated.profile) {
    user.profile = { ...user.profile, ...validated.profile };
  }

  await user.save();

  // Log action
  await AuditLog.create({
    actorUserId: userId,
    action: 'profile_updated',
    targetUserId: userId,
    meta: Object.keys(validated),
    ip: ipAddress,
    userAgent,
  });

  logger.info('User profile updated', { userId });

  return user.toJSON();
};

/**
 * Change password
 */
export const changePassword = async (userId, passwordData, ipAddress, userAgent) => {
  const validated = validate(passwordData, changePasswordSchema);

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    };
  }

  // Verify current password
  const isPasswordValid = await user.comparePassword(validated.currentPassword);
  if (!isPasswordValid) {
    throw {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Current password is incorrect',
    };
  }

  // Update password
  user.passwordHash = validated.newPassword;
  user.security.passwordChangedAt = new Date();
  await user.save();

  // Revoke all refresh tokens (force re-login on all devices)
  await RefreshToken.updateMany(
    { userId },
    { revokedAt: new Date() }
  );

  // Log action
  await AuditLog.create({
    actorUserId: userId,
    action: 'password_changed',
    targetUserId: userId,
    ip: ipAddress,
    userAgent,
  });

  logger.info('User password changed', { userId });

  return {
    message: 'Password changed successfully. Please login again on all devices.',
  };
};

/**
 * Request password reset
 */
export const requestPasswordReset = async (email, ipAddress, userAgent) => {
  // Always return success for security (prevent email enumeration)
  const user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    // Generate reset token
    const resetToken = generateRandomToken();
    const resetTokenHash = hashToken(resetToken);

    const passwordResetToken = new PasswordResetToken({
      userId: user._id,
      tokenHash: resetTokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    await passwordResetToken.save();

    // Log action
    await AuditLog.create({
      actorUserId: user._id,
      action: 'password_reset_requested',
      targetUserId: user._id,
      meta: { email },
      ip: ipAddress,
      userAgent,
    });

    logger.info('Password reset requested', { userId: user._id, email });

    // In production, send email with reset link
    // email body should contain: ${FRONTEND_URL}/auth/reset-password?token=${resetToken}
    // For now, just return token for development
    return {
      message: 'If an account exists with this email, a password reset link will be sent.',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    };
  }

  // Always return success
  return {
    message: 'If an account exists with this email, a password reset link will be sent.',
  };
};

/**
 * Reset password with token
 */
export const resetPassword = async (token, newPassword, ipAddress, userAgent) => {
  // Find reset token
  const resetTokenDoc = await PasswordResetToken.findOne({
    tokenHash: hashToken(token),
  });

  if (!resetTokenDoc || !resetTokenDoc.isValid()) {
    throw {
      code: ERROR_CODES.INVALID_TOKEN,
      message: 'Password reset token is invalid or expired',
    };
  }

  // Find user
  const user = await User.findById(resetTokenDoc.userId).select('+passwordHash');
  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    };
  }

  // Update password
  user.passwordHash = newPassword;
  user.security.passwordChangedAt = new Date();
  await user.save();

  // Mark token as used
  await resetTokenDoc.markAsUsed();

  // Revoke all refresh tokens
  await RefreshToken.updateMany(
    { userId: user._id },
    { revokedAt: new Date() }
  );

  // Log action
  await AuditLog.create({
    actorUserId: user._id,
    action: 'password_reset_completed',
    targetUserId: user._id,
    ip: ipAddress,
    userAgent,
  });

  logger.info('Password reset completed', { userId: user._id });

  return {
    message: 'Password reset successful. Please login with your new password.',
  };
};

/**
 * Deactivate user account
 */
export const deactivateAccount = async (userId, ipAddress, userAgent) => {
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
    actorUserId: userId,
    action: 'user_deactivated',
    targetUserId: userId,
    ip: ipAddress,
    userAgent,
  });

  logger.info('User account deactivated', { userId });

  return {
    message: 'Account deactivated successfully.',
  };
};

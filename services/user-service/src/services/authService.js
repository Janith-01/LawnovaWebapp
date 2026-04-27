import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';
import { generateAccessToken, generateRefreshToken, hashToken, decodeToken } from '../utils/tokenUtils.js';
import { validate, registerSchema, loginSchema } from '../utils/validators.js';
import { ERROR_CODES } from '../utils/responses.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

/**
 * Register a new user
 */
export const register = async (registerData, ipAddress, userAgent) => {
  // Validate input
  const validated = validate(registerData, registerSchema);

  // Check if user already exists
  const existingUser = await User.findOne({ email: validated.email });
  if (existingUser) {
    throw {
      code: ERROR_CODES.USER_ALREADY_EXISTS,
      message: 'Email already registered',
    };
  }

  // Create new user
  const user = new User({
    email: validated.email,
    passwordHash: validated.password,
    fullName: validated.fullName,
    role: 'student', // Default role
    isActive: true,
    isEmailVerified: false,
    profile: {
      institution: validated.institution,
      languagePreference: validated.languagePreference,
    },
  });

  await user.save();

  // Log the action
  await AuditLog.create({
    actorUserId: user._id,
    action: 'user_registered',
    targetUserId: user._id,
    meta: { email: user.email },
    ip: ipAddress,
    userAgent,
  });

  logger.info('User registered', { userId: user._id, email: user.email });

  return {
    user: user.toJSON(),
    message: 'Registration successful. Please verify your email.',
  };
};

/**
 * Login user
 */
export const login = async (loginData, ipAddress, userAgent) => {
  // Validate input
  const validated = validate(loginData, loginSchema);

  // Find user
  const user = await User.findOne({ email: validated.email }).select('+passwordHash');
  if (!user) {
    throw {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid email or password',
    };
  }

  // Backward compatibility: some legacy records may miss passwordHash.
  if (!user.passwordHash || typeof user.passwordHash !== 'string') {
    throw {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid email or password',
    };
  }

  // Check if account is locked
  if (user.isLocked()) {
    throw {
      code: ERROR_CODES.USER_LOCKED,
      message: 'Account is temporarily locked due to too many failed login attempts',
    };
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(validated.password);
  if (!isPasswordValid) {
    await user.incFailedLoginAttempts(config.security.lockoutDurationMinutes);
    throw {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid email or password',
    };
  }

  // Check if user is active
  if (!user.isActive) {
    throw {
      code: ERROR_CODES.USER_INACTIVE,
      message: 'User account is inactive',
    };
  }

  // Reset failed attempts and update last login
  await user.resetFailedLoginAttempts();

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role, user.email);
  const refreshToken = generateRefreshToken(user._id);

  // Store refresh token
  const refreshTokenHash = hashToken(refreshToken);
  const decodedToken = decodeToken(refreshToken);
  const refreshTokenDoc = new RefreshToken({
    userId: user._id,
    tokenHash: refreshTokenHash,
    expiresAt: new Date(decodedToken.exp * 1000),
    ip: ipAddress,
    userAgent,
  });
  await refreshTokenDoc.save();

  // Log login
  await AuditLog.create({
    actorUserId: user._id,
    action: 'user_login',
    targetUserId: user._id,
    ip: ipAddress,
    userAgent,
  });

  logger.info('User logged in', { userId: user._id, email: user.email });

  return {
    accessToken,
    refreshToken,
    user: user.toJSON(),
  };
};

/**
 * Refresh access token with token rotation
 */
export const refresh = async (refreshToken, ipAddress, userAgent) => {
  if (!refreshToken) {
    throw {
      code: ERROR_CODES.MISSING_TOKEN,
      message: 'Refresh token is required',
    };
  }

  // Decode token to get user ID
  const decodedToken = decodeToken(refreshToken);
  if (!decodedToken || !decodedToken.sub || !decodedToken.exp) {
    throw {
      code: ERROR_CODES.INVALID_TOKEN,
      message: 'Invalid refresh token',
    };
  }

  const userId = decodedToken.sub;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw {
      code: ERROR_CODES.INVALID_TOKEN,
      message: 'Invalid refresh token',
    };
  }

  // Find refresh token record
  const refreshTokenDoc = await RefreshToken.findOne({
    userId,
    tokenHash: hashToken(refreshToken),
  });

  if (!refreshTokenDoc || !refreshTokenDoc.isValid()) {
    throw {
      code: ERROR_CODES.INVALID_TOKEN,
      message: 'Refresh token is invalid or expired',
    };
  }

  // Find user
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw {
      code: ERROR_CODES.USER_INACTIVE,
      message: 'User account is inactive',
    };
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(user._id, user.role, user.email);
  const newRefreshToken = generateRefreshToken(user._id);

  // Revoke old refresh token
  await refreshTokenDoc.revoke();

  // Store new refresh token
  const newRefreshTokenHash = hashToken(newRefreshToken);
  const newDecodedToken = decodeToken(newRefreshToken);
  const newRefreshTokenDoc = new RefreshToken({
    userId: user._id,
    tokenHash: newRefreshTokenHash,
    expiresAt: new Date(newDecodedToken.exp * 1000),
    ip: ipAddress,
    userAgent,
  });
  await newRefreshTokenDoc.save();

  logger.info('Token refreshed', { userId: user._id });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Logout user (revoke refresh token)
 */
export const logout = async (refreshToken, userId, ipAddress, userAgent) => {
  if (refreshToken) {
    try {
      const refreshTokenDoc = await RefreshToken.findOne({
        userId,
        tokenHash: hashToken(refreshToken),
      });

      if (refreshTokenDoc) {
        await refreshTokenDoc.revoke();
      }
    } catch (error) {
      logger.warn('Error revoking refresh token', { error: error.message });
    }
  }

  // Log logout
  await AuditLog.create({
    actorUserId: userId,
    action: 'user_logout',
    targetUserId: userId,
    ip: ipAddress,
    userAgent,
  });

  logger.info('User logged out', { userId });

  return {
    message: 'Logout successful',
  };
};

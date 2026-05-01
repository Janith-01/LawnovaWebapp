import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import EmailVerificationOTP from '../models/EmailVerificationOTP.js';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { generateAccessToken, generateRefreshToken, hashToken, decodeToken } from '../utils/tokenUtils.js';
import { validate, registerSchema, loginSchema } from '../utils/validators.js';
import { ERROR_CODES } from '../utils/responses.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import { sendVerificationOTP } from '../utils/emailService.js';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

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

  // Generate and send OTP
  const otp = generateOTP();
  const otpHash = hashToken(otp);

  // Remove any existing OTPs for this user
  await EmailVerificationOTP.deleteMany({ userId: user._id });

  const otpDoc = new EmailVerificationOTP({
    userId: user._id,
    email: user.email,
    otpHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });
  await otpDoc.save();

  // Send OTP email
  try {
    await sendVerificationOTP(user.email, otp);
    logger.info('Verification OTP sent', { userId: user._id, email: user.email });
  } catch (error) {
    logger.error('Failed to send verification OTP email', { userId: user._id, error: error.message });
    // Don't fail registration if email fails — user can resend
  }

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
    message: 'Registration successful. Please check your email for the verification code.',
  };
};

/**
 * Verify email with OTP
 */
export const verifyEmailOTP = async (email, otp, ipAddress, userAgent) => {
  // Find user
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw {
      code: ERROR_CODES.USER_NOT_FOUND,
      message: 'No account found with this email',
    };
  }

  if (user.isEmailVerified) {
    return { message: 'Email is already verified' };
  }

  // Find latest OTP for this user
  const otpDoc = await EmailVerificationOTP.findOne({ userId: user._id })
    .select('+otpHash')
    .sort({ createdAt: -1 });

  if (!otpDoc) {
    throw {
      code: 'OTP_NOT_FOUND',
      message: 'No verification code found. Please request a new one.',
    };
  }

  if (!otpDoc.isValid()) {
    throw {
      code: 'OTP_EXPIRED',
      message: otpDoc.attempts >= 5
        ? 'Too many failed attempts. Please request a new code.'
        : 'Verification code has expired. Please request a new one.',
    };
  }

  // Compare OTP
  const otpHash = hashToken(otp);
  if (otpHash !== otpDoc.otpHash) {
    await otpDoc.incrementAttempts();
    const remainingAttempts = 5 - otpDoc.attempts;
    throw {
      code: 'INVALID_OTP',
      message: remainingAttempts > 0
        ? `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`
        : 'Too many failed attempts. Please request a new code.',
    };
  }

  // Mark email as verified
  user.isEmailVerified = true;
  await user.save();

  // Delete all OTPs for this user
  await EmailVerificationOTP.deleteMany({ userId: user._id });

  // Log the action
  await AuditLog.create({
    actorUserId: user._id,
    action: 'email_verified',
    targetUserId: user._id,
    meta: { email: user.email },
    ip: ipAddress,
    userAgent,
  });

  logger.info('Email verified via OTP', { userId: user._id, email: user.email });

  return { message: 'Email verified successfully. You can now sign in.' };
};

/**
 * Resend verification OTP
 */
export const resendVerificationOTP = async (email, ipAddress, userAgent) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    // Don't reveal whether user exists
    return { message: 'If an account exists with this email, a new verification code will be sent.' };
  }

  if (user.isEmailVerified) {
    return { message: 'Email is already verified.' };
  }

  // Rate limit: check if an OTP was sent within the last 60 seconds
  const recentOTP = await EmailVerificationOTP.findOne({
    userId: user._id,
    createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
  });

  if (recentOTP) {
    throw {
      code: 'OTP_COOLDOWN',
      message: 'Please wait 60 seconds before requesting a new code.',
    };
  }

  // Generate new OTP
  const otp = generateOTP();
  const otpHash = hashToken(otp);

  // Remove old OTPs
  await EmailVerificationOTP.deleteMany({ userId: user._id });

  const otpDoc = new EmailVerificationOTP({
    userId: user._id,
    email: user.email,
    otpHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });
  await otpDoc.save();

  // Send OTP email
  try {
    await sendVerificationOTP(user.email, otp);
    logger.info('Verification OTP resent', { userId: user._id, email: user.email });
  } catch (error) {
    logger.error('Failed to resend verification OTP', { userId: user._id, error: error.message });
    throw {
      code: 'EMAIL_SEND_FAILED',
      message: 'Failed to send verification email. Please try again later.',
    };
  }

  // Log the action
  await AuditLog.create({
    actorUserId: user._id,
    action: 'verification_otp_resent',
    targetUserId: user._id,
    meta: { email: user.email },
    ip: ipAddress,
    userAgent,
  });

  return { message: 'A new verification code has been sent to your email.' };
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

  // Check if email is verified (only for local auth users)
  if (user.authProvider === 'local' && !user.isEmailVerified) {
    throw {
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address before signing in.',
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
 * Google Login (OAuth)
 */
export const googleLogin = async (credential, ipAddress, userAgent) => {
  if (!credential) {
    throw {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Google credential missing',
    };
  }

  // Verify Google Token
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    logger.error('Google token verification failed', { error: error.message });
    throw {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid Google token',
    };
  }

  const { email, sub: googleId, name: fullName, picture: avatarUrl } = payload;

  // Find user by email or googleId
  let user = await User.findOne({ $or: [{ email }, { googleId }] });

  if (!user) {
    // Just-In-Time Provisioning
    user = new User({
      email,
      googleId,
      authProvider: 'google',
      fullName,
      role: 'student',
      isActive: true,
      isEmailVerified: true, // Trusted from Google
      profile: {
        avatarUrl,
      },
    });
    await user.save();

    await AuditLog.create({
      actorUserId: user._id,
      action: 'user_registered_google',
      targetUserId: user._id,
      meta: { email: user.email },
      ip: ipAddress,
      userAgent,
    });
    logger.info('User registered via Google', { userId: user._id, email: user.email });
  } else {
    // If user exists but no googleId (migrating from local to google)
    if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = 'google';
      user.isEmailVerified = true;
      if (!user.profile.avatarUrl && avatarUrl) {
        user.profile.avatarUrl = avatarUrl;
      }
      await user.save();
    }
    
    if (user.isLocked()) {
      throw {
        code: ERROR_CODES.USER_LOCKED,
        message: 'Account is temporarily locked',
      };
    }
    if (!user.isActive) {
      throw {
        code: ERROR_CODES.USER_INACTIVE,
        message: 'User account is inactive',
      };
    }
    await user.resetFailedLoginAttempts();
  }

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

  await AuditLog.create({
    actorUserId: user._id,
    action: 'user_login_google',
    targetUserId: user._id,
    ip: ipAddress,
    userAgent,
  });

  logger.info('User logged in via Google', { userId: user._id, email: user.email });

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

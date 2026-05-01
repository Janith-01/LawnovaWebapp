import { successResponse, errorResponse, ERROR_CODES } from '../utils/responses.js';
import { register, login, googleLogin, refresh, logout, verifyEmailOTP, resendVerificationOTP } from '../services/authService.js';
import { requestPasswordReset, resetPassword } from '../services/userService.js';
import logger from '../utils/logger.js';

/**
 * POST /auth/register
 */
export const registerController = async (req, res, next) => {
  try {
    const result = await register(
      req.body,
      req.ip,
      req.get('user-agent')
    );

    return res.status(201).json(
      successResponse(result.user, {
        message: result.message,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/login
 */
export const loginController = async (req, res, next) => {
  try {
    const result = await login(
      req.body,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(result, {
        message: 'Login successful',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/google
 */
export const googleLoginController = async (req, res, next) => {
  try {
    const result = await googleLogin(
      req.body.credential,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(result, {
        message: 'Google login successful',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/refresh
 */
export const refreshController = async (req, res, next) => {
  try {
    const result = await refresh(
      req.body.refreshToken,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(result, {
        message: 'Token refreshed',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/logout
 */
export const logoutController = async (req, res, next) => {
  try {
    const result = await logout(
      req.body.refreshToken,
      req.user.id,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(null, {
        message: result.message,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/verify-otp
 */
export const verifyOTPController = async (req, res, next) => {
  try {
    const result = await verifyEmailOTP(
      req.body.email,
      req.body.otp,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(null, {
        message: result.message,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/resend-otp
 */
export const resendOTPController = async (req, res, next) => {
  try {
    const result = await resendVerificationOTP(
      req.body.email,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(null, {
        message: result.message,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/forgot-password
 */
export const forgotPasswordController = async (req, res, next) => {
  try {
    const result = await requestPasswordReset(
      req.body.email,
      req.ip,
      req.get('user-agent')
    );

    // Always return 200 to prevent email enumeration
    return res.status(200).json(
      successResponse(null, {
        message: result.message,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/reset-password
 */
export const resetPasswordController = async (req, res, next) => {
  try {
    const result = await resetPassword(
      req.body.token,
      req.body.newPassword,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(null, {
        message: result.message,
      })
    );
  } catch (error) {
    next(error);
  }
};

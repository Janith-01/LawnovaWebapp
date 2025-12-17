import { verifyToken, decodeToken } from '../utils/tokenUtils.js';
import { errorResponse, ERROR_CODES } from '../utils/responses.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';

/**
 * Verify JWT and attach user to request
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        errorResponse(ERROR_CODES.MISSING_TOKEN, 'Missing or invalid authorization header')
      );
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      return res.status(401).json(
        errorResponse(ERROR_CODES.INVALID_TOKEN, error.message)
      );
    }

    // Fetch user from database
    const user = await User.findById(decoded.sub);

    if (!user) {
      logger.warn('User not found during auth', { userId: decoded.sub });
      return res.status(401).json(
        errorResponse(ERROR_CODES.USER_NOT_FOUND, 'User no longer exists')
      );
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('Inactive user attempted access', { userId: user._id });
      return res.status(403).json(
        errorResponse(ERROR_CODES.USER_INACTIVE, 'User account is inactive')
      );
    }

    // Check if token was issued before password change
    if (user.security.passwordChangedAt) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      if (tokenIssuedAt < user.security.passwordChangedAt) {
        logger.warn('Token issued before password change', { userId: user._id });
        return res.status(401).json(
          errorResponse(ERROR_CODES.INVALID_TOKEN, 'Token invalidated by password change')
        );
      }
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    return res.status(500).json(
      errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Internal server error')
    );
  }
};

/**
 * Require admin role
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      errorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required')
    );
  }

  if (req.user.role !== 'admin') {
    logger.warn('Non-admin user attempted admin action', { userId: req.user.id });
    return res.status(403).json(
      errorResponse(ERROR_CODES.ADMIN_REQUIRED, 'Admin privileges required')
    );
  }

  next();
};

/**
 * Verify user owns the resource or is admin
 */
export const requireOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      errorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required')
    );
  }

  const resourceUserId = req.params.id;
  const isOwner = req.user.id === resourceUserId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    logger.warn('User attempted unauthorized resource access', {
      userId: req.user.id,
      resourceUserId,
    });
    return res.status(403).json(
      errorResponse(ERROR_CODES.FORBIDDEN, 'Access denied')
    );
  }

  next();
};

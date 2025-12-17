import { errorResponse, ERROR_CODES } from '../utils/responses.js';
import logger from '../utils/logger.js';

/**
 * Centralized error handler
 */
export const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.entries(err.errors).map(([field, error]) => ({
      field,
      message: error.message,
    }));
    return res.status(400).json(
      errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details)
    );
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json(
      errorResponse(ERROR_CODES.USER_ALREADY_EXISTS, `${field} already exists`)
    );
  }

  // Custom validation error
  if (err.code === 'VALIDATION_ERROR') {
    return res.status(400).json(
      errorResponse(err.code, err.message, err.details || [])
    );
  }

  // Custom application errors
  if (err.code && ERROR_CODES[err.code]) {
    const statusCode = getStatusCodeForError(err.code);
    return res.status(statusCode).json(
      errorResponse(err.code, err.message, err.details || [])
    );
  }

  // Default error
  return res.status(err.statusCode || 500).json(
    errorResponse(ERROR_CODES.INTERNAL_ERROR, 'Internal server error')
  );
};

/**
 * Get HTTP status code for error
 */
const getStatusCodeForError = (errorCode) => {
  const statusMap = {
    VALIDATION_ERROR: 400,
    INVALID_EMAIL: 400,
    WEAK_PASSWORD: 400,
    INVALID_CREDENTIALS: 401,
    UNAUTHORIZED: 401,
    TOKEN_EXPIRED: 401,
    INVALID_TOKEN: 401,
    MISSING_TOKEN: 401,
    USER_NOT_FOUND: 404,
    USER_INACTIVE: 403,
    USER_ALREADY_EXISTS: 409,
    USER_LOCKED: 423,
    FORBIDDEN: 403,
    ADMIN_REQUIRED: 403,
    DATABASE_ERROR: 500,
    INTERNAL_ERROR: 500,
  };

  return statusMap[errorCode] || 500;
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

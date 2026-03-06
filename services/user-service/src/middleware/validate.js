import { errorResponse, ERROR_CODES } from '../utils/responses.js';
import logger from '../utils/logger.js';

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} source - Where to get data ('body', 'query', 'params')
 */
export const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const dataToValidate = req[source];

      // Joi's validateAsync returns the validated value, and throws on validation errors.
      const validatedValue = await schema.validateAsync(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
      });

      // Replace request data with validated value
      req[source] = validatedValue;
      next();
    } catch (error) {
      // Joi validation errors
      if (error?.isJoi && Array.isArray(error.details)) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        logger.warn('Validation failed', {
          source,
          details,
          path: req.path,
        });

        return res
          .status(400)
          .json(errorResponse(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details));
      }

      logger.error('Validation middleware error', { error: error?.message });
      next(error);
    }
  };
};

import Joi from 'joi';

const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'uppercase, lowercase, and number')
  .required()
  .messages({
    'string.pattern.base': 'Password must contain at least {#label} characters',
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password must not exceed 128 characters',
  });

const emailSchema = Joi.string()
  .email()
  .lowercase()
  .trim()
  .required()
  .messages({
    'string.email': 'Invalid email format',
  });

/**
 * Register validation schema
 */
export const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.min': 'Full name must be at least 2 characters',
      'string.max': 'Full name must not exceed 100 characters',
    }),
  institution: Joi.string().max(200).trim().allow(null, ''),
  languagePreference: Joi.string().valid('en', 'si', 'ta', 'hi', 'bn').default('en'),
}).unknown(false);

/**
 * Login validation schema
 */
export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required(),
}).unknown(false);

/**
 * Refresh token validation schema
 */
export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
}).unknown(false);

/**
 * Change password validation schema
 */
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema,
}).unknown(false);

/**
 * Update profile validation schema
 */
export const updateProfileSchema = Joi.object({
  fullName: Joi.string()
    .min(2)
    .max(100)
    .trim(),
  profile: Joi.object({
    avatarUrl: Joi.string().uri().allow(null),
    institution: Joi.string().max(200).trim().allow(null),
    languagePreference: Joi.string().valid('en', 'si', 'ta', 'hi', 'bn'),
    bio: Joi.string().max(500).allow(null),
  }).unknown(false),
}).unknown(false);

/**
 * Forgot password validation schema
 */
export const forgotPasswordSchema = Joi.object({
  email: emailSchema,
}).unknown(false);

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: passwordSchema,
}).unknown(false);

/**
 * Admin update user validation schema
 */
export const adminUpdateUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).trim(),
  role: Joi.string().valid('student', 'admin'),
  isActive: Joi.boolean(),
  profile: Joi.object({
    avatarUrl: Joi.string().uri().allow(null),
    institution: Joi.string().max(200).trim().allow(null),
    languagePreference: Joi.string().valid('en', 'si', 'ta'),
    bio: Joi.string().max(500).allow(null),
  }).unknown(false),
}).unknown(false);

/**
 * Validate against schema
 */
export const validate = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    throw {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details,
    };
  }

  return value;
};

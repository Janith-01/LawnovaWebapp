import Joi from 'joi';

/**
 * Validation schemas for trial endpoints
 */
export const trialSchemas = {
    /**
     * Initialize trial schema
     */
    initTrial: Joi.object({
        userId: Joi.string()
            .required()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .messages({
                'string.pattern.base': 'userId must be a valid MongoDB ObjectId',
                'any.required': 'userId is required'
            }),
        role: Joi.string()
            .required()
            .valid('Lawyer', 'Opposition')
            .messages({
                'any.only': 'role must be either "Lawyer" or "Opposition"',
                'any.required': 'role is required'
            }),
        caseStage: Joi.string()
            .required()
            .valid(
                'Pre-Trial',
                'Opening Statements',
                'Prosecution Evidence',
                'Defense Evidence',
                'Cross-Examination',
                'Closing Arguments',
                'Verdict',
                'Full Trial'
            )
            .messages({
                'any.only': 'caseStage must be a valid trial stage',
                'any.required': 'caseStage is required'
            })
    }),

    /**
     * Session ID parameter schema
     */
    sessionIdParam: Joi.object({
        sessionId: Joi.string()
            .required()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .messages({
                'string.pattern.base': 'sessionId must be a valid MongoDB ObjectId',
                'any.required': 'sessionId is required'
            })
    }),

    /**
     * Add message schema
     */
    addMessage: Joi.object({
        role: Joi.string()
            .required()
            .valid('Lawyer', 'Opposition', 'Judge', 'Witness', 'System', 'User')
            .messages({
                'any.only': 'role must be a valid transcript role',
                'any.required': 'role is required'
            }),
        content: Joi.string()
            .required()
            .min(1)
            .max(10000)
            .messages({
                'string.min': 'content cannot be empty',
                'string.max': 'content cannot exceed 10000 characters',
                'any.required': 'content is required'
            })
    }),

    /**
     * Complete session schema
     */
    completeSession: Joi.object({
        performance: Joi.object({
            overallScore: Joi.number().min(0).max(100),
            legalAccuracy: Joi.number().min(0).max(100),
            argumentation: Joi.number().min(0).max(100),
            statuteUsage: Joi.number().min(0).max(100),
            feedback: Joi.string().max(5000)
        }).optional()
    })
};

/**
 * Validation middleware factory
 * @param {Joi.ObjectSchema} schema - Joi schema to validate against
 * @param {string} property - Request property to validate ('body', 'params', 'query')
 */
export const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errorMessages
            });
        }

        // Replace request property with validated value
        req[property] = value;
        next();
    };
};

export default { validate, trialSchemas };

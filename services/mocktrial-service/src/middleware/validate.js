import Joi from 'joi';

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
export const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message.replace(/['"]/g, '')
            }));

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        // Replace request property with validated value
        req[property] = value;
        next();
    };
};

// Valid trial roles for the Fair Rotation Engine
const VALID_INVITED_ROLES = ['Judge', 'Defense Lawyer', 'Prosecution Lawyer', 'Victim', 'Witness', 'Client', 'Jury Foreman', 'Expert Witness', 'Eyewitness', 'Court Clerk', 'Bailiff', 'Court Reporter', 'Investigating Officer', 'Unassigned'];
const VALID_ROOM_STATUSES = ['Scheduled', 'RolesAssigned', 'Live', 'Completed'];

/**
 * Room validation schemas
 */
export const roomSchemas = {
    // Create room validation
    createRoom: Joi.object({
        topic: Joi.string()
            .min(5)
            .max(200)
            .required()
            .messages({
                'string.min': 'Topic must be at least 5 characters',
                'string.max': 'Topic cannot exceed 200 characters',
                'any.required': 'Topic is required'
            }),
        description: Joi.string()
            .max(2000)
            .allow('')
            .optional(),
        scheduledDate: Joi.date()
            .required()
            .messages({
                'any.required': 'Scheduled date is required'
            }),
        scheduledTime: Joi.string()
            .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .required()
            .messages({
                'string.pattern.base': 'Time must be in HH:MM format (24-hour)',
                'any.required': 'Scheduled time is required'
            }),
        agenda: Joi.string()
            .max(5000)
            .allow('')
            .optional(),
        participants: Joi.array()
            .items(
                Joi.object({
                    email: Joi.string().email().required(),
                    role: Joi.string()
                        .valid(...VALID_INVITED_ROLES)
                        .default('Unassigned')
                })
            )
            .optional(),
        requiredRoles: Joi.object()
            .pattern(
                Joi.string().valid(...VALID_INVITED_ROLES.filter(r => r !== 'Unassigned')),
                Joi.number().integer().min(0).max(10)
            )
            .optional()
            .messages({
                'object.pattern.match': 'Invalid role in requiredRoles configuration'
            })
    }),

    // Invite participants validation
    inviteParticipants: Joi.object({
        participants: Joi.array()
            .items(
                Joi.object({
                    email: Joi.string()
                        .email()
                        .required()
                        .messages({
                            'string.email': 'Please provide a valid email address'
                        }),
                    role: Joi.string()
                        .valid(...VALID_INVITED_ROLES)
                        .default('Unassigned')
                })
            )
            .min(1)
            .max(50)
            .required()
            .messages({
                'array.min': 'At least one participant is required',
                'array.max': 'Cannot invite more than 50 participants at once'
            })
    }),

    // Update room status validation
    updateStatus: Joi.object({
        status: Joi.string()
            .valid(...VALID_ROOM_STATUSES)
            .required()
            .messages({
                'any.only': `Status must be one of: ${VALID_ROOM_STATUSES.join(', ')}`,
                'any.required': 'Status is required'
            })
    }),

    // Room ID param validation
    roomIdParam: Joi.object({
        roomId: Joi.string()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .required()
            .messages({
                'string.pattern.base': 'Invalid room ID format'
            })
    }),

    // Update room validation
    updateRoom: Joi.object({
        topic: Joi.string()
            .min(5)
            .max(200)
            .optional(),
        description: Joi.string()
            .max(2000)
            .allow('')
            .optional(),
        scheduledDate: Joi.date()
            .optional(),
        scheduledTime: Joi.string()
            .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .optional()
            .messages({
                'string.pattern.base': 'Time must be in HH:MM format (24-hour)'
            }),
        agenda: Joi.string()
            .max(5000)
            .allow('')
            .optional(),
        requiredRoles: Joi.object()
            .pattern(
                Joi.string().valid(...VALID_INVITED_ROLES.filter(r => r !== 'Unassigned')),
                Joi.number().integer().min(0).max(10)
            )
            .optional()
    }),

    // Assign roles validation
    assignRoles: Joi.object({
        force: Joi.boolean()
            .default(false)
            .optional()
    }),

    // Update participant role validation
    updateParticipantRole: Joi.object({
        role: Joi.string()
            .valid(...VALID_INVITED_ROLES.filter(r => r !== 'Unassigned'))
            .required()
            .messages({
                'any.only': `Role must be one of: ${VALID_INVITED_ROLES.filter(r => r !== 'Unassigned').join(', ')}`,
                'any.required': 'Role is required'
            })
    })
};

export default validate;

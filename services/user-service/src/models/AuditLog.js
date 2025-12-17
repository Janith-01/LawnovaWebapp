import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'user_registered',
        'user_login',
        'user_logout',
        'password_changed',
        'password_reset_requested',
        'password_reset_completed',
        'email_verified',
        'profile_updated',
        'user_deactivated',
        'user_activated',
        'user_role_changed',
        'admin_user_updated',
        'admin_user_deactivated',
        'admin_user_activated',
        'admin_password_reset_issued',
      ],
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

/**
 * Index for common queries
 */
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetUserId: 1, createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);

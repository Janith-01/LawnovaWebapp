import mongoose from 'mongoose';

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
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
 * Check if token is valid (not used and not expired)
 */
passwordResetTokenSchema.methods.isValid = function () {
  return !this.usedAt && this.expiresAt > new Date();
};

/**
 * Mark token as used
 */
passwordResetTokenSchema.methods.markAsUsed = function () {
  this.usedAt = new Date();
  return this.save();
};

/**
 * Auto-delete expired tokens
 */
passwordResetTokenSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0, // Delete immediately after expiration
  }
);

export default mongoose.model('PasswordResetToken', passwordResetTokenSchema);

import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
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
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    deviceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

/**
 * Check if token is valid (not revoked and not expired)
 */
refreshTokenSchema.methods.isValid = function () {
  return !this.revokedAt && this.expiresAt > new Date();
};

/**
 * Revoke token
 */
refreshTokenSchema.methods.revoke = function () {
  this.revokedAt = new Date();
  return this.save();
};

/**
 * Auto-delete expired tokens (TTL index for 90 days after expiry)
 */
refreshTokenSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 7776000, // 90 days after expiration
  }
);

export default mongoose.model('RefreshToken', refreshTokenSchema);

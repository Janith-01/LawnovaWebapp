import mongoose from 'mongoose';

const emailVerificationOTPSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
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
 * Check if OTP is valid (not expired, under max attempts)
 */
emailVerificationOTPSchema.methods.isValid = function () {
  return this.attempts < 5 && this.expiresAt > new Date();
};

/**
 * Increment verification attempts
 */
emailVerificationOTPSchema.methods.incrementAttempts = function () {
  this.attempts += 1;
  return this.save();
};

/**
 * Auto-delete expired OTPs
 */
emailVerificationOTPSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
  }
);

export default mongoose.model('EmailVerificationOTP', emailVerificationOTPSchema);

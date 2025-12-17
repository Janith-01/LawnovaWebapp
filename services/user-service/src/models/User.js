import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // Don't return by default
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    profile: {
      avatarUrl: {
        type: String,
        default: null,
      },
      institution: {
        type: String,
        default: null,
        trim: true,
      },
      languagePreference: {
        type: String,
        enum: ['en', 'si', 'ta'],
        default: 'en',
      },
      bio: {
        type: String,
        default: null,
        maxlength: 500,
      },
    },
    security: {
      failedLoginAttempts: {
        type: Number,
        default: 0,
      },
      lockUntil: {
        type: Date,
        default: null,
      },
      passwordChangedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for security queries
userSchema.index({ 'security.lockUntil': 1 });
userSchema.index({ email: 1, isActive: 1 });

/**
 * Check if account is locked
 */
userSchema.methods.isLocked = function () {
  return this.security.lockUntil && this.security.lockUntil > new Date();
};

/**
 * Increment failed login attempts
 */
userSchema.methods.incFailedLoginAttempts = function (lockoutDuration) {
  this.security.failedLoginAttempts += 1;
  if (this.security.failedLoginAttempts >= 5) {
    this.security.lockUntil = new Date(Date.now() + lockoutDuration * 60 * 1000);
  }
  return this.save();
};

/**
 * Reset failed login attempts
 */
userSchema.methods.resetFailedLoginAttempts = function () {
  this.security.failedLoginAttempts = 0;
  this.security.lockUntil = null;
  this.lastLoginAt = new Date();
  return this.save();
};

/**
 * Compare passwords
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    throw new Error(`Password comparison failed: ${error.message}`);
  }
};

/**
 * Hash password before saving
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }

  try {
    const config = (await import('../config/index.js')).default;
    const salt = await bcrypt.genSalt(config.password.bcryptRounds);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model('User', userSchema);

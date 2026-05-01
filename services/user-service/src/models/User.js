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
      required: function() {
        return this.authProvider === 'local';
      },
      minlength: 8,
      select: false, // Don't return by default
    },
    googleId: {
      type: String,
      sparse: true, // Allows nulls while enforcing uniqueness if present
      unique: true,
      index: true
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
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
        enum: ['en', 'si', 'ta', 'hi', 'bn'],
        default: 'en',
      },
      bio: {
        type: String,
        default: null,
        maxlength: 500,
      },
    },
    // Mock Trial Role History for Fair Rotation Algorithm
    mockTrialProfile: {
      roleCounts: {
        judge: { type: Number, default: 0 },
        defenseLawyer: { type: Number, default: 0 },
        prosecutionLawyer: { type: Number, default: 0 },
        juryForeman: { type: Number, default: 0 },
        expertWitness: { type: Number, default: 0 },
        eyewitness: { type: Number, default: 0 },
        courtClerk: { type: Number, default: 0 },
        bailiff: { type: Number, default: 0 },
        courtReporter: { type: Number, default: 0 },
        investigatingOfficer: { type: Number, default: 0 },

        victim: { type: Number, default: 0 },
        witness: { type: Number, default: 0 },
        client: { type: Number, default: 0 },
      },
      performanceScore: {
        type: Number,
        default: 50, // Base score out of 100
        min: 0,
        max: 100,
      },
      syllabusProgress: {
        crossExamination: { type: Number, default: 0 },
        legalArgumentation: { type: Number, default: 0 },
        caseAnalysis: { type: Number, default: 0 },
        courtProcedure: { type: Number, default: 0 },
        evidencePresentation: { type: Number, default: 0 },
      },
      totalTrialsParticipated: { type: Number, default: 0 },
      lastRoleAssigned: { type: String, default: null },
      lastTrialDate: { type: Date, default: null },
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
  if (!this.security) {
    this.security = {
      failedLoginAttempts: 0,
      lockUntil: null,
      passwordChangedAt: null,
    };
  }
  return this.security.lockUntil && this.security.lockUntil > new Date();
};

/**
 * Increment failed login attempts
 */
userSchema.methods.incFailedLoginAttempts = function (lockoutDuration) {
  if (!this.security) {
    this.security = {
      failedLoginAttempts: 0,
      lockUntil: null,
      passwordChangedAt: null,
    };
  }

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
  if (!this.security) {
    this.security = {
      failedLoginAttempts: 0,
      lockUntil: null,
      passwordChangedAt: null,
    };
  }

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
    if (!this.passwordHash || typeof this.passwordHash !== 'string') {
      return false;
    }
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    return false;
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

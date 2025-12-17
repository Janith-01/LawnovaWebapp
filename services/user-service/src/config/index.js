import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  // Service
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.USER_SERVICE_PORT || process.env.PORT || '5002', 10),
  serviceName: process.env.SERVICE_NAME || 'user-service',

  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/lawnova',
    options: {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || process.env.JWT_EXPIRY || '7d',
  },

  // Password
  password: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
  },

  // Security
  security: {
    lockoutThreshold: parseInt(process.env.ACCOUNT_LOCKOUT_THRESHOLD || '5', 10),
    lockoutDurationMinutes: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || '15', 10),
    passwordResetTokenExpiry: 15 * 60 * 1000, // 15 minutes
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    authWindowMs: 15 * 60 * 1000,
    authMaxRequests: 10,
  },

  // CORS
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },

  // Email
  email: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD,
    },
    from: process.env.EMAIL_FROM,
  },

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/user-service.log',
  },

  // API Gateway
  apiGatewayUrl: process.env.API_GATEWAY_URL || 'http://localhost:5000',
};

// Validate critical config
if (!config.jwt.secret) {
  throw new Error('JWT_SECRET is required in environment variables');
}

if (config.env === 'production' && !config.email.auth.user) {
  console.warn('Warning: Email configuration is not complete for production');
}

export default config;

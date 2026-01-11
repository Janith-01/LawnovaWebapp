import mongoose from 'mongoose';
import dns from 'dns';
import dnscache from 'dnscache';
import config from './index.js';

// Enable DNS caching with Google DNS servers (fixes Windows DNS issues)
dnscache({
  enable: true,
  ttl: 300,
  cachesize: 1000,
});

// Force Node.js to use Google's DNS servers (fixes Windows DNS resolver issues)
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

let isConnected = false;

const createLogger = () => {
  return {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
  };
};

const logger = createLogger();

// Helper to check if error is IP whitelist issue
const isIPWhitelistError = (error) => {
  const message = error.message || '';
  return message.includes('IP') || message.includes('whitelist') || 
         (error.code === undefined && error.reason?.type === 'ReplicaSetNoPrimary');
};

export const connectDatabase = async () => {
  if (isConnected) {
    logger.info('MongoDB: Using existing connection');
    return;
  }

  logger.info('MongoDB: Starting connection attempt...');
  const isAtlasUri = config.mongodb.uri.includes('mongodb+srv://');
  const host = config.mongodb.uri.split('@')[1]?.split('/')[0];
  logger.info('MongoDB: URI host:', host);
  logger.info('MongoDB: Connection type:', isAtlasUri ? 'Atlas (Cloud)' : 'Local/Self-hosted');

  try {
    // Enhanced options for better reliability
    const connectionOptions = {
      ...config.mongodb.options,
      family: 4, // Force IPv4
      directConnection: false,
      retryWrites: true,
      retryReads: true,
    };
    
    logger.info('MongoDB: Connecting with options:', JSON.stringify(connectionOptions));
    
    const conn = await mongoose.connect(config.mongodb.uri, connectionOptions);
    
    isConnected = true;
    logger.info(`MongoDB: ✓ Connected successfully to ${conn.connection.host}`);
    logger.info(`MongoDB: Database: ${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB: Connection error', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB: Disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB: Reconnected');
      isConnected = true;
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB: Connection closed due to application termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('MongoDB: Connection failed', error.message);
    
    // Provide helpful error messages
    if (isIPWhitelistError(error)) {
      console.error('\n🚨 ============================================');
      console.error('🚨 MONGODB ATLAS IP WHITELIST ERROR');
      console.error('🚨 ============================================');
      console.error('\n📍 Your IP address is NOT allowed to access this cluster.\n');
      console.error('✅ FIX THIS IN MONGODB ATLAS:');
      console.error('   1. Go to: https://cloud.mongodb.com');
      console.error('   2. Select your project: "Mocktrails"');
      console.error('   3. Click "Network Access" (left sidebar)');
      console.error('   4. Click "Add IP Address"');
      console.error('   5. Choose one:');
      console.error('      - "Add Current IP Address" (recommended)');
      console.error('      - OR add 0.0.0.0/0 to allow all IPs (dev only)');
      console.error('\n📡 Current connection attempt: ' + host);
      console.error('🔗 MongoDB URI host: ' + host);
      console.error('\n============================================\n');
    } else if (error.name === 'MongoParseError') {
      console.error('\n🚨 Invalid MongoDB URI format');
      console.error('Check your MONGODB_URI in .env file\n');
    } else {
      console.error('\n🚨 MongoDB connection error:', error.message);
    }
    
    throw error;
  }
};

export const disconnectDatabase = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB: Connection closed');
  } catch (error) {
    logger.error('MongoDB: Error closing connection', error);
    throw error;
  }
};

export default { connectDatabase, disconnectDatabase };

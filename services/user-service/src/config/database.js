import mongoose from 'mongoose';
import config from './index.js';

let isConnected = false;

const createLogger = () => {
  return {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
  };
};

const logger = createLogger();

export const connectDatabase = async () => {
  if (isConnected) {
    logger.info('MongoDB: Using existing connection');
    return;
  }

  try {
    const conn = await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    
    isConnected = true;
    logger.info(`MongoDB: Connected successfully to ${conn.connection.host}`);

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
    logger.error('MongoDB: Connection failed', error);
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

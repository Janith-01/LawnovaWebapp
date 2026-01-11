import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * MongoDB connection configuration
 */
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lawnova_roleplay';

        const options = {
            // Connection pool settings
            maxPoolSize: 10,
            minPoolSize: 2,

            // Timeout settings
            serverSelectionTimeoutMS: 10000, // Increased to 10s
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,

            // Retry settings
            retryWrites: true,
            retryReads: true,
        };

        mongoose.connection.on('connected', () => {
            logger.info('✅ MongoDB connected successfully');
            logger.info(`📦 Database: ${mongoose.connection.name}`);
        });

        mongoose.connection.on('error', (err) => {
            logger.error('❌ MongoDB connection error:', err.message);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('⚠️ MongoDB disconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            logger.info('MongoDB connection closed due to app termination');
            process.exit(0);
        });

        logger.info('🔄 Connecting to MongoDB...');
        await mongoose.connect(mongoUri, options);

        return mongoose.connection;
    } catch (error) {
        logger.error('❌ Failed to connect to MongoDB:');
        logger.error(`Error: ${error.message}`);
        logger.error(`Stack: ${error.stack}`);

        // Don't exit immediately - let nodemon restart
        logger.warn('⚠️ Service will attempt to reconnect when files change...');
        throw error; // Throw to trigger nodemon restart
    }
};

export default connectDB;

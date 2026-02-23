import mongoose from 'mongoose';
import dns from 'dns';
import dnscache from 'dnscache';
import logger from '../utils/logger.js';

// Enable DNS caching (fixes common Windows Node.js DNS resolution issues)
dnscache({
    enable: true,
    ttl: 300,
    cachesize: 1000,
});

// Force Node.js to use reliable DNS servers for Atlas hostname resolution
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

/**
 * MongoDB connection configuration
 */
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lawnova_mocktrial';

        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 30000, // Increased to 30s for better stability
            socketTimeoutMS: 60000,
            connectTimeoutMS: 30000,
            family: 4, // Force IPv4 to avoid ENOTFOUND issues on some Windows/Node environments
        };

        mongoose.connection.on('connected', () => {
            logger.info('MongoDB connected successfully');
        });

        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            logger.info('MongoDB connection closed due to app termination');
            process.exit(0);
        });

        logger.info(`Connecting to MongoDB (URI: ${mongoUri.substring(0, 20)}...)`);
        await mongoose.connect(mongoUri, options);
        return mongoose.connection;
    } catch (error) {
        logger.error({ err: error }, 'Failed to connect to MongoDB');
        // Let nodemon handle the restart if it crashes
        throw error;
    }
};

export default connectDB;

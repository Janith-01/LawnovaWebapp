import http from 'http';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import config from './config/index.js';
import logger from './utils/logger.js';

const server = http.createServer(app);

const startServer = async () => {
  try {
    await connectDatabase();
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`API documentation available at http://localhost:${config.port}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await disconnectDatabase();
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Application specific logging, throwing an error, or other logic here
    process.exit(1);
});


startServer();

export default server;


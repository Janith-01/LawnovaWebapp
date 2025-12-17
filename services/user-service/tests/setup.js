import mongoose from 'mongoose';
import config from '../src/config/index.js';

// Use in-memory MongoDB for testing
beforeAll(async () => {
  // For testing with actual MongoDB, ensure a test database is used
  // Or use mongodb-memory-server for true in-memory testing
  if (!process.env.MONGODB_URI_TEST) {
    console.warn('MONGODB_URI_TEST not set, tests may fail');
  }
});

afterEach(async () => {
  // Clean up after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

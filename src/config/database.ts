import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env';
import { logger } from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.warn('Local MongoDB not detected on port 27017. Starting embedded MongoDB server...');
    try {
      const mongod = await MongoMemoryServer.create({
        instance: { dbName: 'qr_id_verification', port: 27017 },
      });
      await mongoose.connect(mongod.getUri());
      logger.info('Embedded MongoDB server running on port 27017');
    } catch (memErr) {
      logger.error('Failed to start MongoDB:', memErr);
      process.exit(1);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
});

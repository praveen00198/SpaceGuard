import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../shared/logger';

let isConnected = false;

// Disable Mongoose command buffering so queries fail-fast when disconnected instead of hanging
mongoose.set('bufferCommands', false);

/**
 * Sanitizes a MongoDB URI to remove embedded credentials for safe logging.
 */
export function sanitizeMongoUri(uri: string): string {
  try {
    return uri.replace(/\/\/(.*?)@/, '//***:***@');
  } catch {
    return 'mongodb://***';
  }
}

/**
 * Establishes connection to MongoDB via Mongoose.
 * Bounded by serverSelectionTimeoutMS to prevent hanging indefinitely.
 */
export async function connectDatabase(uri?: string): Promise<boolean> {
  const connectionUri = uri || config.mongodb.uri;
  const sanitized = sanitizeMongoUri(connectionUri);

  try {
    // If already connected, return true
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      return true;
    }

    logger.info('Connecting to MongoDB...', { uri: sanitized, dbName: config.mongodb.dbName });

    mongoose.connection.on('connected', () => {
      isConnected = true;
      logger.info('MongoDB connection established successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection runtime error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      logger.warn('MongoDB connection lost (disconnected)');
    });

    await mongoose.connect(connectionUri, {
      dbName: config.mongodb.dbName,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      autoIndex: true,
    });

    isConnected = true;
    return true;
  } catch (err: unknown) {
    isConnected = false;
    const message = err instanceof Error ? err.message : 'Unknown connection error';
    logger.error('Failed to connect to MongoDB', { error: message, uri: sanitized });
    return false;
  }
}

/**
 * Gracefully closes the MongoDB connection.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      isConnected = false;
      logger.info('MongoDB disconnected cleanly');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown disconnection error';
    logger.error('Error disconnecting from MongoDB', { error: message });
  }
}

/**
 * Returns whether the active Mongoose connection state is open (1).
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

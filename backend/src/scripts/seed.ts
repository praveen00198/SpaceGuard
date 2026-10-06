import { connectDatabase, disconnectDatabase } from '../config/database';
import { seedSatellites } from '../config/seed';
import { logger } from '../shared/logger';

async function run() {
  logger.info('Starting manual database seed...');
  const connected = await connectDatabase();
  if (!connected) {
    logger.error('Cannot run seed: MongoDB connection failed');
    process.exit(1);
  }

  try {
    const result = await seedSatellites();
    logger.info('Seed script finished successfully', result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown seed error';
    logger.error('Seed script failed', { error: message });
    process.exit(1);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

run();

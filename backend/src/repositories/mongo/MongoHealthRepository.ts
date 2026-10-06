import mongoose from 'mongoose';
import { IHealthSnapshot } from '../../shared/types';
import { IHealthRepository } from '../interfaces/IHealthRepository';
import { HealthSnapshotModel } from '../../models/HealthSnapshot';
import { logger } from '../../shared/logger';

function assertConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
}

export class MongoHealthRepository implements IHealthRepository {
  public async create(snapshot: IHealthSnapshot): Promise<IHealthSnapshot> {
    assertConnected();
    try {
      const created = await HealthSnapshotModel.create(snapshot);
      return created.toJSON() as unknown as IHealthSnapshot;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database write failed';
      logger.error('MongoHealthRepository.create failed', { error: message, satelliteId: snapshot.satelliteId });
      throw err;
    }
  }

  public async findLatest(satelliteId: string): Promise<IHealthSnapshot | null> {
    assertConnected();
    try {
      const doc = await HealthSnapshotModel.findOne({ satelliteId })
        .sort({ timestamp: -1 })
        .lean()
        .exec();
      return (doc as unknown as IHealthSnapshot) || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoHealthRepository.findLatest failed', { error: message, satelliteId });
      throw err;
    }
  }

  public async findHistory(satelliteId: string, limit = 100): Promise<IHealthSnapshot[]> {
    assertConnected();
    try {
      const safeLimit = Math.min(Math.max(limit, 1), 500);
      const docs = await HealthSnapshotModel.find({ satelliteId })
        .sort({ timestamp: -1 })
        .limit(safeLimit)
        .lean()
        .exec();
      return docs as unknown as IHealthSnapshot[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoHealthRepository.findHistory failed', { error: message, satelliteId });
      throw err;
    }
  }
}

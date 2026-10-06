import mongoose from 'mongoose';
import { IAnomaly } from '../../shared/types';
import {
  IAnomalyRepository,
  AnomalyFilterOptions,
} from '../interfaces/IAnomalyRepository';
import { AnomalyModel } from '../../models/Anomaly';
import { logger } from '../../shared/logger';

function assertConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
}

export class MongoAnomalyRepository implements IAnomalyRepository {
  public async findAll(filter?: AnomalyFilterOptions): Promise<IAnomaly[]> {
    assertConnected();
    try {
      const query: Record<string, unknown> = {};
      if (filter?.satelliteId) query.satelliteId = filter.satelliteId;
      if (filter?.severity) query.severity = filter.severity;
      if (filter?.status) query.status = filter.status;
      if (filter?.subsystem) query.subsystem = filter.subsystem;

      const limit = Math.min(Math.max(filter?.limit || 100, 1), 1000);

      const docs = await AnomalyModel.find(query)
        .sort({ detectedAt: -1 })
        .limit(limit)
        .lean()
        .exec();

      return docs as unknown as IAnomaly[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoAnomalyRepository.findAll failed', { error: message, filter });
      throw err;
    }
  }

  public async findById(anomalyId: string): Promise<IAnomaly | null> {
    assertConnected();
    try {
      const doc = await AnomalyModel.findOne({ anomalyId }).lean().exec();
      return (doc as unknown as IAnomaly) || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoAnomalyRepository.findById failed', { error: message, anomalyId });
      throw err;
    }
  }

  public async create(anomaly: IAnomaly): Promise<IAnomaly> {
    assertConnected();
    try {
      const created = await AnomalyModel.create(anomaly);
      return created.toJSON() as unknown as IAnomaly;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database write failed';
      logger.error('MongoAnomalyRepository.create failed', { error: message, anomalyId: anomaly.anomalyId });
      throw err;
    }
  }

  public async updateStatus(anomalyId: string, status: IAnomaly['status']): Promise<IAnomaly | null> {
    assertConnected();
    try {
      const doc = await AnomalyModel.findOneAndUpdate(
        { anomalyId },
        { $set: { status, updatedAt: new Date() } },
        { new: true }
      )
        .lean()
        .exec();

      return (doc as unknown as IAnomaly) || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database update failed';
      logger.error('MongoAnomalyRepository.updateStatus failed', { error: message, anomalyId, status });
      throw err;
    }
  }

  public async count(filter?: AnomalyFilterOptions): Promise<number> {
    assertConnected();
    try {
      const query: Record<string, unknown> = {};
      if (filter?.satelliteId) query.satelliteId = filter.satelliteId;
      if (filter?.severity) query.severity = filter.severity;
      if (filter?.status) query.status = filter.status;
      if (filter?.subsystem) query.subsystem = filter.subsystem;

      return await AnomalyModel.countDocuments(query).exec();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database count failed';
      logger.error('MongoAnomalyRepository.count failed', { error: message });
      throw err;
    }
  }

  public async clearAll(): Promise<void> {
    assertConnected();
    try {
      await AnomalyModel.deleteMany({}).exec();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database clear failed';
      logger.error('MongoAnomalyRepository.clearAll failed', { error: message });
      throw err;
    }
  }
}

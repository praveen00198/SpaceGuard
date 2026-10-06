import mongoose from 'mongoose';
import { IEnvironmentalEvent } from '../../shared/types';
import { IEnvironmentalEventRepository } from '../interfaces/IEnvironmentalEventRepository';
import { EnvironmentalEventModel } from '../../models/EnvironmentalEvent';
import { logger } from '../../shared/logger';

function assertConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
}

export class MongoEnvironmentalEventRepository implements IEnvironmentalEventRepository {
  public async create(event: IEnvironmentalEvent): Promise<IEnvironmentalEvent> {
    assertConnected();
    try {
      const created = await EnvironmentalEventModel.create(event);
      return created.toJSON() as unknown as IEnvironmentalEvent;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database write failed';
      logger.error('MongoEnvironmentalEventRepository.create failed', { error: message, eventId: event.eventId });
      throw err;
    }
  }

  public async createMany(events: IEnvironmentalEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    assertConnected();
    try {
      // Use ordered: false to skip duplicate event IDs
      const result = await EnvironmentalEventModel.insertMany(events, { ordered: false });
      return result.length;
    } catch (err: unknown) {
      // If error is duplicate key error, count inserted
      if (err && typeof err === 'object' && 'insertedDocs' in err) {
        return (err as { insertedDocs: unknown[] }).insertedDocs.length;
      }
      const message = err instanceof Error ? err.message : 'Batch insert failed';
      logger.warn('MongoEnvironmentalEventRepository.createMany partial/failed', { error: message });
      return 0;
    }
  }

  public async findById(eventId: string): Promise<IEnvironmentalEvent | null> {
    assertConnected();
    try {
      const doc = await EnvironmentalEventModel.findOne({ eventId }).lean().exec();
      return (doc as unknown as IEnvironmentalEvent) || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoEnvironmentalEventRepository.findById failed', { error: message, eventId });
      throw err;
    }
  }

  public async findByTimeRange(start: Date, end: Date, eventType?: string): Promise<IEnvironmentalEvent[]> {
    assertConnected();
    try {
      const filter: Record<string, unknown> = {
        timestamp: { $gte: start, $lte: end },
      };
      if (eventType) {
        filter.eventType = eventType;
      }
      const docs = await EnvironmentalEventModel.find(filter)
        .sort({ timestamp: -1 })
        .lean()
        .exec();
      return docs as unknown as IEnvironmentalEvent[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoEnvironmentalEventRepository.findByTimeRange failed', { error: message });
      throw err;
    }
  }

  public async findRecent(limit = 50): Promise<IEnvironmentalEvent[]> {
    assertConnected();
    try {
      const safeLimit = Math.min(Math.max(limit, 1), 200);
      const docs = await EnvironmentalEventModel.find()
        .sort({ timestamp: -1 })
        .limit(safeLimit)
        .lean()
        .exec();
      return docs as unknown as IEnvironmentalEvent[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoEnvironmentalEventRepository.findRecent failed', { error: message });
      throw err;
    }
  }

  public async count(): Promise<number> {
    assertConnected();
    try {
      return await EnvironmentalEventModel.countDocuments().exec();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database count failed';
      logger.error('MongoEnvironmentalEventRepository.count failed', { error: message });
      throw err;
    }
  }
}

import mongoose, { PipelineStage } from 'mongoose';
import { ITelemetryReading } from '../../shared/types';
import {
  ITelemetryRepository,
  TelemetryQueryOptions,
  TelemetryStats,
} from '../interfaces/ITelemetryRepository';
import { TelemetryReadingModel } from '../../models/TelemetryReading';
import { logger } from '../../shared/logger';

function assertConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
}

export class MongoTelemetryRepository implements ITelemetryRepository {
  public async create(reading: ITelemetryReading): Promise<ITelemetryReading> {
    assertConnected();
    try {
      const doc = await TelemetryReadingModel.create(reading);
      return doc.toJSON() as unknown as ITelemetryReading;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Telemetry insert failed';
      logger.error('MongoTelemetryRepository.create failed', { error: message, satelliteId: reading.satelliteId });
      throw err;
    }
  }

  public async createMany(readings: ITelemetryReading[]): Promise<number> {
    if (readings.length === 0) return 0;
    assertConnected();
    try {
      const res = await TelemetryReadingModel.insertMany(readings, { ordered: false });
      return res.length;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Telemetry batch insert failed';
      logger.error('MongoTelemetryRepository.createMany failed', { error: message, count: readings.length });
      throw err;
    }
  }

  public async findLatest(satelliteId: string): Promise<ITelemetryReading[]> {
    assertConnected();
    try {
      const pipeline: PipelineStage[] = [
        { $match: { satelliteId } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$parameter',
            latest: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latest' } },
        { $project: { _id: 0, __v: 0 } },
      ];

      const results = await TelemetryReadingModel.aggregate(pipeline).exec();
      return results as unknown as ITelemetryReading[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Telemetry findLatest aggregation failed';
      logger.error('MongoTelemetryRepository.findLatest failed', { error: message, satelliteId });
      throw err;
    }
  }

  public async findHistory(query: TelemetryQueryOptions): Promise<ITelemetryReading[]> {
    assertConnected();
    try {
      const filter: Record<string, unknown> = {};
      if (query.satelliteId) filter.satelliteId = query.satelliteId;
      if (query.parameter) filter.parameter = query.parameter;
      if (query.subsystem) filter.subsystem = query.subsystem;

      if (query.startTime || query.endTime) {
        const timeFilter: Record<string, Date> = {};
        if (query.startTime) timeFilter.$gte = query.startTime;
        if (query.endTime) timeFilter.$lte = query.endTime;
        filter.timestamp = timeFilter;
      }

      const limit = Math.min(Math.max(query.limit || 500, 1), 2000);

      const docs = await TelemetryReadingModel.find(filter)
        .sort({ timestamp: 1 })
        .limit(limit)
        .lean()
        .exec();

      return docs as unknown as ITelemetryReading[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Telemetry findHistory query failed';
      logger.error('MongoTelemetryRepository.findHistory failed', { error: message, query });
      throw err;
    }
  }

  public async getStats(satelliteId: string): Promise<TelemetryStats> {
    assertConnected();
    try {
      const totalReadings = await TelemetryReadingModel.countDocuments({ satelliteId }).exec();
      const distinctParams = await TelemetryReadingModel.distinct('parameter', { satelliteId }).exec();

      const latestDoc = await TelemetryReadingModel.findOne({ satelliteId })
        .sort({ timestamp: -1 })
        .select('ingestedAt')
        .lean()
        .exec();

      const latest = latestDoc as unknown as { ingestedAt?: Date } | null;

      return {
        totalReadings,
        activeParametersCount: distinctParams.length,
        lastIngestedAt: latest?.ingestedAt || null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Telemetry getStats failed';
      logger.error('MongoTelemetryRepository.getStats failed', { error: message, satelliteId });
      throw err;
    }
  }
}

import mongoose from 'mongoose';
import { ISatellite } from '../../shared/types';
import { ISatelliteRepository } from '../interfaces/ISatelliteRepository';
import { SatelliteModel } from '../../models/Satellite';
import { logger } from '../../shared/logger';

function assertConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
}

export class MongoSatelliteRepository implements ISatelliteRepository {
  public async findAll(): Promise<ISatellite[]> {
    assertConnected();
    try {
      const docs = await SatelliteModel.find().sort({ satelliteId: 1 }).lean().exec();
      return docs as unknown as ISatellite[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoSatelliteRepository.findAll failed', { error: message });
      throw err;
    }
  }

  public async findById(satelliteId: string): Promise<ISatellite | null> {
    assertConnected();
    try {
      const doc = await SatelliteModel.findOne({ satelliteId }).lean().exec();
      return (doc as unknown as ISatellite) || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoSatelliteRepository.findById failed', { error: message, satelliteId });
      throw err;
    }
  }

  public async create(satellite: ISatellite): Promise<ISatellite> {
    assertConnected();
    try {
      const created = await SatelliteModel.create(satellite);
      return created.toJSON() as unknown as ISatellite;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database write failed';
      logger.error('MongoSatelliteRepository.create failed', { error: message, satelliteId: satellite.satelliteId });
      throw err;
    }
  }

  public async update(satelliteId: string, updates: Partial<ISatellite>): Promise<ISatellite | null> {
    assertConnected();
    try {
      const doc = await SatelliteModel.findOneAndUpdate(
        { satelliteId },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true }
      )
        .lean()
        .exec();
      return (doc as unknown as ISatellite) || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database update failed';
      logger.error('MongoSatelliteRepository.update failed', { error: message, satelliteId });
      throw err;
    }
  }

  public async delete(satelliteId: string): Promise<boolean> {
    assertConnected();
    try {
      const res = await SatelliteModel.deleteOne({ satelliteId }).exec();
      return res.deletedCount > 0;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database delete failed';
      logger.error('MongoSatelliteRepository.delete failed', { error: message, satelliteId });
      throw err;
    }
  }

  public async count(): Promise<number> {
    assertConnected();
    try {
      return await SatelliteModel.countDocuments().exec();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database count failed';
      logger.error('MongoSatelliteRepository.count failed', { error: message });
      throw err;
    }
  }
}

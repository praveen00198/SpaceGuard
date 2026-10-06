import mongoose from 'mongoose';
import { IEvidence } from '../../shared/types';
import { IEvidenceRepository } from '../interfaces/IEvidenceRepository';
import { EvidenceModel } from '../../models/Evidence';
import { logger } from '../../shared/logger';

function assertConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
}

export class MongoEvidenceRepository implements IEvidenceRepository {
  public async create(evidence: IEvidence): Promise<IEvidence> {
    assertConnected();
    try {
      const created = await EvidenceModel.create(evidence);
      return created.toJSON() as unknown as IEvidence;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database write failed';
      logger.error('MongoEvidenceRepository.create failed', { error: message, evidenceId: evidence.evidenceId });
      throw err;
    }
  }

  public async findById(evidenceId: string): Promise<IEvidence | null> {
    assertConnected();
    try {
      const doc = await EvidenceModel.findOne({ evidenceId }).lean().exec();
      return (doc as unknown as IEvidence) || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoEvidenceRepository.findById failed', { error: message, evidenceId });
      throw err;
    }
  }

  public async findByIds(evidenceIds: string[]): Promise<IEvidence[]> {
    if (evidenceIds.length === 0) return [];
    assertConnected();
    try {
      const docs = await EvidenceModel.find({ evidenceId: { $in: evidenceIds } })
        .lean()
        .exec();
      return docs as unknown as IEvidence[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoEvidenceRepository.findByIds failed', { error: message, count: evidenceIds.length });
      throw err;
    }
  }

  public async findAll(limit = 100): Promise<IEvidence[]> {
    assertConnected();
    try {
      const safeLimit = Math.min(Math.max(limit, 1), 500);
      const docs = await EvidenceModel.find()
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean()
        .exec();
      return docs as unknown as IEvidence[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoEvidenceRepository.findAll failed', { error: message });
      throw err;
    }
  }

  public async getNextSequence(source: string): Promise<number> {
    assertConnected();
    try {
      const prefix = source.toUpperCase().slice(0, 3);
      const latest = await EvidenceModel.findOne({
        evidenceId: new RegExp(`^EVID-${prefix}-\\d+$`),
      })
        .sort({ createdAt: -1 })
        .select('evidenceId')
        .lean()
        .exec();

      const latestDoc = latest as unknown as { evidenceId?: string } | null;
      if (latestDoc && latestDoc.evidenceId) {
        const parts = latestDoc.evidenceId.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          return lastNum + 1;
        }
      }

      const total = await EvidenceModel.countDocuments({ source }).exec();
      return total + 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sequence query failed';
      logger.error('MongoEvidenceRepository.getNextSequence failed', { error: message, source });
      throw err;
    }
  }
}

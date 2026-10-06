import mongoose from 'mongoose';
import { IAIAssessment } from '../../shared/types';
import { IAIAssessmentRepository } from '../interfaces/IAIAssessmentRepository';
import { AIAssessmentModel } from '../../models/AIAssessment';
import { logger } from '../../shared/logger';

function assertConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
}

export class MongoAIAssessmentRepository implements IAIAssessmentRepository {
  public async create(assessment: IAIAssessment): Promise<IAIAssessment> {
    assertConnected();
    try {
      const created = await AIAssessmentModel.create(assessment);
      return created.toJSON() as unknown as IAIAssessment;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database write failed';
      logger.error('MongoAIAssessmentRepository.create failed', { error: message, assessmentId: assessment.assessmentId });
      throw err;
    }
  }

  public async findByAnomalyId(anomalyId: string): Promise<IAIAssessment | null> {
    assertConnected();
    try {
      const doc = await AIAssessmentModel.findOne({ anomalyId })
        .sort({ requestedAt: -1 })
        .lean()
        .exec();
      return (doc as unknown as IAIAssessment) || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoAIAssessmentRepository.findByAnomalyId failed', { error: message, anomalyId });
      throw err;
    }
  }

  public async findBySatelliteId(satelliteId: string, limit = 50): Promise<IAIAssessment[]> {
    assertConnected();
    try {
      const safeLimit = Math.min(Math.max(limit, 1), 200);
      const docs = await AIAssessmentModel.find({ satelliteId })
        .sort({ requestedAt: -1 })
        .limit(safeLimit)
        .lean()
        .exec();
      return docs as unknown as IAIAssessment[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database query failed';
      logger.error('MongoAIAssessmentRepository.findBySatelliteId failed', { error: message, satelliteId });
      throw err;
    }
  }
}

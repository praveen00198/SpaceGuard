import { IAIAssessment } from '../../shared/types';

export interface IAIAssessmentRepository {
  create(assessment: IAIAssessment): Promise<IAIAssessment>;
  findByAnomalyId(anomalyId: string): Promise<IAIAssessment | null>;
  findBySatelliteId(satelliteId: string, limit?: number): Promise<IAIAssessment[]>;
}

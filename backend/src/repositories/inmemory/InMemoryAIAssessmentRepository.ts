import { IAIAssessment } from '../../shared/types';
import { IAIAssessmentRepository } from '../interfaces/IAIAssessmentRepository';

export class InMemoryAIAssessmentRepository implements IAIAssessmentRepository {
  private assessments = new Map<string, IAIAssessment>();

  public async create(assessment: IAIAssessment): Promise<IAIAssessment> {
    const copy = { ...assessment };
    this.assessments.set(assessment.anomalyId, copy);
    return copy;
  }

  public async findByAnomalyId(anomalyId: string): Promise<IAIAssessment | null> {
    const a = this.assessments.get(anomalyId);
    return a ? { ...a } : null;
  }

  public async findBySatelliteId(satelliteId: string, limit = 50): Promise<IAIAssessment[]> {
    const list = Array.from(this.assessments.values()).filter(a => a.satelliteId === satelliteId);
    list.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    return list.slice(0, limit).map(a => ({ ...a }));
  }

  public clear(): void {
    this.assessments.clear();
  }
}

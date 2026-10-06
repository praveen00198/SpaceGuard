import { IEvidence } from '../../shared/types';

export interface IEvidenceRepository {
  create(evidence: IEvidence): Promise<IEvidence>;
  findById(evidenceId: string): Promise<IEvidence | null>;
  findByIds(evidenceIds: string[]): Promise<IEvidence[]>;
  findAll(limit?: number): Promise<IEvidence[]>;
  getNextSequence(source: string): Promise<number>;
}

import { IAnomaly, AnomalySeverity } from '../../shared/types';

export interface AnomalyFilterOptions {
  satelliteId?: string;
  severity?: AnomalySeverity;
  status?: string;
  subsystem?: string;
  limit?: number;
}

export interface IAnomalyRepository {
  findAll(filter?: AnomalyFilterOptions): Promise<IAnomaly[]>;
  findById(anomalyId: string): Promise<IAnomaly | null>;
  create(anomaly: IAnomaly): Promise<IAnomaly>;
  updateStatus(anomalyId: string, status: IAnomaly['status']): Promise<IAnomaly | null>;
  count(filter?: AnomalyFilterOptions): Promise<number>;
  clearAll?(): Promise<void>;
}

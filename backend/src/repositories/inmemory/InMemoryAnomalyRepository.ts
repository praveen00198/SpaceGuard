import { IAnomaly } from '../../shared/types';
import {
  IAnomalyRepository,
  AnomalyFilterOptions,
} from '../interfaces/IAnomalyRepository';

export class InMemoryAnomalyRepository implements IAnomalyRepository {
  private anomalies = new Map<string, IAnomaly>();

  public async findAll(filter?: AnomalyFilterOptions): Promise<IAnomaly[]> {
    let list = Array.from(this.anomalies.values());

    if (filter?.satelliteId) {
      list = list.filter(a => a.satelliteId === filter.satelliteId);
    }
    if (filter?.severity) {
      list = list.filter(a => a.severity === filter.severity);
    }
    if (filter?.status) {
      list = list.filter(a => a.status === filter.status);
    }
    if (filter?.subsystem) {
      list = list.filter(a => a.subsystem === filter.subsystem);
    }

    list.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }

    return list.map(a => ({ ...a }));
  }

  public async findById(anomalyId: string): Promise<IAnomaly | null> {
    const a = this.anomalies.get(anomalyId);
    return a ? { ...a } : null;
  }

  public async create(anomaly: IAnomaly): Promise<IAnomaly> {
    const copy = { ...anomaly };
    this.anomalies.set(anomaly.anomalyId, copy);
    return copy;
  }

  public async updateStatus(anomalyId: string, status: IAnomaly['status']): Promise<IAnomaly | null> {
    const existing = this.anomalies.get(anomalyId);
    if (!existing) return null;
    const updated = { ...existing, status, updatedAt: new Date() };
    this.anomalies.set(anomalyId, updated);
    return { ...updated };
  }

  public async count(filter?: AnomalyFilterOptions): Promise<number> {
    const list = await this.findAll(filter);
    return list.length;
  }

  public async clearAll(): Promise<void> {
    this.anomalies.clear();
  }
}

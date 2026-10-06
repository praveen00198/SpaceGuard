import { IHealthSnapshot } from '../../shared/types';
import { IHealthRepository } from '../interfaces/IHealthRepository';

export class InMemoryHealthRepository implements IHealthRepository {
  private snapshots: IHealthSnapshot[] = [];

  public async create(snapshot: IHealthSnapshot): Promise<IHealthSnapshot> {
    const copy = { ...snapshot };
    this.snapshots.push(copy);
    return copy;
  }

  public async findLatest(satelliteId: string): Promise<IHealthSnapshot | null> {
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].satelliteId === satelliteId) {
        return { ...this.snapshots[i] };
      }
    }
    return null;
  }

  public async findHistory(satelliteId: string, limit = 100): Promise<IHealthSnapshot[]> {
    const list = this.snapshots.filter(s => s.satelliteId === satelliteId);
    list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return list.slice(0, limit).map(s => ({ ...s }));
  }

  public clear(): void {
    this.snapshots = [];
  }
}

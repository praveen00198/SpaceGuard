import { IHealthSnapshot } from '../../shared/types';

export interface IHealthRepository {
  create(snapshot: IHealthSnapshot): Promise<IHealthSnapshot>;
  findLatest(satelliteId: string): Promise<IHealthSnapshot | null>;
  findHistory(satelliteId: string, limit?: number): Promise<IHealthSnapshot[]>;
}

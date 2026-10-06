import { IEnvironmentalEvent } from '../../shared/types';

export interface IEnvironmentalEventRepository {
  create(event: IEnvironmentalEvent): Promise<IEnvironmentalEvent>;
  createMany(events: IEnvironmentalEvent[]): Promise<number>;
  findById(eventId: string): Promise<IEnvironmentalEvent | null>;
  findByTimeRange(start: Date, end: Date, eventType?: string): Promise<IEnvironmentalEvent[]>;
  findRecent(limit?: number): Promise<IEnvironmentalEvent[]>;
  count(): Promise<number>;
}

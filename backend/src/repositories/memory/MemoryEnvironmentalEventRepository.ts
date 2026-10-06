import { IEnvironmentalEvent } from '../../shared/types';
import { IEnvironmentalEventRepository } from '../interfaces/IEnvironmentalEventRepository';

export class MemoryEnvironmentalEventRepository implements IEnvironmentalEventRepository {
  private events = new Map<string, IEnvironmentalEvent>();

  public async create(event: IEnvironmentalEvent): Promise<IEnvironmentalEvent> {
    this.events.set(event.eventId, { ...event });
    return { ...event };
  }

  public async createMany(events: IEnvironmentalEvent[]): Promise<number> {
    let count = 0;
    for (const event of events) {
      if (!this.events.has(event.eventId)) {
        this.events.set(event.eventId, { ...event });
        count++;
      }
    }
    return count;
  }

  public async findById(eventId: string): Promise<IEnvironmentalEvent | null> {
    const event = this.events.get(eventId);
    return event ? { ...event } : null;
  }

  public async findByTimeRange(start: Date, end: Date, eventType?: string): Promise<IEnvironmentalEvent[]> {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return Array.from(this.events.values())
      .filter((e) => {
        const t = new Date(e.timestamp).getTime();
        if (t < startTime || t > endTime) return false;
        if (eventType && e.eventType !== eventType) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public async findRecent(limit = 50): Promise<IEnvironmentalEvent[]> {
    return Array.from(this.events.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  public async count(): Promise<number> {
    return this.events.size;
  }

  public clear(): void {
    this.events.clear();
  }
}

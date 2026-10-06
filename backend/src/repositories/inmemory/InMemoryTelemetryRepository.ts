import { ITelemetryReading } from '../../shared/types';
import {
  ITelemetryRepository,
  TelemetryQueryOptions,
  TelemetryStats,
} from '../interfaces/ITelemetryRepository';

export class InMemoryTelemetryRepository implements ITelemetryRepository {
  private readings: ITelemetryReading[] = [];

  public async create(reading: ITelemetryReading): Promise<ITelemetryReading> {
    const copy = { ...reading };
    this.readings.push(copy);
    return copy;
  }

  public async createMany(readings: ITelemetryReading[]): Promise<number> {
    for (const r of readings) {
      this.readings.push({ ...r });
    }
    return readings.length;
  }

  public async findLatest(satelliteId: string): Promise<ITelemetryReading[]> {
    const latestMap = new Map<string, ITelemetryReading>();
    for (const r of this.readings) {
      if (r.satelliteId === satelliteId) {
        const existing = latestMap.get(r.parameter);
        if (!existing || r.timestamp.getTime() >= existing.timestamp.getTime()) {
          latestMap.set(r.parameter, { ...r });
        }
      }
    }
    return Array.from(latestMap.values());
  }

  public async findHistory(query: TelemetryQueryOptions): Promise<ITelemetryReading[]> {
    let list = this.readings.filter(r => {
      if (query.satelliteId && r.satelliteId !== query.satelliteId) return false;
      if (query.parameter && r.parameter !== query.parameter) return false;
      if (query.subsystem && r.subsystem !== query.subsystem) return false;
      if (query.startTime && r.timestamp.getTime() < query.startTime.getTime()) return false;
      if (query.endTime && r.timestamp.getTime() > query.endTime.getTime()) return false;
      return true;
    });

    list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const limit = query.limit || 500;
    return list.slice(-limit).map(r => ({ ...r }));
  }

  public async getStats(satelliteId: string): Promise<TelemetryStats> {
    const craftReadings = this.readings.filter(r => r.satelliteId === satelliteId);
    const params = new Set(craftReadings.map(r => r.parameter));
    const last = craftReadings.length > 0 ? craftReadings[craftReadings.length - 1].ingestedAt : null;

    return {
      totalReadings: craftReadings.length,
      activeParametersCount: params.size,
      lastIngestedAt: last,
    };
  }

  public clear(): void {
    this.readings = [];
  }
}

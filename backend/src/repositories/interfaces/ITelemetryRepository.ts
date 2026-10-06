import { ITelemetryReading } from '../../shared/types';

export interface TelemetryQueryOptions {
  satelliteId?: string;
  parameter?: string;
  subsystem?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

export interface TelemetryStats {
  totalReadings: number;
  activeParametersCount: number;
  lastIngestedAt: Date | null;
}

export interface ITelemetryRepository {
  create(reading: ITelemetryReading): Promise<ITelemetryReading>;
  createMany(readings: ITelemetryReading[]): Promise<number>;
  findLatest(satelliteId: string): Promise<ITelemetryReading[]>;
  findHistory(query: TelemetryQueryOptions): Promise<ITelemetryReading[]>;
  getStats(satelliteId: string): Promise<TelemetryStats>;
}

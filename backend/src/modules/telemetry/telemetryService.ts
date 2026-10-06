import { ITelemetryReading, IAnomaly } from '../../shared/types';
import { TelemetryReadingInput } from './schemas';
import { TelemetryNormalizer } from './normalizer';
import { AnomalyService } from '../anomalies/anomalyService';
import { ITelemetryRepository, TelemetryQueryOptions, TelemetryStats } from '../../repositories/interfaces/ITelemetryRepository';
import { getTelemetryRepository } from '../../repositories';
import { logger } from '../../shared/logger';

// In-memory ring buffer per satellite (10,000 readings per spacecraft)
const MAX_READINGS_PER_SATELLITE = 10000;
const readingsStore = new Map<string, ITelemetryReading[]>();
// Cache of latest reading per (satelliteId:parameter)
const latestReadingsCache = new Map<string, ITelemetryReading>();

// Batch persistence queue configuration
const BATCH_FLUSH_INTERVAL_MS = 1000;
const BATCH_SIZE_THRESHOLD = 50;
const MAX_QUEUE_SIZE = 5000;

type TelemetryListener = (reading: ITelemetryReading, anomaly: IAnomaly | null) => void;
const telemetryListeners: TelemetryListener[] = [];

export class TelemetryService {
  private static repository: ITelemetryRepository | null = null;
  private static persistenceQueue: ITelemetryReading[] = [];
  private static flushTimer: NodeJS.Timeout | null = null;
  private static isFlushing = false;

  private static getRepo(): ITelemetryRepository {
    return this.repository || getTelemetryRepository();
  }

  public static setRepository(repo: ITelemetryRepository): void {
    this.repository = repo;
  }

  public static onTelemetry(listener: TelemetryListener): void {
    telemetryListeners.push(listener);
  }

  /**
   * Starts background persistence timer if not running.
   */
  private static ensureFlushTimer(): void {
    if (!this.flushTimer && process.env.NODE_ENV !== 'test') {
      this.flushTimer = setInterval(() => {
        if (this.persistenceQueue.length > 0) {
          this.flushQueue().catch((err) => {
            logger.warn('Telemetry periodic flush failed', { error: err.message });
          });
        }
      }, BATCH_FLUSH_INTERVAL_MS);
      if (this.flushTimer && typeof this.flushTimer.unref === 'function') {
        this.flushTimer.unref();
      }
    }
  }

  /**
   * Ingests a single telemetry reading.
   * Normalizes, updates real-time ring buffer, triggers anomaly detection,
   * enqueues for controlled database persistence, and broadcasts to listeners.
   */
  public static async ingestReading(input: TelemetryReadingInput): Promise<{
    reading: ITelemetryReading;
    anomaly: IAnomaly | null;
  }> {
    this.ensureFlushTimer();
    const reading = TelemetryNormalizer.normalize(input);
    const satId = reading.satelliteId;

    // 1. Save to in-memory real-time ring buffer
    let buffer = readingsStore.get(satId);
    if (!buffer) {
      buffer = [];
      readingsStore.set(satId, buffer);
    }
    buffer.push(reading);
    if (buffer.length > MAX_READINGS_PER_SATELLITE) {
      buffer.shift();
    }

    // 2. Update latest cache
    const cacheKey = `${satId}:${reading.parameter}`;
    latestReadingsCache.set(cacheKey, reading);

    // 3. Controlled Persistence Queue
    if (this.persistenceQueue.length < MAX_QUEUE_SIZE) {
      this.persistenceQueue.push(reading);
    } else {
      logger.warn('Telemetry persistence queue full, dropping oldest item to avoid memory leak', {
        queueSize: this.persistenceQueue.length,
      });
      this.persistenceQueue.shift();
      this.persistenceQueue.push(reading);
    }

    // Immediate flush if queue exceeds batch threshold
    if (this.persistenceQueue.length >= BATCH_SIZE_THRESHOLD) {
      this.flushQueue().catch((err) => {
        logger.warn('Telemetry threshold flush failed', { error: err.message });
      });
    }

    // 4. Evaluate in Anomaly Engine
    let anomaly: IAnomaly | null = null;
    try {
      anomaly = await AnomalyService.processReading(reading);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Error processing reading in anomaly engine', { error: message });
    }

    // 5. Broadcast to WebSocket listeners
    for (const listener of telemetryListeners) {
      try {
        listener(reading, anomaly);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Error notifying telemetry listener', { error: message });
      }
    }

    return { reading, anomaly };
  }

  /**
   * Flushes all currently pending telemetry readings to persistent repository.
   */
  public static async flushQueue(): Promise<number> {
    if (this.isFlushing || this.persistenceQueue.length === 0) {
      return 0;
    }

    this.isFlushing = true;
    const batch = [...this.persistenceQueue];
    this.persistenceQueue = [];

    try {
      const inserted = await this.getRepo().createMany(batch);
      return inserted;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to flush telemetry batch to database, re-queuing within limit', {
        error: message,
        batchCount: batch.length,
      });
      // Re-queue items that failed, up to MAX_QUEUE_SIZE
      const combined = [...batch, ...this.persistenceQueue];
      this.persistenceQueue = combined.slice(-MAX_QUEUE_SIZE);
      return 0;
    } finally {
      this.isFlushing = false;
    }
  }

  public static async ingestBatch(inputs: TelemetryReadingInput[]): Promise<{
    ingested: number;
    anomaliesDetected: number;
  }> {
    let anomaliesDetected = 0;
    for (const item of inputs) {
      const res = await this.ingestReading(item);
      if (res.anomaly) anomaliesDetected++;
    }
    // Flush immediately after a batch ingest
    await this.flushQueue();
    return { ingested: inputs.length, anomaliesDetected };
  }

  public static async getLatestReadings(satelliteId: string): Promise<ITelemetryReading[]> {
    // 1. Try instantaneous in-memory cache
    const results: ITelemetryReading[] = [];
    const prefix = `${satelliteId}:`;
    for (const [key, reading] of latestReadingsCache.entries()) {
      if (key.startsWith(prefix)) {
        results.push(reading);
      }
    }

    if (results.length > 0) {
      return results;
    }

    // 2. Fallback to persistent repository if in-memory cache is cold (e.g. after restart)
    try {
      const dbLatest = await this.getRepo().findLatest(satelliteId);
      for (const r of dbLatest) {
        latestReadingsCache.set(`${satelliteId}:${r.parameter}`, r);
      }
      return dbLatest;
    } catch {
      return [];
    }
  }

  public static async getHistory(query: TelemetryQueryOptions): Promise<ITelemetryReading[]> {
    const limit = query.limit || 500;

    // 1. Try persistent repository for historical range query
    try {
      const dbResults = await this.getRepo().findHistory(query);
      if (dbResults.length > 0) {
        return dbResults;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Failed to query telemetry history from repository, falling back to ring buffer', {
        error: message,
      });
    }

    // 2. Fallback to in-memory ring buffer
    let list: ITelemetryReading[] = [];
    if (query.satelliteId) {
      list = readingsStore.get(query.satelliteId) || [];
    } else {
      for (const buf of readingsStore.values()) {
        list.push(...buf);
      }
    }

    if (query.parameter) {
      list = list.filter((r) => r.parameter === query.parameter);
    }
    if (query.subsystem) {
      list = list.filter((r) => r.subsystem === query.subsystem);
    }
    if (query.startTime) {
      list = list.filter((r) => r.timestamp.getTime() >= query.startTime!.getTime());
    }
    if (query.endTime) {
      list = list.filter((r) => r.timestamp.getTime() <= query.endTime!.getTime());
    }

    return list.slice(-limit);
  }

  public static async getStats(satelliteId: string): Promise<TelemetryStats> {
    try {
      return await this.getRepo().getStats(satelliteId);
    } catch {
      const readings = readingsStore.get(satelliteId) || [];
      const latest = await this.getLatestReadings(satelliteId);
      return {
        totalReadings: readings.length,
        activeParametersCount: latest.length,
        lastIngestedAt: readings.length > 0 ? readings[readings.length - 1].ingestedAt : null,
      };
    }
  }

  public static clearCache(): void {
    readingsStore.clear();
    latestReadingsCache.clear();
  }

  public static clearAll(): void {
    readingsStore.clear();
    latestReadingsCache.clear();
    this.persistenceQueue = [];
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

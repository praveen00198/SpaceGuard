import {
  IHealthSnapshot,
  ISubsystemHealth,
  TelemetrySubsystem,
  HealthStatus,
  ITelemetryReading,
} from '../../shared/types';
import { AnomalyService } from '../anomalies/anomalyService';
import { IHealthRepository } from '../../repositories/interfaces/IHealthRepository';
import { getHealthRepository } from '../../repositories';
import { logger } from '../../shared/logger';

export class HealthService {
  private static repository: IHealthRepository | null = null;

  private static getRepo(): IHealthRepository {
    return this.repository || getHealthRepository();
  }

  public static setRepository(repo: IHealthRepository): void {
    this.repository = repo;
  }

  /**
   * Deterministically calculates health scores and persists the snapshot.
   */
  public static computeHealth(satelliteId: string, latestReadings: ITelemetryReading[]): IHealthSnapshot {
    const activeAnomalies = AnomalyService.getActiveAnomaliesSync(satelliteId);

    const subsystems: TelemetrySubsystem[] = ['power', 'thermal', 'communication', 'attitude', 'payload'];
    const subsystemResults: Record<TelemetrySubsystem, ISubsystemHealth> = {
      power: { score: 100, status: 'nominal' },
      thermal: { score: 100, status: 'nominal' },
      communication: { score: 100, status: 'nominal' },
      attitude: { score: 100, status: 'nominal' },
      payload: { score: 100, status: 'nominal' },
    };

    for (const sub of subsystems) {
      let score = 100;
      const subAnomalies = activeAnomalies.filter((a) => a.subsystem === sub);

      for (const anom of subAnomalies) {
        if (anom.severity === 'critical') {
          score -= 40;
        } else if (anom.severity === 'high') {
          score -= 25;
        } else if (anom.severity === 'medium') {
          score -= 15;
        } else {
          score -= 5;
        }
      }

      // Check for missing data in latest readings
      const subReadings = latestReadings.filter((r) => r.subsystem === sub);
      if (subReadings.length === 0) {
        score = Math.min(score, 75);
      }

      score = Math.max(0, Math.min(100, score));

      let status: HealthStatus = 'nominal';
      if (score < 40) {
        status = 'critical';
      } else if (score < 75) {
        status = 'degraded';
      }

      subsystemResults[sub] = { score, status };
    }

    // Subsystem weights: Power: 30%, Thermal: 25%, Comm: 20%, Attitude: 15%, Payload: 10%
    const weights: Record<TelemetrySubsystem, number> = {
      power: 0.3,
      thermal: 0.25,
      communication: 0.2,
      attitude: 0.15,
      payload: 0.1,
    };

    const overallHealth = Math.round(
      subsystems.reduce((acc, sub) => acc + subsystemResults[sub].score * weights[sub], 0)
    );

    let overallStatus: HealthStatus = 'nominal';
    if (overallHealth < 50 || Object.values(subsystemResults).some((s) => s.status === 'critical')) {
      overallStatus = 'critical';
    } else if (overallHealth < 80 || Object.values(subsystemResults).some((s) => s.status === 'degraded')) {
      overallStatus = 'degraded';
    }

    const snapshot: IHealthSnapshot = {
      satelliteId,
      timestamp: new Date(),
      subsystems: subsystemResults,
      overallHealth,
      overallStatus,
      activeAnomalies: activeAnomalies.length,
    };

    // Asynchronously persist snapshot without blocking callers
    this.recordSnapshot(snapshot).catch((err) => {
      logger.warn('Failed to persist health snapshot', { error: err.message, satelliteId });
    });

    return snapshot;
  }

  public static async recordSnapshot(snapshot: IHealthSnapshot): Promise<IHealthSnapshot> {
    try {
      return await this.getRepo().create(snapshot);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown write error';
      logger.warn('Health snapshot persistence failed', { error: message, satelliteId: snapshot.satelliteId });
      return snapshot;
    }
  }

  public static async getLatestHealth(satelliteId: string): Promise<IHealthSnapshot | null> {
    try {
      return await this.getRepo().findLatest(satelliteId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Failed to fetch latest health snapshot', { error: message, satelliteId });
      return null;
    }
  }

  public static async getHealthHistory(satelliteId: string, limit = 50): Promise<IHealthSnapshot[]> {
    try {
      return await this.getRepo().findHistory(satelliteId, limit);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Failed to fetch health history', { error: message, satelliteId });
      return [];
    }
  }
}

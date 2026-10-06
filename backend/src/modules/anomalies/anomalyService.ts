import {
  IAnomaly,
  ITelemetryReading,
  DetectionMethod,
  AnomalySeverity,
  AnomalyType,
} from '../../shared/types';
import { RuleEngine } from './ruleEngine';
import { StatisticalEngine } from './statisticalEngine';
import { MLEngine } from './mlEngine';
import { EvidenceService } from '../evidence/evidenceService';
import {
  IAnomalyRepository,
  AnomalyFilterOptions,
} from '../../repositories/interfaces/IAnomalyRepository';
import { getAnomalyRepository } from '../../repositories';
import { logger } from '../../shared/logger';

const anomaliesStore = new Map<string, IAnomaly>();
let anomalyCounter = 1;

type AnomalyListener = (anomaly: IAnomaly) => void;
const anomalyListeners: AnomalyListener[] = [];

export class AnomalyService {
  private static repository: IAnomalyRepository | null = null;

  private static getRepo(): IAnomalyRepository {
    return this.repository || getAnomalyRepository();
  }

  public static setRepository(repo: IAnomalyRepository): void {
    this.repository = repo;
    anomaliesStore.clear();
  }

  public static onAnomaly(listener: AnomalyListener): void {
    anomalyListeners.push(listener);
  }

  public static async processReading(reading: ITelemetryReading): Promise<IAnomaly | null> {
    const ruleRes = RuleEngine.evaluate(reading);
    const statRes = StatisticalEngine.evaluate(reading);
    const mlRes = await MLEngine.evaluate(reading);

    const methodsTriggered: DetectionMethod[] = [];
    if (ruleRes.detected) methodsTriggered.push('rule');
    if (statRes.detected) methodsTriggered.push('statistical');
    if (mlRes.detected) methodsTriggered.push('ml');

    if (methodsTriggered.length === 0) {
      return null;
    }

    // Determine detection method
    const detectionMethod: DetectionMethod = methodsTriggered.length > 1 ? 'hybrid' : methodsTriggered[0];

    // Compute composite anomaly score (0.0 - 1.0)
    const scores = [
      ruleRes.detected ? ruleRes.score : 0,
      statRes.detected ? statRes.score : 0,
      mlRes.detected ? mlRes.score : 0,
    ];
    const maxScore = Math.max(...scores);
    const avgActiveScore = scores.filter((s) => s > 0).reduce((a, b) => a + b, 0) / methodsTriggered.length;
    const anomalyScore = Math.min(1.0, Number((maxScore * 0.7 + avgActiveScore * 0.3).toFixed(3)));

    // Determine operational severity
    let severity: AnomalySeverity = 'low';
    if (ruleRes.severity === 'critical' || statRes.severity === 'critical') {
      severity = 'critical';
    } else if (ruleRes.severity === 'high' || statRes.severity === 'high' || mlRes.severity === 'high') {
      severity = 'high';
    } else if (ruleRes.severity === 'medium' || statRes.severity === 'medium') {
      severity = 'medium';
    }

    const anomalyType: AnomalyType = ruleRes.anomalyType || statRes.anomalyType || mlRes.anomalyType || 'threshold';
    const baseline = ruleRes.baseline ?? statRes.rollingMean ?? reading.value;

    const anomalyId = `ANOM-${reading.satelliteId}-${String(anomalyCounter++).padStart(5, '0')}`;
    const now = new Date();

    // Generate evidence items
    const evidenceIds: string[] = [];

    // 1. Primary telemetry evidence
    const telEvidence = await EvidenceService.createEvidence({
      source: 'telemetry',
      sourceId: `${reading.satelliteId}:${reading.parameter}:${reading.timestamp.getTime()}`,
      timestamp: reading.timestamp,
      parameter: reading.parameter,
      value: reading.value,
      baseline,
      unit: reading.unit,
      description: `Observed ${reading.parameter} = ${reading.value.toFixed(2)}${reading.unit} (baseline: ${baseline.toFixed(2)}${reading.unit})`,
    });
    evidenceIds.push(telEvidence.evidenceId);

    // 2. Detection engine trigger evidence
    const descParts: string[] = [];
    if (ruleRes.detected && ruleRes.description) {
      descParts.push(`Rule: ${ruleRes.description}`);
      const ruleEv = await EvidenceService.createEvidence({
        source: 'anomaly',
        sourceId: `${anomalyId}-RULE`,
        timestamp: now,
        description: `Rule Engine: ${ruleRes.ruleName} triggered (score ${ruleRes.score.toFixed(2)})`,
      });
      evidenceIds.push(ruleEv.evidenceId);
    }

    if (statRes.detected && statRes.description) {
      descParts.push(`Stats: ${statRes.description}`);
      const statEv = await EvidenceService.createEvidence({
        source: 'anomaly',
        sourceId: `${anomalyId}-STAT`,
        timestamp: now,
        description: `Statistical Engine: ${statRes.description}`,
      });
      evidenceIds.push(statEv.evidenceId);
    }

    if (mlRes.detected && mlRes.description) {
      descParts.push(`ML: ${mlRes.description}`);
      const mlEv = await EvidenceService.createEvidence({
        source: 'anomaly',
        sourceId: `${anomalyId}-ML`,
        timestamp: now,
        parameter: reading.parameter,
        value: reading.value,
        baseline: mlRes.evidenceMetadata?.baseline ?? baseline,
        unit: reading.unit,
        description: mlRes.description,
      });
      evidenceIds.push(mlEv.evidenceId);
    }

    const description = descParts.join(' | ') || `Anomaly detected in ${reading.parameter}`;

    const anomaly: IAnomaly = {
      anomalyId,
      satelliteId: reading.satelliteId,
      detectedAt: reading.timestamp,
      detectionMethod,
      anomalyScore,
      severity,
      parameter: reading.parameter,
      subsystem: reading.subsystem,
      value: reading.value,
      baseline,
      unit: reading.unit,
      anomalyType,
      evidenceIds,
      status: 'active',
      description,
      createdAt: now,
      updatedAt: now,
    };

    // Store in-memory
    anomaliesStore.set(anomalyId, anomaly);

    // Persist in repository
    try {
      await this.getRepo().create(anomaly);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown write error';
      logger.warn('Failed to persist anomaly to database, preserved in memory', {
        anomalyId,
        error: message,
      });
    }

    logger.warn('Anomaly detected', {
      anomalyId,
      satelliteId: anomaly.satelliteId,
      parameter: anomaly.parameter,
      severity: anomaly.severity,
      method: anomaly.detectionMethod,
      score: anomaly.anomalyScore,
    });

    // Notify listeners (for WebSocket broadcast)
    for (const listener of anomalyListeners) {
      try {
        listener(anomaly);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Error invoking anomaly listener', { error: message });
      }
    }

    return anomaly;
  }

  public static async getAnomalies(filter?: AnomalyFilterOptions): Promise<IAnomaly[]> {
    try {
      const dbAnomalies = await this.getRepo().findAll(filter);
      if (dbAnomalies.length > 0) {
        for (const a of dbAnomalies) {
          anomaliesStore.set(a.anomalyId, a);
        }
        return dbAnomalies;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Failed to query anomalies from repository, using in-memory store', { error: message });
    }

    // Fallback to in-memory store
    let list = Array.from(anomaliesStore.values());

    if (filter?.satelliteId) {
      list = list.filter((a) => a.satelliteId === filter.satelliteId);
    }
    if (filter?.severity) {
      list = list.filter((a) => a.severity === filter.severity);
    }
    if (filter?.status) {
      list = list.filter((a) => a.status === filter.status);
    }
    if (filter?.subsystem) {
      list = list.filter((a) => a.subsystem === filter.subsystem);
    }

    list.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }

    return list;
  }

  public static getActiveAnomaliesSync(satelliteId: string): IAnomaly[] {
    return Array.from(anomaliesStore.values()).filter(
      (a) => a.satelliteId === satelliteId && a.status === 'active'
    );
  }

  public static async getAnomalyById(anomalyId: string): Promise<IAnomaly | null> {
    const cached = anomaliesStore.get(anomalyId);
    if (cached) return cached;

    try {
      const found = await this.getRepo().findById(anomalyId);
      if (found) {
        anomaliesStore.set(found.anomalyId, found);
        return found;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(`Failed to fetch anomaly ${anomalyId} from repository`, { error: message });
    }
    return null;
  }

  public static async updateAnomalyStatus(
    anomalyId: string,
    status: IAnomaly['status']
  ): Promise<IAnomaly | null> {
    const existing = anomaliesStore.get(anomalyId);
    if (existing) {
      existing.status = status;
      existing.updatedAt = new Date();
    }

    try {
      const updated = await this.getRepo().updateStatus(anomalyId, status);
      if (updated) {
        anomaliesStore.set(updated.anomalyId, updated);
        return updated;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(`Failed to update anomaly status in database for ${anomalyId}`, { error: message });
    }

    return existing || null;
  }

  public static clearCache(): void {
    anomaliesStore.clear();
  }

  public static async clearAll(): Promise<void> {
    anomaliesStore.clear();
    anomalyCounter = 1;
    try {
      if (this.getRepo().clearAll) {
        await this.getRepo().clearAll!();
      }
    } catch {
      // Ignore in clearAll
    }
  }
}

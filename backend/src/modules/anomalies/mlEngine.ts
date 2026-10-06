import { ITelemetryReading, AnomalySeverity, AnomalyType } from '../../shared/types';
import { config } from '../../config';
import { logger } from '../../shared/logger';

export interface MLEvaluationResult {
  detected: boolean;
  score: number;
  available: boolean;
  anomalyType?: AnomalyType;
  severity?: AnomalySeverity;
  description?: string;
  evidenceMetadata?: Record<string, any>;
  contributingFeatures?: string[];
}

export class MLEngine {
  private static serviceAvailable: boolean = true;
  private static lastCheckTime: number = 0;

  public static async evaluate(reading: ITelemetryReading): Promise<MLEvaluationResult> {
    const now = Date.now();
    // If recently failed, throttle retry to once every 10 seconds to avoid spamming
    if (!this.serviceAvailable && now - this.lastCheckTime < 10000) {
      return {
        detected: false,
        score: 0.0,
        available: false,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const response = await fetch(`${config.mlService.url}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satellite_id: reading.satelliteId,
          subsystem: reading.subsystem,
          parameter: reading.parameter,
          value: reading.value,
          timestamp: reading.timestamp.toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.serviceAvailable = false;
        this.lastCheckTime = now;
        return { detected: false, score: 0.0, available: false };
      }

      const data = await response.json() as {
        is_anomaly: boolean;
        anomaly_score: number;
        model_name?: string;
        details?: string;
        evidence?: Record<string, any>;
        contributing_features?: string[];
      };

      this.serviceAvailable = true;

      const detected = Boolean(data.is_anomaly);
      const score = Math.max(0, Math.min(1, data.anomaly_score ?? 0));
      const severity: AnomalySeverity = score > 0.85 ? 'high' : score > 0.65 ? 'medium' : 'low';

      return {
        detected,
        score,
        available: true,
        anomalyType: detected ? 'oscillation' : undefined,
        severity: detected ? severity : undefined,
        description: detected
          ? data.details || `ML Hybrid Detector flagged anomalous pattern (score: ${score.toFixed(2)})`
          : undefined,
        evidenceMetadata: data.evidence,
        contributingFeatures: data.contributing_features,
      };
    } catch {
      this.serviceAvailable = false;
      this.lastCheckTime = now;
      logger.debug('ML service unavailable, continuing gracefully');
      return {
        detected: false,
        score: 0.0,
        available: false,
      };
    }
  }
}

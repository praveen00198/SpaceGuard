import { ITelemetryReading, AnomalySeverity, AnomalyType } from '../../shared/types';

export interface StatisticalEvaluationResult {
  detected: boolean;
  score: number;
  zScore: number;
  rollingMean: number;
  rollingStd: number;
  anomalyType?: AnomalyType;
  severity?: AnomalySeverity;
  description?: string;
}

// Window size for rolling statistics (30 samples)
const ROLLING_WINDOW_SIZE = 30;

// Rolling buffers: key -> array of values
const rollingBuffers = new Map<string, number[]>();

export class StatisticalEngine {
  public static evaluate(reading: ITelemetryReading): StatisticalEvaluationResult {
    const key = `${reading.satelliteId}:${reading.parameter}`;
    let buffer = rollingBuffers.get(key);

    if (!buffer) {
      buffer = [];
      rollingBuffers.set(key, buffer);
    }

    const val = reading.value;

    // Need at least 8 samples to compute a meaningful mean and std
    if (buffer.length < 8) {
      buffer.push(val);
      return {
        detected: false,
        score: 0.0,
        zScore: 0.0,
        rollingMean: val,
        rollingStd: 0.0,
      };
    }

    // Compute mean
    const sum = buffer.reduce((acc, curr) => acc + curr, 0);
    const mean = sum / buffer.length;

    // Compute standard deviation
    const variance = buffer.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / buffer.length;
    const std = Math.sqrt(variance);

    // Keep buffer bounded
    buffer.push(val);
    if (buffer.length > ROLLING_WINDOW_SIZE) {
      buffer.shift();
    }

    // Avoid division by near zero
    if (std < 1e-4) {
      return {
        detected: false,
        score: 0.0,
        zScore: 0.0,
        rollingMean: mean,
        rollingStd: std,
      };
    }

    const z = Math.abs(val - mean) / std;

    // Anomaly threshold: |z| >= 3.0 (standard 3-sigma statistical control limit)
    if (z >= 3.0) {
      const severity: AnomalySeverity = z >= 5.0 ? 'critical' : z >= 4.0 ? 'high' : 'medium';
      const normalizedScore = Math.min(1.0, 0.5 + (z - 3.0) * 0.15);

      return {
        detected: true,
        score: normalizedScore,
        zScore: z,
        rollingMean: mean,
        rollingStd: std,
        anomalyType: 'variance_change',
        severity,
        description: `Statistical 3-sigma anomaly: z-score = ${z.toFixed(2)} (mean: ${mean.toFixed(2)}, std: ${std.toFixed(2)})`,
      };
    }

    return {
      detected: false,
      score: Math.min(0.5, (z / 3.0) * 0.5),
      zScore: z,
      rollingMean: mean,
      rollingStd: std,
    };
  }

  public static reset(): void {
    rollingBuffers.clear();
  }
}

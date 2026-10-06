import { ITelemetryReading, AnomalySeverity, AnomalyType } from '../../shared/types';

export interface RuleEvaluationResult {
  detected: boolean;
  ruleName?: string;
  anomalyType?: AnomalyType;
  severity?: AnomalySeverity;
  score: number;
  baseline: number;
  description?: string;
}

// Operational threshold configurations
interface ParameterThresholdConfig {
  nominalMin: number;
  nominalMax: number;
  criticalMin: number;
  criticalMax: number;
  maxRateOfChangePerSec: number;
  baseline: number;
}

const PARAMETER_THRESHOLDS: Record<string, ParameterThresholdConfig> = {
  temperature: {
    nominalMin: -10.0,
    nominalMax: 45.0,
    criticalMin: -25.0,
    criticalMax: 60.0,
    maxRateOfChangePerSec: 0.5, // 30 C / min
    baseline: 22.0,
  },
  battery_voltage: {
    nominalMin: 3.3,
    nominalMax: 4.25,
    criticalMin: 3.0,
    criticalMax: 4.4,
    maxRateOfChangePerSec: 0.05,
    baseline: 3.7,
  },
  battery_current: {
    nominalMin: 0.1,
    nominalMax: 3.5,
    criticalMin: 0.0,
    criticalMax: 4.8,
    maxRateOfChangePerSec: 0.2,
    baseline: 1.2,
  },
  solar_panel_voltage: {
    nominalMin: 5.0,
    nominalMax: 28.0,
    criticalMin: 0.0,
    criticalMax: 32.0,
    maxRateOfChangePerSec: 2.0,
    baseline: 14.5,
  },
  power_consumption: {
    nominalMin: 10.0,
    nominalMax: 50.0,
    criticalMin: 5.0,
    criticalMax: 80.0,
    maxRateOfChangePerSec: 5.0,
    baseline: 25.0,
  },
  signal_strength: {
    nominalMin: -100.0,
    nominalMax: -45.0,
    criticalMin: -115.0,
    criticalMax: -30.0,
    maxRateOfChangePerSec: 5.0,
    baseline: -75.0,
  },
  packet_loss_rate: {
    nominalMin: 0.0,
    nominalMax: 5.0,
    criticalMin: 0.0,
    criticalMax: 20.0,
    maxRateOfChangePerSec: 2.0,
    baseline: 0.5,
  },
  link_latency: {
    nominalMin: 100.0,
    nominalMax: 600.0,
    criticalMin: 50.0,
    criticalMax: 1500.0,
    maxRateOfChangePerSec: 100.0,
    baseline: 250.0,
  },
};

// Store recent readings for rate-of-change and flatline detection
const previousReadings = new Map<string, { value: number; timestamp: number }>();
const consecutiveIdenticalCounts = new Map<string, { value: number; count: number }>();

export class RuleEngine {
  public static evaluate(reading: ITelemetryReading): RuleEvaluationResult {
    const key = `${reading.satelliteId}:${reading.parameter}`;
    const cfg = PARAMETER_THRESHOLDS[reading.parameter];
    const baseline = cfg?.baseline ?? reading.value;

    if (!cfg) {
      return { detected: false, score: 0, baseline };
    }

    const val = reading.value;

    // 1. Critical boundary check
    if (val < cfg.criticalMin || val > cfg.criticalMax) {
      const dir = val > cfg.criticalMax ? 'above critical maximum' : 'below critical minimum';
      const bound = val > cfg.criticalMax ? cfg.criticalMax : cfg.criticalMin;
      return {
        detected: true,
        ruleName: 'CRITICAL_RANGE_BREACH',
        anomalyType: 'threshold',
        severity: 'critical',
        score: 0.95,
        baseline,
        description: `${reading.parameter} value ${val.toFixed(2)}${reading.unit} is ${dir} (${bound}${reading.unit})`,
      };
    }

    // 2. Nominal boundary check
    if (val < cfg.nominalMin || val > cfg.nominalMax) {
      const dir = val > cfg.nominalMax ? 'exceeds nominal maximum' : 'falls below nominal minimum';
      const bound = val > cfg.nominalMax ? cfg.nominalMax : cfg.nominalMin;
      return {
        detected: true,
        ruleName: 'NOMINAL_RANGE_EXCEEDED',
        anomalyType: 'threshold',
        severity: 'medium',
        score: 0.70,
        baseline,
        description: `${reading.parameter} value ${val.toFixed(2)}${reading.unit} ${dir} (${bound}${reading.unit})`,
      };
    }

    // 3. Rate of change check
    const prev = previousReadings.get(key);
    const currentMs = reading.timestamp.getTime();

    if (prev && currentMs > prev.timestamp) {
      const elapsedSec = (currentMs - prev.timestamp) / 1000;
      if (elapsedSec > 0 && elapsedSec < 120) {
        const delta = Math.abs(val - prev.value);
        const ratePerSec = delta / elapsedSec;

        if (ratePerSec > cfg.maxRateOfChangePerSec) {
          previousReadings.set(key, { value: val, timestamp: currentMs });
          return {
            detected: true,
            ruleName: 'EXCESSIVE_RATE_OF_CHANGE',
            anomalyType: 'spike',
            severity: ratePerSec > cfg.maxRateOfChangePerSec * 2 ? 'high' : 'medium',
            score: 0.85,
            baseline: prev.value,
            description: `${reading.parameter} changed by ${delta.toFixed(2)}${reading.unit} in ${elapsedSec.toFixed(1)}s (rate ${ratePerSec.toFixed(2)}/s exceeds max ${cfg.maxRateOfChangePerSec}/s)`,
          };
        }
      }
    }
    previousReadings.set(key, { value: val, timestamp: currentMs });

    // 4. Flatline / Sticky sensor check
    const flatTracker = consecutiveIdenticalCounts.get(key);
    if (flatTracker && flatTracker.value === val) {
      const newCount = flatTracker.count + 1;
      consecutiveIdenticalCounts.set(key, { value: val, count: newCount });
      // If a non-zero continuous sensor stays identically unchanged for 10 samples
      if (newCount >= 10 && val !== 0) {
        return {
          detected: true,
          ruleName: 'SENSOR_FLATLINE_DETECTED',
          anomalyType: 'flatline',
          severity: 'low',
          score: 0.65,
          baseline,
          description: `${reading.parameter} has reported identical value ${val.toFixed(2)}${reading.unit} for ${newCount} consecutive ticks`,
        };
      }
    } else {
      consecutiveIdenticalCounts.set(key, { value: val, count: 1 });
    }

    return {
      detected: false,
      score: 0.05,
      baseline,
    };
  }
}

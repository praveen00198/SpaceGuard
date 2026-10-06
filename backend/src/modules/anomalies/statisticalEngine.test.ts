import { StatisticalEngine } from './statisticalEngine';
import { ITelemetryReading } from '../../shared/types';

describe('StatisticalEngine', () => {
  beforeEach(() => {
    StatisticalEngine.reset();
  });

  const baseReading: ITelemetryReading = {
    satelliteId: 'SG-STAT-1',
    parameter: 'battery_voltage',
    timestamp: new Date('2026-01-01T12:00:00Z'),
    value: 3.7,
    unit: 'V',
    subsystem: 'power',
    source: 'simulator',
    quality: 'valid',
    ingestedAt: new Date(),
  };

  it('should compute baseline stats and flag 3-sigma outliers', () => {
    // Feed 15 stable nominal values
    for (let i = 0; i < 15; i++) {
      const res = StatisticalEngine.evaluate({
        ...baseReading,
        value: 3.7 + (Math.sin(i) * 0.02),
        timestamp: new Date(baseReading.timestamp.getTime() + i * 1000),
      });
      expect(res.detected).toBe(false);
    }

    // Now inject a 4-sigma sudden drop (e.g. 3.2V when mean ~3.7 and std ~0.02)
    const outlierRes = StatisticalEngine.evaluate({
      ...baseReading,
      value: 3.15,
      timestamp: new Date(baseReading.timestamp.getTime() + 16 * 1000),
    });

    expect(outlierRes.detected).toBe(true);
    expect(outlierRes.zScore).toBeGreaterThanOrEqual(3.0);
    expect(outlierRes.description).toContain('3-sigma anomaly');
  });
});

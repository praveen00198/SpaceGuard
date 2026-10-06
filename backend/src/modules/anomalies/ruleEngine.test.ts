import { RuleEngine } from './ruleEngine';
import { ITelemetryReading } from '../../shared/types';

describe('RuleEngine', () => {
  const baseReading: ITelemetryReading = {
    satelliteId: 'SG-1',
    parameter: 'temperature',
    timestamp: new Date('2026-01-01T12:00:00Z'),
    value: 22.0,
    unit: 'C',
    subsystem: 'thermal',
    source: 'simulator',
    quality: 'valid',
    ingestedAt: new Date(),
  };

  it('should not trigger anomaly for nominal temperature', () => {
    const res = RuleEngine.evaluate({ ...baseReading, value: 22.5 });
    expect(res.detected).toBe(false);
  });

  it('should trigger CRITICAL_RANGE_BREACH when temperature exceeds 60 C', () => {
    const res = RuleEngine.evaluate({ ...baseReading, value: 72.0 });
    expect(res.detected).toBe(true);
    expect(res.ruleName).toBe('CRITICAL_RANGE_BREACH');
    expect(res.severity).toBe('critical');
    expect(res.score).toBeGreaterThanOrEqual(0.9);
  });

  it('should trigger NOMINAL_RANGE_EXCEEDED when value moderately exceeds nominal bound', () => {
    const res = RuleEngine.evaluate({ ...baseReading, value: 48.0 });
    expect(res.detected).toBe(true);
    expect(res.ruleName).toBe('NOMINAL_RANGE_EXCEEDED');
    expect(res.severity).toBe('medium');
  });

  it('should detect excessive rate of change within nominal range', () => {
    const t0 = new Date('2026-01-01T12:00:00Z');
    const t1 = new Date('2026-01-01T12:00:02Z'); // 2 seconds later

    RuleEngine.evaluate({ ...baseReading, value: 20.0, timestamp: t0 });
    // Jumps from 20 to 38 C in 2 seconds (9 C/s vs 0.5 C/s limit, within nominal 45 C)
    const res = RuleEngine.evaluate({ ...baseReading, value: 38.0, timestamp: t1 });

    expect(res.detected).toBe(true);
    expect(res.ruleName).toBe('EXCESSIVE_RATE_OF_CHANGE');
    expect(res.severity).toBe('high');
  });
});

import { HealthService } from './healthService';
import { AnomalyService } from '../anomalies/anomalyService';
import { ITelemetryReading } from '../../shared/types';

describe('HealthService', () => {
  beforeEach(() => {
    AnomalyService.clearAll();
  });

  const nominalReadings: ITelemetryReading[] = [
    {
      satelliteId: 'SG-HEALTH-TEST',
      parameter: 'battery_voltage',
      timestamp: new Date(),
      value: 3.7,
      unit: 'V',
      subsystem: 'power',
      source: 'simulator',
      quality: 'valid',
      ingestedAt: new Date(),
    },
    {
      satelliteId: 'SG-HEALTH-TEST',
      parameter: 'temperature',
      timestamp: new Date(),
      value: 22.0,
      unit: 'C',
      subsystem: 'thermal',
      source: 'simulator',
      quality: 'valid',
      ingestedAt: new Date(),
    },
    {
      satelliteId: 'SG-HEALTH-TEST',
      parameter: 'signal_strength',
      timestamp: new Date(),
      value: -75.0,
      unit: 'dBm',
      subsystem: 'communication',
      source: 'simulator',
      quality: 'valid',
      ingestedAt: new Date(),
    },
    {
      satelliteId: 'SG-HEALTH-TEST',
      parameter: 'roll',
      timestamp: new Date(),
      value: 0.1,
      unit: 'deg',
      subsystem: 'attitude',
      source: 'simulator',
      quality: 'valid',
      ingestedAt: new Date(),
    },
    {
      satelliteId: 'SG-HEALTH-TEST',
      parameter: 'sensor_1',
      timestamp: new Date(),
      value: 1.0,
      unit: 'raw',
      subsystem: 'payload',
      source: 'simulator',
      quality: 'valid',
      ingestedAt: new Date(),
    },
  ];

  it('should compute nominal 100% health when no anomalies exist', () => {
    const health = HealthService.computeHealth('SG-HEALTH-TEST', nominalReadings);
    expect(health.overallHealth).toBe(100);
    expect(health.overallStatus).toBe('nominal');
    expect(health.activeAnomalies).toBe(0);
  });

  it('should degrade health score when an anomaly is present', async () => {
    // Process critical anomaly reading
    await AnomalyService.processReading({
      satelliteId: 'SG-HEALTH-TEST',
      parameter: 'temperature',
      timestamp: new Date(),
      value: 75.0,
      unit: 'C',
      subsystem: 'thermal',
      source: 'simulator',
      quality: 'valid',
      ingestedAt: new Date(),
    });

    const health = HealthService.computeHealth('SG-HEALTH-TEST', nominalReadings);
    expect(health.activeAnomalies).toBe(1);
    expect(health.subsystems.thermal.score).toBeLessThan(100);
    expect(health.overallHealth).toBeLessThan(100);
  });
});

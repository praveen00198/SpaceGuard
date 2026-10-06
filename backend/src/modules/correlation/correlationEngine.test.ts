import { CorrelationEngine } from './correlationEngine';
import { DonkiService } from '../space-weather/donkiService';
import { SpaceWeatherService } from '../space-weather/spaceWeatherService';
import { OrbitalService } from '../orbital/orbitalService';
import { AnomalyService } from '../anomalies/anomalyService';
import { EvidenceService } from '../evidence/evidenceService';
import { InMemoryEvidenceRepository } from '../../repositories/inmemory/InMemoryEvidenceRepository';
import { InMemoryAnomalyRepository } from '../../repositories/inmemory/InMemoryAnomalyRepository';
import { InMemoryEnvironmentalEventRepository } from '../../repositories/inmemory/InMemoryEnvironmentalEventRepository';
import { IAnomaly } from '../../shared/types';

describe('Phase 4: CorrelationEngine & External Space Context', () => {
  const inMemoryEvRepo = new InMemoryEvidenceRepository();
  const inMemoryAnomRepo = new InMemoryAnomalyRepository();
  const inMemoryEnvRepo = new InMemoryEnvironmentalEventRepository();

  beforeAll(() => {
    EvidenceService.setRepository(inMemoryEvRepo);
    AnomalyService.setRepository(inMemoryAnomRepo);
    DonkiService.setRepository(inMemoryEnvRepo);
  });

  const createTestAnomaly = (overrides: Partial<IAnomaly> = {}): IAnomaly => {
    const now = new Date();
    return {
      anomalyId: `ANOM-TEST-${Math.floor(Math.random() * 90000 + 10000)}`,
      satelliteId: 'SG-1',
      parameter: 'temperature',
      subsystem: 'thermal',
      detectedAt: now,
      value: 75.0,
      baseline: 45.0,
      unit: 'C',
      anomalyType: 'spike',
      anomalyScore: 0.92,
      severity: 'critical',
      detectionMethod: 'rule',
      evidenceIds: ['EVID-TEL-00001', 'EVID-ANO-00002'],
      status: 'active',
      description: 'Thermal anomaly detected on SG-1 test probe',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  it('strictly enforces non-causality rule (causalEvidence === false) for all correlations', async () => {
    const anomaly = createTestAnomaly();
    const report = await CorrelationEngine.correlateAnomaly(anomaly);

    expect(report).toBeDefined();
    expect(report.anomalyId).toBe(anomaly.anomalyId);
    expect(report.satelliteId).toBe(anomaly.satelliteId);

    // Every correlated item must strictly have causalEvidence = false
    for (const corr of report.correlations) {
      expect(corr.causalEvidence).toBe(false);
      expect(corr.note).toBeDefined();
      expect(corr.confidence).toBeGreaterThan(0);
      expect(corr.confidence).toBeLessThanOrEqual(1.0);
    }
  });

  it('identifies Subsystem Physical Coupling between thermal and power anomalies', async () => {
    // Ingest a coupled power anomaly first
    const powerAnomaly = createTestAnomaly({
      anomalyId: 'ANOM-COUPLED-POWER',
      subsystem: 'power',
      parameter: 'battery_temperature',
      severity: 'high',
    });
    await inMemoryAnomRepo.create(powerAnomaly);

    // Now test a thermal anomaly on the same satellite
    const thermalAnomaly = createTestAnomaly({
      anomalyId: 'ANOM-TEST-THERMAL',
      subsystem: 'thermal',
      parameter: 'component_temp',
    });
    await inMemoryAnomRepo.create(thermalAnomaly);

    const report = await CorrelationEngine.correlateAnomaly(thermalAnomaly);

    const coupledCorrelation = report.correlations.find(
      (c) => c.relationship === 'subsystem_coupling'
    );
    expect(coupledCorrelation).toBeDefined();
    expect(coupledCorrelation?.causalEvidence).toBe(false);
    expect(coupledCorrelation?.contextSource).toBe('Physical Subsystem Topology');
  });

  it('correlates Solar Flare / CME events from NASA DONKI within the temporal window', async () => {
    const anomalyTime = new Date('2026-09-26T12:00:00Z');
    const anomaly = createTestAnomaly({
      anomalyId: 'ANOM-SOLAR-TEST',
      detectedAt: anomalyTime,
      subsystem: 'communication',
    });

    // Seed a DONKI event 20 minutes prior to anomaly
    await inMemoryEnvRepo.create({
      eventId: 'DONKI-FLR-20260926-001',
      source: 'nasa_donki',
      eventType: 'FLR',
      timestamp: new Date('2026-09-26T11:40:00Z'),
      severity: 'high',
      description: 'M-class solar flare detected by SDO',
      rawData: { classType: 'M4.2', sourceLocation: 'N14W22' },
      retrievedAt: new Date(),
    });

    const report = await CorrelationEngine.correlateAnomaly(anomaly);

    const donkiCorrelation = report.correlations.find(
      (c) => c.contextSource === 'NASA DONKI'
    );
    expect(donkiCorrelation).toBeDefined();
    expect(donkiCorrelation?.relationship).toBe('temporal_overlap');
    expect(donkiCorrelation?.causalEvidence).toBe(false);
    expect(donkiCorrelation?.evidenceId).toMatch(/^EVID-ENV-\d{5}$/);

    // Verify evidence was attached to anomaly
    expect(anomaly.evidenceIds).toContain(donkiCorrelation?.evidenceId);
  });

  it('evaluates orbital ephemeris and SAA radiation corridor status', async () => {
    const orbital = await OrbitalService.getOrbitalContext('SG-1');

    expect(orbital).toBeDefined();
    expect(orbital.satelliteId).toBe('SG-1');
    expect(['LEO', 'MEO', 'GEO', 'HEO']).toContain(orbital.regime);
    expect(orbital.altitudeKm).toBeGreaterThan(100);
    expect(orbital.provenance.attribution).toContain('CelesTrak');
  });
});

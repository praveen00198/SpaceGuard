import { sanitizeMongoUri, isDatabaseConnected } from '../config/database';
import { InMemorySatelliteRepository } from './inmemory/InMemorySatelliteRepository';
import { InMemoryTelemetryRepository } from './inmemory/InMemoryTelemetryRepository';
import { InMemoryAnomalyRepository } from './inmemory/InMemoryAnomalyRepository';
import { InMemoryEvidenceRepository } from './inmemory/InMemoryEvidenceRepository';
import { InMemoryHealthRepository } from './inmemory/InMemoryHealthRepository';
import { InMemoryAIAssessmentRepository } from './inmemory/InMemoryAIAssessmentRepository';
import { seedSatellites } from '../config/seed';
import { gracefulShutdown } from '../index';
import { ISatellite, ITelemetryReading, IAnomaly, IEvidence, IHealthSnapshot, IAIAssessment } from '../shared/types';
import { MongoSatelliteRepository } from './mongo/MongoSatelliteRepository';

describe('Phase 2 — Persistence & Repository Architecture', () => {
  describe('1. MongoDB Connection Configuration & Sanitization', () => {
    it('should sanitize credentials from MongoDB connection URI', () => {
      const uriWithAuth = 'mongodb://appUser:secretPassword123@cluster0.mongodb.net:27017/spaceguard';
      const sanitized = sanitizeMongoUri(uriWithAuth);
      expect(sanitized).not.toContain('secretPassword123');
      expect(sanitized).not.toContain('appUser');
      expect(sanitized).toBe('mongodb://***:***@cluster0.mongodb.net:27017/spaceguard');
    });

    it('should handle standard URIs without credentials', () => {
      const standardUri = 'mongodb://localhost:27017/spaceguard';
      const sanitized = sanitizeMongoUri(standardUri);
      expect(sanitized).toBe('mongodb://localhost:27017/spaceguard');
    });

    it('should accurately report connection status', () => {
      // In isolated unit tests without external DB, connection state is false
      expect(typeof isDatabaseConnected()).toBe('boolean');
    });
  });

  describe('2. Satellite Repository & Idempotent Seeding', () => {
    let repo: InMemorySatelliteRepository;

    beforeEach(() => {
      repo = new InMemorySatelliteRepository();
    });

    it('should create and retrieve a satellite by ID', async () => {
      const sat: ISatellite = {
        satelliteId: 'SG-TEST-1',
        name: 'Test Sat Alpha',
        type: 'smallsat',
        status: 'active',
        dataSource: 'simulator',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await repo.create(sat);
      expect(created.satelliteId).toBe('SG-TEST-1');

      const found = await repo.findById('SG-TEST-1');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Test Sat Alpha');
    });

    it('should enforce satellite uniqueness constraint', async () => {
      const sat: ISatellite = {
        satelliteId: 'SG-DUP-1',
        name: 'Duplicate Candidate',
        type: 'cubesat',
        status: 'active',
        dataSource: 'simulator',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repo.create(sat);
      await expect(repo.create(sat)).rejects.toThrow(/already exists/i);
    });

    it('should perform idempotent seeding without duplicating satellites', async () => {
      // First seed run
      const firstRun = await seedSatellites(repo);
      expect(firstRun.seeded).toBe(3);
      expect(firstRun.existing).toBe(0);
      expect(firstRun.total).toBe(3);

      // Second seed run should find all 3 existing and seed 0 new
      const secondRun = await seedSatellites(repo);
      expect(secondRun.seeded).toBe(0);
      expect(secondRun.existing).toBe(3);
      expect(secondRun.total).toBe(3);
    });
  });

  describe('3. Telemetry Repository (Persistence, Ordering & Range Queries)', () => {
    let repo: InMemoryTelemetryRepository;

    beforeEach(() => {
      repo = new InMemoryTelemetryRepository();
    });

    it('should persist a single telemetry reading', async () => {
      const reading: ITelemetryReading = {
        satelliteId: 'SG-1',
        parameter: 'battery_voltage',
        timestamp: new Date('2026-09-26T12:00:00Z'),
        value: 3.75,
        unit: 'V',
        subsystem: 'power',
        source: 'simulator',
        quality: 'valid',
        ingestedAt: new Date(),
      };

      const saved = await repo.create(reading);
      expect(saved.satelliteId).toBe('SG-1');
      expect(saved.value).toBe(3.75);

      const latest = await repo.findLatest('SG-1');
      expect(latest.length).toBe(1);
      expect(latest[0].parameter).toBe('battery_voltage');
    });

    it('should persist batches and maintain chronological ordering', async () => {
      const t1 = new Date('2026-09-26T12:00:01Z');
      const t2 = new Date('2026-09-26T12:00:02Z');
      const t3 = new Date('2026-09-26T12:00:03Z');

      const batch: ITelemetryReading[] = [
        {
          satelliteId: 'SG-1',
          parameter: 'temperature',
          timestamp: t2,
          value: 23.5,
          unit: 'C',
          subsystem: 'thermal',
          source: 'simulator',
          quality: 'valid',
          ingestedAt: new Date(),
        },
        {
          satelliteId: 'SG-1',
          parameter: 'temperature',
          timestamp: t1,
          value: 22.0,
          unit: 'C',
          subsystem: 'thermal',
          source: 'simulator',
          quality: 'valid',
          ingestedAt: new Date(),
        },
        {
          satelliteId: 'SG-1',
          parameter: 'temperature',
          timestamp: t3,
          value: 25.0,
          unit: 'C',
          subsystem: 'thermal',
          source: 'simulator',
          quality: 'valid',
          ingestedAt: new Date(),
        },
      ];

      const inserted = await repo.createMany(batch);
      expect(inserted).toBe(3);

      const history = await repo.findHistory({ satelliteId: 'SG-1', parameter: 'temperature' });
      expect(history.length).toBe(3);
      // History should be sorted chronologically ascending
      expect(history[0].value).toBe(22.0);
      expect(history[1].value).toBe(23.5);
      expect(history[2].value).toBe(25.0);
    });

    it('should support time range boundary filtering', async () => {
      const t1 = new Date('2026-09-26T10:00:00Z');
      const t2 = new Date('2026-09-26T11:00:00Z');
      const t3 = new Date('2026-09-26T12:00:00Z');

      await repo.createMany([
        {
          satelliteId: 'SG-1',
          parameter: 'roll',
          timestamp: t1,
          value: 0.1,
          unit: 'deg',
          subsystem: 'attitude',
          source: 'simulator',
          quality: 'valid',
          ingestedAt: new Date(),
        },
        {
          satelliteId: 'SG-1',
          parameter: 'roll',
          timestamp: t2,
          value: 0.2,
          unit: 'deg',
          subsystem: 'attitude',
          source: 'simulator',
          quality: 'valid',
          ingestedAt: new Date(),
        },
        {
          satelliteId: 'SG-1',
          parameter: 'roll',
          timestamp: t3,
          value: 0.3,
          unit: 'deg',
          subsystem: 'attitude',
          source: 'simulator',
          quality: 'valid',
          ingestedAt: new Date(),
        },
      ]);

      const filtered = await repo.findHistory({
        satelliteId: 'SG-1',
        startTime: new Date('2026-09-26T10:30:00Z'),
        endTime: new Date('2026-09-26T11:30:00Z'),
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].value).toBe(0.2);
    });
  });

  describe('4. Anomaly Repository (Persistence & Status Workflow)', () => {
    let repo: InMemoryAnomalyRepository;

    beforeEach(() => {
      repo = new InMemoryAnomalyRepository();
    });

    it('should create and update anomaly status', async () => {
      const anom: IAnomaly = {
        anomalyId: 'ANOM-SG-1-001',
        satelliteId: 'SG-1',
        detectedAt: new Date(),
        detectionMethod: 'rule',
        anomalyScore: 0.95,
        severity: 'critical',
        parameter: 'temperature',
        subsystem: 'thermal',
        value: 75.0,
        baseline: 22.0,
        unit: 'C',
        anomalyType: 'threshold',
        evidenceIds: ['EVID-TEL-00001'],
        status: 'active',
        description: 'Critical thermal breach',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repo.create(anom);
      const found = await repo.findById('ANOM-SG-1-001');
      expect(found).not.toBeNull();
      expect(found?.status).toBe('active');

      const updated = await repo.updateStatus('ANOM-SG-1-001', 'investigating');
      expect(updated?.status).toBe('investigating');

      const resolved = await repo.updateStatus('ANOM-SG-1-001', 'resolved');
      expect(resolved?.status).toBe('resolved');
    });
  });

  describe('5. Evidence Repository (Uniqueness & Incremental Sequencing)', () => {
    let repo: InMemoryEvidenceRepository;

    beforeEach(() => {
      repo = new InMemoryEvidenceRepository();
    });

    it('should generate monotonic sequences per source', async () => {
      const seq1 = await repo.getNextSequence('telemetry');
      const seq2 = await repo.getNextSequence('telemetry');
      const seqAno1 = await repo.getNextSequence('anomaly');

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
      expect(seqAno1).toBe(1);
    });

    it('should persist and batch-retrieve evidence items by IDs', async () => {
      const ev1: IEvidence = {
        evidenceId: 'EVID-TEL-00001',
        source: 'telemetry',
        sourceId: 'SG-1:temp:1',
        timestamp: new Date(),
        description: 'Temperature reading breach',
        createdAt: new Date(),
      };
      const ev2: IEvidence = {
        evidenceId: 'EVID-ANO-00002',
        source: 'anomaly',
        sourceId: 'SG-1:rule:1',
        timestamp: new Date(),
        description: 'Threshold rule trigger',
        createdAt: new Date(),
      };

      await repo.create(ev1);
      await repo.create(ev2);

      const items = await repo.findByIds(['EVID-TEL-00001', 'EVID-ANO-00002']);
      expect(items.length).toBe(2);
      expect(items[0].evidenceId).toBe('EVID-TEL-00001');
      expect(items[1].evidenceId).toBe('EVID-ANO-00002');
    });
  });

  describe('6. Health Snapshot Repository', () => {
    let repo: InMemoryHealthRepository;

    beforeEach(() => {
      repo = new InMemoryHealthRepository();
    });

    it('should persist health snapshots and retrieve the latest', async () => {
      const snap1: IHealthSnapshot = {
        satelliteId: 'SG-1',
        timestamp: new Date('2026-09-26T12:00:00Z'),
        subsystems: {
          power: { score: 100, status: 'nominal' },
          thermal: { score: 100, status: 'nominal' },
          communication: { score: 100, status: 'nominal' },
          attitude: { score: 100, status: 'nominal' },
          payload: { score: 100, status: 'nominal' },
        },
        overallHealth: 100,
        overallStatus: 'nominal',
        activeAnomalies: 0,
      };

      const snap2: IHealthSnapshot = {
        satelliteId: 'SG-1',
        timestamp: new Date('2026-09-26T12:01:00Z'),
        subsystems: {
          power: { score: 100, status: 'nominal' },
          thermal: { score: 60, status: 'degraded' },
          communication: { score: 100, status: 'nominal' },
          attitude: { score: 100, status: 'nominal' },
          payload: { score: 100, status: 'nominal' },
        },
        overallHealth: 90,
        overallStatus: 'degraded',
        activeAnomalies: 1,
      };

      await repo.create(snap1);
      await repo.create(snap2);

      const latest = await repo.findLatest('SG-1');
      expect(latest).not.toBeNull();
      expect(latest?.overallHealth).toBe(90);
      expect(latest?.subsystems.thermal.score).toBe(60);
    });
  });

  describe('7. AI Assessment Repository', () => {
    let repo: InMemoryAIAssessmentRepository;

    beforeEach(() => {
      repo = new InMemoryAIAssessmentRepository();
    });

    it('should persist structured AI assessment and query by anomalyId', async () => {
      const assessment: IAIAssessment = {
        assessmentId: 'ASSESS-ANOM-001',
        anomalyId: 'ANOM-001',
        satelliteId: 'SG-1',
        priority: 'critical',
        summary: 'Thermal bus critical overheat',
        evidenceClaims: [{ claim: 'Temperature exceeded 70C', evidenceIds: ['EVID-TEL-00001'] }],
        interpretation: 'Radiator obstruction suspected',
        possibleCauses: ['Heat pipe dry-out'],
        known: ['Temperature is 75C'],
        unknown: ['Internal thermistor continuity'],
        cannotDetermine: ['Ground radiator mechanical state'],
        uncertainty: 'High confidence based on calibrated sensor',
        recommendedInvestigation: ['Orient radiator away from sun'],
        modelUsed: 'gemini-3.8-flash',
        promptVersion: 'v1.0.0',
        requestedAt: new Date(),
        respondedAt: new Date(),
        latencyMs: 350,
        status: 'success',
      };

      await repo.create(assessment);
      const found = await repo.findByAnomalyId('ANOM-001');
      expect(found).not.toBeNull();
      expect(found?.priority).toBe('critical');
      expect(found?.evidenceClaims[0].evidenceIds).toContain('EVID-TEL-00001');
    });
  });

  describe('8. Repository Disconnection & Error Handling', () => {
    it('should fail-fast when MongoDB is not connected', async () => {
      const mongoSatRepo = new MongoSatelliteRepository();
      // Since MongoDB is not connected in this unit test environment, it must fail fast with descriptive error
      await expect(mongoSatRepo.findAll()).rejects.toThrow(/MongoDB not connected/i);
    });
  });

  describe('9. Graceful Shutdown Handler', () => {
    it('should execute graceful shutdown without unhandled rejections', async () => {
      await expect(gracefulShutdown('SIGTEST')).resolves.toBeUndefined();
    });
  });
});

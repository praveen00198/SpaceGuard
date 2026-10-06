import { InMemorySatelliteRepository } from './inmemory/InMemorySatelliteRepository';
import { InMemoryTelemetryRepository } from './inmemory/InMemoryTelemetryRepository';
import { InMemoryAnomalyRepository } from './inmemory/InMemoryAnomalyRepository';
import { InMemoryEvidenceRepository } from './inmemory/InMemoryEvidenceRepository';
import { InMemoryHealthRepository } from './inmemory/InMemoryHealthRepository';
import { InMemoryAIAssessmentRepository } from './inmemory/InMemoryAIAssessmentRepository';

import { SatelliteService } from '../modules/satellites/satelliteService';
import { TelemetryService } from '../modules/telemetry/telemetryService';
import { AnomalyService } from '../modules/anomalies/anomalyService';
import { EvidenceService } from '../modules/evidence/evidenceService';
import { HealthService } from '../modules/health/healthService';
import { GeminiService } from '../modules/assessments/geminiService';
import { seedSatellites } from '../config/seed';

describe('Phase 2 Acceptance Test — Restart & Persistence Lifecycle', () => {
  jest.setTimeout(30000);

  // Shared persistent repositories that survive backend service restarts
  const persistentSatRepo = new InMemorySatelliteRepository();
  const persistentTelRepo = new InMemoryTelemetryRepository();
  const persistentAnomRepo = new InMemoryAnomalyRepository();
  const persistentEvRepo = new InMemoryEvidenceRepository();
  const persistentHealthRepo = new InMemoryHealthRepository();
  const persistentAssessmentRepo = new InMemoryAIAssessmentRepository();

  // Recorded IDs for post-restart verification
  let preRestartTelemetryTimestamp: Date;
  let preRestartAnomalyId: string;
  let preRestartEvidenceIds: string[];
  let preRestartAssessmentId: string;
  let preRestartHealthScore: number;

  it('Phase 2.1 — Pre-Restart Execution: Ingest, Detect, Assess, and Persist', async () => {
    // 1. Attach persistent repositories
    SatelliteService.setRepository(persistentSatRepo);
    TelemetryService.setRepository(persistentTelRepo);
    AnomalyService.setRepository(persistentAnomRepo);
    EvidenceService.setRepository(persistentEvRepo);
    HealthService.setRepository(persistentHealthRepo);
    GeminiService.setRepository(persistentAssessmentRepo);

    // 2. Seed satellites idempotently
    const seedResult = await seedSatellites(persistentSatRepo);
    expect(seedResult.seeded).toBe(3);
    const sats = await SatelliteService.getAllSatellites();
    expect(sats.length).toBe(3);

    // 3. Generate nominal telemetry and a critical anomaly
    preRestartTelemetryTimestamp = new Date('2026-09-26T14:30:00Z');
    const telResult = await TelemetryService.ingestReading({
      satelliteId: 'SG-1',
      parameter: 'temperature',
      timestamp: preRestartTelemetryTimestamp,
      value: 78.5, // Exceeds critical threshold (65°C)
      unit: 'C',
      subsystem: 'thermal',
      source: 'simulator',
      quality: 'valid',
    });

    // Flush batch to persistent repository
    await TelemetryService.flushQueue();

    // 4. Verify anomaly generated
    expect(telResult.anomaly).not.toBeNull();
    preRestartAnomalyId = telResult.anomaly!.anomalyId;
    preRestartEvidenceIds = [...telResult.anomaly!.evidenceIds];
    expect(preRestartEvidenceIds.length).toBeGreaterThan(0);

    // 5. Generate and persist health snapshot
    const latestReadings = await TelemetryService.getLatestReadings('SG-1');
    const healthSnapshot = HealthService.computeHealth('SG-1', latestReadings);
    preRestartHealthScore = healthSnapshot.overallHealth;
    expect(healthSnapshot.overallStatus).toBe('degraded');

    // 6. Generate and persist AI assessment
    const assessment = await GeminiService.assessAnomaly(telResult.anomaly!);
    preRestartAssessmentId = assessment.assessmentId;
    expect(assessment.status).toBe('success');
    expect(assessment.evidenceClaims.length).toBeGreaterThan(0);

    // Verify all records exist in repository
    const storedAnoms = await persistentAnomRepo.findAll();
    const storedEvs = await persistentEvRepo.findAll();
    const storedAssessments = await persistentAssessmentRepo.findByAnomalyId(preRestartAnomalyId);
    const storedTelemetry = await persistentTelRepo.findHistory({ satelliteId: 'SG-1' });

    expect(storedAnoms.length).toBe(1);
    expect(storedEvs.length).toBeGreaterThanOrEqual(1);
    expect(storedAssessments).not.toBeNull();
    expect(storedTelemetry.length).toBeGreaterThanOrEqual(1);
  });

  it('Phase 2.2 — Post-Restart Verification: Restart Services & Verify Persistence', async () => {
    // SIMULATE BACKEND PROCESS TERMINATION:
    // Clear all in-memory caches, listeners, and ring buffers
    SatelliteService.clearCache();
    TelemetryService.clearCache();
    AnomalyService.clearCache();
    EvidenceService.clearCache();
    GeminiService.clearCache();

    // RESTART BACKEND:
    // Re-bind services to the persistent store (just as on application startup)
    SatelliteService.setRepository(persistentSatRepo);
    TelemetryService.setRepository(persistentTelRepo);
    AnomalyService.setRepository(persistentAnomRepo);
    EvidenceService.setRepository(persistentEvRepo);
    HealthService.setRepository(persistentHealthRepo);
    GeminiService.setRepository(persistentAssessmentRepo);

    // 1. Verify Satellite Idempotent Seed after restart: No duplicate satellites!
    const restartSeed = await seedSatellites(persistentSatRepo);
    expect(restartSeed.seeded).toBe(0); // 0 new satellites seeded
    expect(restartSeed.existing).toBe(3); // 3 existing satellites preserved
    const satellites = await SatelliteService.getAllSatellites();
    expect(satellites.length).toBe(3);

    // 2. Verify Historical Telemetry remains queryable across restart
    const telemetryHistory = await TelemetryService.getHistory({
      satelliteId: 'SG-1',
      parameter: 'temperature',
    });
    expect(telemetryHistory.length).toBeGreaterThanOrEqual(1);
    const matchedPoint = telemetryHistory.find(
      (t) => t.timestamp.getTime() === preRestartTelemetryTimestamp.getTime()
    );
    expect(matchedPoint).toBeDefined();
    expect(matchedPoint?.value).toBe(78.5);

    // 3. Verify Anomaly remains available across restart
    const restoredAnomaly = await AnomalyService.getAnomalyById(preRestartAnomalyId);
    expect(restoredAnomaly).not.toBeNull();
    expect(restoredAnomaly?.anomalyId).toBe(preRestartAnomalyId);
    expect(restoredAnomaly?.severity).toBe('critical');

    // 4. Verify Evidence IDs remain identical and queryable across restart
    const restoredEvidence = await EvidenceService.getEvidenceForIds(preRestartEvidenceIds);
    expect(restoredEvidence.length).toBe(preRestartEvidenceIds.length);
    for (const ev of restoredEvidence) {
      expect(preRestartEvidenceIds).toContain(ev.evidenceId);
    }

    // 5. Verify Health Snapshot history is queryable
    const latestHealth = await HealthService.getLatestHealth('SG-1');
    expect(latestHealth).not.toBeNull();
    expect(latestHealth?.overallHealth).toBe(preRestartHealthScore);

    // 6. Verify Structured AI Assessment remains available across restart
    const restoredAssessment = await GeminiService.getAssessmentForAnomaly(preRestartAnomalyId);
    expect(restoredAssessment).not.toBeNull();
    expect(restoredAssessment?.assessmentId).toBe(preRestartAssessmentId);
    expect(restoredAssessment?.anomalyId).toBe(preRestartAnomalyId);
    expect(restoredAssessment?.evidenceClaims[0].evidenceIds).toEqual(
      expect.arrayContaining(preRestartEvidenceIds.slice(0, 1))
    );
  });
});

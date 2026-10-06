import { GeminiService } from './geminiService';
import { AnomalyService } from '../anomalies/anomalyService';

describe('GeminiService Grounding & Fallback', () => {
  it('should generate an evidence-grounded assessment citing real evidence IDs', async () => {
    // Generate an anomaly which generates evidence IDs
    const anomaly = await AnomalyService.processReading({
      satelliteId: 'SG-1',
      parameter: 'temperature',
      timestamp: new Date(),
      value: 68.0,
      unit: 'C',
      subsystem: 'thermal',
      source: 'simulator',
      quality: 'valid',
      ingestedAt: new Date(),
    });

    expect(anomaly).not.toBeNull();
    if (!anomaly) return;

    const assessment = await GeminiService.assessAnomaly(anomaly);

    expect(assessment).toBeDefined();
    expect(assessment.anomalyId).toBe(anomaly.anomalyId);
    expect(assessment.priority).toBe('critical');

    // Principle 1: Evidence Over Invention
    expect(assessment.evidenceClaims.length).toBeGreaterThan(0);
    for (const claim of assessment.evidenceClaims) {
      expect(claim.evidenceIds.length).toBeGreaterThan(0);
      for (const evId of claim.evidenceIds) {
        expect(evId).toMatch(/^EVID-[A-Z]{3}-\d{5}$/);
      }
    }

    // Explicit uncertainty & epistemological boundaries
    expect(assessment.known.length).toBeGreaterThan(0);
    expect(assessment.unknown.length).toBeGreaterThan(0);
    expect(assessment.cannotDetermine.length).toBeGreaterThan(0);
    expect(assessment.uncertainty).toBeDefined();
  });
});

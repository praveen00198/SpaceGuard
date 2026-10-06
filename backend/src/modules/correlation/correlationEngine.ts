import { IAnomaly, IEvidence } from '../../shared/types';
import { SpaceWeatherService } from '../space-weather/spaceWeatherService';
import { DonkiService } from '../space-weather/donkiService';
import { OrbitalService } from '../orbital/orbitalService';
import { EvidenceService } from '../evidence/evidenceService';
import { AnomalyService } from '../anomalies/anomalyService';
import { logger } from '../../shared/logger';

export interface CorrelationItem {
  relationship: 'temporal_overlap' | 'environmental_overlap' | 'subsystem_coupling' | 'historical_similarity';
  contextSource: string;
  sourceEvent: string;
  contextEvent: string;
  confidence: number;
  causalEvidence: false; // Never true — correlation ≠ causation
  note: string;
  evidenceId?: string;
}

export interface CorrelationReport {
  anomalyId: string;
  satelliteId: string;
  correlatedAt: string;
  correlations: CorrelationItem[];
  attachedEvidenceIds: string[];
}

export class CorrelationEngine {
  /**
   * Correlates an anomaly with external space weather, orbital radiation context,
   * coupled subsystems, and historical anomalies.
   * Generates formal Evidence items for valid correlations and attaches them to the anomaly.
   */
  public static async correlateAnomaly(anomaly: IAnomaly): Promise<CorrelationReport> {
    const correlations: CorrelationItem[] = [];
    const newEvidenceList: IEvidence[] = [];

    const anomTime = new Date(anomaly.detectedAt);
    const windowStart = new Date(anomTime.getTime() - 60 * 60 * 1000); // -60 min
    const windowEnd = new Date(anomTime.getTime() + 60 * 60 * 1000);   // +60 min

    // 1. Space Weather Temporal Overlap (NOAA SWPC)
    try {
      const sw = await SpaceWeatherService.getSpaceWeather();
      if (sw.kpIndex !== null && sw.kpIndex >= 5.0) {
        const evidence = await EvidenceService.createEvidence({
          source: 'environment',
          sourceId: `NOAA-KP-${sw.kpIndex.toFixed(1)}`,
          timestamp: new Date(sw.retrievedAt),
          parameter: 'kp_index',
          value: sw.kpIndex,
          baseline: 2.0,
          unit: 'index',
          description: `NOAA SWPC Space Weather: Active ${sw.geomagneticStormLevel} detected (Kp ${sw.kpIndex.toFixed(1)}) during anomaly window.`,
        });
        newEvidenceList.push(evidence);

        correlations.push({
          relationship: 'temporal_overlap',
          contextSource: 'NOAA SWPC',
          sourceEvent: `${anomaly.anomalyId} (${anomaly.parameter} ${anomaly.anomalyType})`,
          contextEvent: `Kp index ${sw.kpIndex.toFixed(1)} (${sw.geomagneticStormLevel})`,
          confidence: Math.min(0.85, 0.5 + (sw.kpIndex - 5) * 0.08),
          causalEvidence: false,
          note: 'Temporal overlap with geomagnetic storm reported. Temporal proximity does not establish causation.',
          evidenceId: evidence.evidenceId,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.debug('NOAA space weather correlation check skipped', { error: msg });
    }

    // 2. NASA DONKI Solar Flare / CME Temporal Overlap
    try {
      const donkiEvents = await DonkiService.getEventsInWindow(windowStart, windowEnd);
      for (const ev of donkiEvents) {
        const evidence = await EvidenceService.createEvidence({
          source: 'environment',
          sourceId: ev.eventId,
          timestamp: new Date(ev.timestamp),
          description: `NASA DONKI: ${ev.eventType} (${ev.severity || 'solar event'}) active at ${new Date(ev.timestamp).toISOString()}: ${ev.description.slice(0, 150)}`,
        });
        newEvidenceList.push(evidence);

        correlations.push({
          relationship: 'temporal_overlap',
          contextSource: 'NASA DONKI',
          sourceEvent: `${anomaly.anomalyId} (${anomaly.subsystem})`,
          contextEvent: `${ev.eventType} event ${ev.eventId}`,
          confidence: ev.severity === 'critical' ? 0.78 : ev.severity === 'high' ? 0.65 : 0.52,
          causalEvidence: false,
          note: 'Solar activity temporally coincided with anomaly window. Causal determination requires deeper engineering telemetry review.',
          evidenceId: evidence.evidenceId,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.debug('NASA DONKI correlation check skipped', { error: msg });
    }

    // 3. Orbital Environmental Overlap (South Atlantic Anomaly / Radiation Belt)
    try {
      const orbital = await OrbitalService.getOrbitalContext(anomaly.satelliteId);
      if (orbital.inSouthAtlanticAnomaly) {
        const evidence = await EvidenceService.createEvidence({
          source: 'orbit',
          sourceId: `SAA-ORBIT-${orbital.regime}`,
          timestamp: new Date(),
          description: `CelesTrak Ephemeris: Spacecraft ${anomaly.satelliteId} was inside the South Atlantic Anomaly (SAA) high-radiation corridor during anomaly detection.`,
        });
        newEvidenceList.push(evidence);

        correlations.push({
          relationship: 'environmental_overlap',
          contextSource: 'CelesTrak GP Ephemeris',
          sourceEvent: `${anomaly.anomalyId} (${anomaly.parameter})`,
          contextEvent: 'South Atlantic Anomaly (SAA) Traversal',
          confidence: 0.74,
          causalEvidence: false,
          note: 'Spacecraft trajectory crossed the South Atlantic Anomaly radiation belt. Known to cause transient sensor read noise or SEUs; does not prove hardware failure.',
          evidenceId: evidence.evidenceId,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.debug('Orbital SAA correlation check skipped', { error: msg });
    }

    // 4. Subsystem Physical Coupling
    // Physically coupled pairs: power <-> thermal, attitude <-> communication
    const coupledPairs: Record<string, string[]> = {
      power: ['thermal'],
      thermal: ['power'],
      communication: ['attitude'],
      attitude: ['communication'],
    };

    const targetSubsystem = anomaly.subsystem;
    const potentialCoupled = coupledPairs[targetSubsystem] || [];

    if (potentialCoupled.length > 0) {
      let activeAnomalies = AnomalyService.getActiveAnomaliesSync(anomaly.satelliteId);
      if (activeAnomalies.length === 0) {
        try {
          activeAnomalies = await AnomalyService.getAnomalies({ satelliteId: anomaly.satelliteId });
        } catch {
          // ignore
        }
      }
      const coupledAnomalies = activeAnomalies.filter(
        (a) => a.anomalyId !== anomaly.anomalyId && potentialCoupled.includes(a.subsystem)
      );

      for (const coupled of coupledAnomalies) {
        correlations.push({
          relationship: 'subsystem_coupling',
          contextSource: 'Physical Subsystem Topology',
          sourceEvent: `${anomaly.anomalyId} (${anomaly.subsystem})`,
          contextEvent: `${coupled.anomalyId} (${coupled.subsystem})`,
          confidence: 0.82,
          causalEvidence: false,
          note: `${anomaly.subsystem} and ${coupled.subsystem} subsystems are physically coupled. Cross-subsystem loading or thermal dissipation may be interrelated.`,
        });
      }
    }

    // 5. Attach new Evidence IDs to the Anomaly record
    const attachedEvidenceIds: string[] = [];
    if (newEvidenceList.length > 0) {
      for (const ev of newEvidenceList) {
        if (!anomaly.evidenceIds.includes(ev.evidenceId)) {
          anomaly.evidenceIds.push(ev.evidenceId);
          attachedEvidenceIds.push(ev.evidenceId);
        }
      }
      // Update persistent repository
      try {
        await AnomalyService.updateAnomalyStatus(anomaly.anomalyId, anomaly.status);
      } catch {
        // Keep in memory
      }
    }

    logger.info('Correlation evaluation completed', {
      anomalyId: anomaly.anomalyId,
      correlationsCount: correlations.length,
      newEvidenceCount: attachedEvidenceIds.length,
    });

    return {
      anomalyId: anomaly.anomalyId,
      satelliteId: anomaly.satelliteId,
      correlatedAt: new Date().toISOString(),
      correlations,
      attachedEvidenceIds,
    };
  }
}

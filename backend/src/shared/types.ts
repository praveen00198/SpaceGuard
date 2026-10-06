/**
 * Shared TypeScript types for SpaceGuard AI.
 * These correspond to the canonical schemas defined in docs/DATA_SCHEMA.md.
 */

// --- Enums ---

export type TelemetrySubsystem = 'power' | 'thermal' | 'communication' | 'attitude' | 'payload';
export type TelemetrySource = 'simulator' | 'satnogs' | 'dataset' | 'manual';
export type DataQuality = 'valid' | 'suspect' | 'interpolated' | 'missing' | 'stale';
export type DetectionMethod = 'rule' | 'statistical' | 'ml' | 'hybrid';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyType = 'spike' | 'drift' | 'dropout' | 'flatline' | 'oscillation' | 'threshold' | 'variance_change';
export type AnomalyStatus = 'active' | 'investigating' | 'resolved' | 'dismissed';
export type HealthStatus = 'nominal' | 'degraded' | 'critical' | 'unknown';
export type EvidenceSource = 'telemetry' | 'anomaly' | 'environment' | 'orbit' | 'historical';
export type SatelliteType = 'cubesat' | 'smallsat' | 'medium' | 'large' | 'simulated';
export type SatelliteStatus = 'active' | 'inactive' | 'decommissioned' | 'simulated';

// --- Interfaces ---

export interface ITelemetryReading {
  satelliteId: string;
  parameter: string;
  timestamp: Date;
  value: number;
  unit: string;
  subsystem: TelemetrySubsystem;
  source: TelemetrySource;
  sourceRecordId?: string;
  sensorId?: string;
  quality: DataQuality;
  ingestedAt: Date;
}

export interface ISatellite {
  satelliteId: string;
  name: string;
  noradId?: number;
  intlDesignator?: string;
  type: SatelliteType;
  operator?: string;
  mission?: string;
  status: SatelliteStatus;
  launchDate?: Date;
  dataSource: TelemetrySource;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnomaly {
  anomalyId: string;
  satelliteId: string;
  detectedAt: Date;
  detectionMethod: DetectionMethod;
  anomalyScore: number;
  severity: AnomalySeverity;
  parameter: string;
  subsystem: TelemetrySubsystem;
  value: number;
  baseline: number;
  unit: string;
  anomalyType: AnomalyType;
  evidenceIds: string[];
  status: AnomalyStatus;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHealthSnapshot {
  satelliteId: string;
  timestamp: Date;
  subsystems: Record<TelemetrySubsystem, ISubsystemHealth>;
  overallHealth: number;
  overallStatus: HealthStatus;
  activeAnomalies: number;
}

export interface ISubsystemHealth {
  score: number;
  status: HealthStatus;
}

export interface IEvidence {
  evidenceId: string;
  source: EvidenceSource;
  sourceId: string;
  timestamp: Date;
  parameter?: string;
  value?: number;
  baseline?: number;
  unit?: string;
  description: string;
  createdAt: Date;
}

export interface IAIAssessment {
  assessmentId: string;
  anomalyId: string;
  satelliteId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  evidenceClaims: Array<{
    claim: string;
    evidenceIds: string[];
  }>;
  interpretation: string;
  possibleCauses: string[];
  known: string[];
  unknown: string[];
  cannotDetermine: string[];
  uncertainty: string;
  recommendedInvestigation: string[];
  modelUsed: string;
  promptVersion: string;
  requestedAt: Date;
  respondedAt: Date;
  latencyMs: number;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
}

export interface IEnvironmentalEvent {
  eventId: string;
  source: 'noaa_swpc' | 'nasa_donki';
  eventType: string;
  timestamp: Date;
  endTime?: Date;
  severity?: string;
  description: string;
  rawData: Record<string, unknown>;
  retrievedAt: Date;
}

export interface ISimulationScenario {
  scenarioId: string;
  name: string;
  faultType: string;
  startTime: Date;
  endTime: Date;
  affectedParameter: string;
  affectedSubsystem: TelemetrySubsystem;
  severity: AnomalySeverity;
  groundTruth: {
    anomalyExpected: boolean;
    expectedDetectionMethod: DetectionMethod[];
    faultDescription: string;
  };
}

export interface IDatasetMetadata {
  datasetId: string;
  source: string;
  sourceVersion?: string;
  retrievedAt: Date;
  license: string;
  attribution: string;
  checksum?: string;
  preprocessingVersion: string;
  recordCount?: number;
  notes?: string;
}

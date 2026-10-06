export type TelemetrySubsystem = 'power' | 'thermal' | 'communication' | 'attitude' | 'payload';
export type TelemetrySource = 'simulator' | 'satnogs' | 'dataset' | 'manual';
export type DataQuality = 'valid' | 'suspect' | 'interpolated' | 'missing' | 'stale';
export type DetectionMethod = 'rule' | 'statistical' | 'ml' | 'hybrid';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyType = 'spike' | 'drift' | 'dropout' | 'flatline' | 'oscillation' | 'threshold' | 'variance_change';
export type AnomalyStatus = 'active' | 'investigating' | 'resolved' | 'dismissed';
export type HealthStatus = 'nominal' | 'degraded' | 'critical' | 'unknown';

export interface ITelemetryReading {
  satelliteId: string;
  parameter: string;
  timestamp: string;
  value: number;
  unit: string;
  subsystem: TelemetrySubsystem;
  source: TelemetrySource;
  quality: DataQuality;
  ingestedAt: string;
}

export interface ISatellite {
  satelliteId: string;
  name: string;
  noradId?: number;
  intlDesignator?: string;
  type: string;
  operator?: string;
  mission?: string;
  status: string;
  launchDate?: string;
  dataSource: TelemetrySource;
}

export interface IAnomaly {
  anomalyId: string;
  satelliteId: string;
  detectedAt: string;
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
  createdAt: string;
}

export interface ISubsystemHealth {
  score: number;
  status: HealthStatus;
}

export interface IHealthSnapshot {
  satelliteId: string;
  timestamp: string;
  subsystems: Record<TelemetrySubsystem, ISubsystemHealth>;
  overallHealth: number;
  overallStatus: HealthStatus;
  activeAnomalies: number;
}

export interface IEvidence {
  evidenceId: string;
  source: string;
  sourceId: string;
  timestamp: string;
  parameter?: string;
  value?: number;
  baseline?: number;
  unit?: string;
  description: string;
  createdAt: string;
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
  requestedAt: string;
  respondedAt: string;
  latencyMs: number;
  status: 'success' | 'error' | 'timeout';
}

export interface SpaceWeatherStatus {
  source: string;
  retrievedAt: string;
  kpIndex: number | null;
  geomagneticStormLevel: string;
  solarRadiationLevel: string;
  radioBlackoutLevel: string;
  status: 'live' | 'cached' | 'unavailable';
  details?: string;
}

export interface SimulationScenarioConfig {
  id: string;
  name: string;
  description: string;
  targetSubsystem: TelemetrySubsystem;
  targetParameter: string;
}

export interface OrbitalContext {
  satelliteId: string;
  noradId?: number;
  regime: 'LEO' | 'MEO' | 'GEO' | 'HEO';
  altitudeKm: number;
  inclinationDeg: number;
  periodMinutes: number;
  inSouthAtlanticAnomaly: boolean;
  saaZoneProximity: 'inside' | 'approaching' | 'clear';
  radiationEnvironment: 'elevated_saa' | 'nominal_leo' | 'quiet';
  retrievedAt: string;
  source: string;
}

export interface CorrelationItem {
  relationship: 'temporal_overlap' | 'environmental_overlap' | 'subsystem_coupling' | 'historical_similarity';
  contextSource: string;
  sourceEvent: string;
  contextEvent: string;
  confidence: number;
  causalEvidence: false;
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

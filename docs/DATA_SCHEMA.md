# SpaceGuard AI — Data Schema

## Canonical Telemetry Schema

All telemetry data, regardless of source, is normalized to this canonical schema before storage and processing.

### TelemetryReading

```typescript
interface ITelemetryReading {
  // Identity
  satelliteId: string;          // SpaceGuard satellite ID (e.g., "SAT-001")
  parameter: string;            // Parameter name (e.g., "battery_voltage")
  
  // Measurement
  timestamp: Date;              // ISO 8601 UTC timestamp
  value: number;                // Measured value
  unit: string;                 // SI unit (e.g., "C", "V", "A", "deg")
  
  // Classification
  subsystem: TelemetrySubsystem; // power | thermal | communication | attitude | payload
  
  // Provenance
  source: TelemetrySource;      // simulator | satnogs | dataset | manual
  sourceRecordId?: string;      // Original record ID from source
  sensorId?: string;            // Sensor identifier if available
  
  // Quality
  quality: DataQuality;         // valid | suspect | interpolated | missing | stale
  
  // Metadata
  ingestedAt: Date;             // When SpaceGuard received this data
}

type TelemetrySubsystem = 'power' | 'thermal' | 'communication' | 'attitude' | 'payload';
type TelemetrySource = 'simulator' | 'satnogs' | 'dataset' | 'manual';
type DataQuality = 'valid' | 'suspect' | 'interpolated' | 'missing' | 'stale';
```

### Satellite

```typescript
interface ISatellite {
  satelliteId: string;          // SpaceGuard ID
  name: string;                 // Display name
  noradId?: number;             // NORAD catalog number
  intlDesignator?: string;      // International designator
  
  // Classification
  type: SatelliteType;          // cubesat | smallsat | medium | large | simulated
  operator?: string;            // Operating organization
  mission?: string;             // Mission name
  
  // Status
  status: SatelliteStatus;      // active | inactive | decommissioned | simulated
  launchDate?: Date;
  
  // Configuration
  subsystems: SubsystemConfig[];
  telemetryParameters: ParameterConfig[];
  
  // Metadata
  dataSource: TelemetrySource;
  createdAt: Date;
  updatedAt: Date;
}
```

### Anomaly

```typescript
interface IAnomaly {
  anomalyId: string;
  satelliteId: string;
  
  // Detection
  detectedAt: Date;
  detectionMethod: DetectionMethod; // rule | statistical | ml | hybrid
  anomalyScore: number;            // 0-1 (model confidence, NOT fault probability)
  severity: AnomalySeverity;       // low | medium | high | critical
  
  // Context
  parameter: string;
  subsystem: TelemetrySubsystem;
  value: number;
  baseline: number;
  unit: string;
  
  // Classification
  anomalyType: AnomalyType;       // spike | drift | dropout | flatline | oscillation | threshold | variance_change
  
  // Evidence
  evidenceIds: string[];
  
  // Status
  status: AnomalyStatus;          // active | investigating | resolved | dismissed
  
  // Metadata
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

type DetectionMethod = 'rule' | 'statistical' | 'ml' | 'hybrid';
type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
type AnomalyType = 'spike' | 'drift' | 'dropout' | 'flatline' | 'oscillation' | 'threshold' | 'variance_change';
type AnomalyStatus = 'active' | 'investigating' | 'resolved' | 'dismissed';
```

### HealthSnapshot

```typescript
interface IHealthSnapshot {
  satelliteId: string;
  timestamp: Date;
  
  // Subsystem health (0-100, deterministic calculation)
  subsystems: {
    power: SubsystemHealth;
    thermal: SubsystemHealth;
    communication: SubsystemHealth;
    attitude: SubsystemHealth;
    payload: SubsystemHealth;
  };
  
  // Overall health
  overallHealth: number;         // 0-100
  overallStatus: HealthStatus;   // nominal | degraded | critical | unknown
  
  // Active anomaly count
  activeAnomalies: number;
}

interface SubsystemHealth {
  score: number;                 // 0-100
  status: HealthStatus;
  parameters: ParameterHealth[];
}

type HealthStatus = 'nominal' | 'degraded' | 'critical' | 'unknown';
```

### Evidence

```typescript
interface IEvidence {
  evidenceId: string;
  source: EvidenceSource;       // telemetry | anomaly | environment | orbit | historical
  sourceId: string;
  
  timestamp: Date;
  parameter?: string;
  value?: number;
  baseline?: number;
  unit?: string;
  
  description: string;
  
  createdAt: Date;
}

type EvidenceSource = 'telemetry' | 'anomaly' | 'environment' | 'orbit' | 'historical';
```

### AIAssessment

```typescript
interface IAIAssessment {
  assessmentId: string;
  anomalyId: string;
  satelliteId: string;
  
  // AI output (structured)
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
  
  // Metadata
  modelUsed: string;
  promptVersion: string;
  requestedAt: Date;
  respondedAt: Date;
  latencyMs: number;
  
  // Status
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
}
```

### EnvironmentalEvent

```typescript
interface IEnvironmentalEvent {
  eventId: string;
  source: 'noaa_swpc' | 'nasa_donki';
  
  eventType: string;             // kp_index | solar_flare | cme | geomagnetic_storm | sep | hss
  timestamp: Date;
  endTime?: Date;
  
  severity?: string;
  description: string;
  
  // Raw data
  rawData: Record<string, unknown>;
  
  retrievedAt: Date;
}
```

### SimulationScenario

```typescript
interface ISimulationScenario {
  scenarioId: string;
  name: string;
  
  faultType: FaultType;
  startTime: Date;
  endTime: Date;
  
  affectedParameter: string;
  affectedSubsystem: TelemetrySubsystem;
  severity: AnomalySeverity;
  
  // Ground truth
  groundTruth: {
    anomalyExpected: boolean;
    expectedDetectionMethod: DetectionMethod[];
    faultDescription: string;
  };
}

type FaultType = 'thermal_spike' | 'thermal_drift' | 'battery_degradation' | 'voltage_drop' |
  'current_anomaly' | 'sensor_bias' | 'sensor_drift' | 'sensor_dropout' | 'sensor_flatline' |
  'comm_latency' | 'packet_loss' | 'oscillation' | 'variance_change';
```

## Database Indexes

```
telemetryReadings:
  - { satelliteId: 1, timestamp: -1 }                    // Primary query pattern
  - { satelliteId: 1, parameter: 1, timestamp: -1 }      // Parameter-specific queries
  - { timestamp: -1 }                                     // Time-range queries

anomalies:
  - { satelliteId: 1, status: 1 }                         // Active anomalies per satellite
  - { detectedAt: -1 }                                    // Recent anomalies
  - { severity: 1, status: 1 }                            // Priority filtering

healthSnapshots:
  - { satelliteId: 1, timestamp: -1 }                     // Latest health per satellite

evidence:
  - { evidenceId: 1 }                                     // Evidence lookup
  - { sourceId: 1 }                                       // Evidence by source

environmentalEvents:
  - { timestamp: -1 }                                     // Time-range queries
  - { eventType: 1, timestamp: -1 }                       // Event type filtering
```

## Data Provenance Record

```typescript
interface IDatasetMetadata {
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
```

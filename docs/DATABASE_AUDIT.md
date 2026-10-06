# SpaceGuard AI — Database & Persistence Audit

> Audit Baseline: Phase 1 Audit
> Critical Finding: **MongoDB is NOT connected in the current codebase.**

---

## 1. Reality vs Documentation Matrix

| Entity | Stored in In-Memory? | Persisted in MongoDB? | Exposed via API? | Displayed in Frontend? | Survives Server Restart? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Satellite** | Yes (`Map<string, ISatellite>`) | **No** (0 models) | Yes (`/api/satellites`) | Yes (Dashboard, Telemetry) | **No** (Reverts to 3 seed satellites) |
| **Telemetry** | Yes (`Map<string, ITelemetryReading[]>`) | **No** (0 models) | Yes (`/api/telemetry`) | Yes (Recharts live stream) | **No** (Completely wiped) |
| **Anomaly** | Yes (`Map<string, IAnomaly>`) | **No** (0 models) | Yes (`/api/anomalies`) | Yes (Anomaly Center) | **No** (Completely wiped) |
| **Health Snapshot** | Transient on-demand calculation | **No** (0 models) | Yes (`/api/health`) | Yes (Dashboard health bars) | **No** (Re-calculated from memory) |
| **Evidence** | Yes (`Map<string, IEvidence>`) | **No** (0 models) | Yes (`/api/evidence`) | Yes (Modal citations) | **No** (Completely wiped, counter resets to 1) |
| **AI Assessment** | Yes (`Map<string, IAIAssessment>`) | **No** (0 models) | Yes (`/api/assessments`) | Yes (Investigation Modal) | **No** (Completely wiped) |
| **Space Weather** | Yes (2-minute in-memory cache) | **No** (0 models) | Yes (`/api/space-weather`) | Yes (Dashboard card) | **No** (Re-fetched or falls back to snapshot) |
| **Simulation** | Yes (Static class variables) | **No** (0 models) | Yes (`/api/simulation`) | Yes (Simulation Lab) | **No** (Stops, tickCount resets to 0) |

---

## 2. In-Depth Codebase Verification

1. **Mongoose Dependency**:
   * [`backend/package.json`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/package.json) lists `"mongoose": "^8.9.5"`.
   * However, `grep_search` reveals **0 occurrences of `mongoose`** in `backend/src/`.
   * No `mongoose.connect()`, no schemas, no models, no repositories exist in source code.

2. **Configuration vs Code**:
   * [`backend/src/config/index.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/config/index.ts) defines `config.mongodb = { uri, dbName }`.
   * This configuration is currently dead code; no module consumes it.

3. **Status Route Deception**:
   * In [`backend/src/index.ts:90`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/index.ts#L90), the endpoint `/api/system/data-sources` returns `{ name: 'In-Memory Store', status: 'connected', type: 'database' }`.
   * Previously this returned `MongoDB: not_connected`.

---

## 3. Storage Limitations of Current In-Memory State

* **Telemetry Ring Buffer**:
  * Bounded at `MAX_READINGS_PER_SATELLITE = 10000` ([`telemetryService.ts:8`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/telemetry/telemetryService.ts#L8)).
  * At 1 Hz for 11 parameters across 3 satellites, 10,000 readings per satellite represents ~15 minutes of operational data before points are shifted out (`buffer.shift()`).
* **Evidence Store Unbounded Growth**:
  * [`evidenceService.ts:4`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/evidence/evidenceService.ts#L4) uses an unbounded `Map<string, IEvidence>`. During continuous operation with fault injection, this Map will grow continuously until process memory limits are hit.
* **Anomaly Store Unbounded Growth**:
  * [`anomalyService.ts:8`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/anomalies/anomalyService.ts#L8) uses an unbounded `Map<string, IAnomaly>`.
* **Process Termination**:
  * Any container restart, redeploy, or unhandled crash results in catastrophic loss of all flight logs, anomaly records, and evidence trails.

---

## 4. Required Schema & Indexing Architecture for Phase 2

To achieve production readiness, the following Mongoose schemas and compound indexes must be introduced:

### 1. `TelemetryReadingModel` (Time-series collection)
```typescript
{
  satelliteId: { type: String, required: true, index: true },
  parameter: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true },
  subsystem: { type: String, enum: ['power', 'thermal', 'communication', 'attitude', 'payload'], required: true },
  source: { type: String, enum: ['simulator', 'satnogs', 'dataset', 'manual'], default: 'simulator' },
  quality: { type: String, enum: ['valid', 'suspect', 'interpolated', 'missing', 'stale'], default: 'valid' },
  ingestedAt: { type: Date, default: Date.now }
}
// Required Compound Index:
// { satelliteId: 1, parameter: 1, timestamp: -1 }
// TTL Index for dev retention: { ingestedAt: 1 }, expireAfterSeconds: 604800 (7 days)
```

### 2. `AnomalyModel`
```typescript
{
  anomalyId: { type: String, required: true, unique: true },
  satelliteId: { type: String, required: true, index: true },
  detectedAt: { type: Date, required: true, index: true },
  detectionMethod: { type: String, enum: ['rule', 'statistical', 'ml', 'hybrid'], required: true },
  anomalyScore: { type: Number, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true, index: true },
  parameter: { type: String, required: true },
  subsystem: { type: String, required: true },
  value: { type: Number, required: true },
  baseline: { type: Number, required: true },
  unit: { type: String, required: true },
  anomalyType: { type: String, required: true },
  evidenceIds: [{ type: String }],
  status: { type: String, enum: ['active', 'investigating', 'resolved', 'dismissed'], default: 'active', index: true },
  description: { type: String, required: true }
}
// Required Compound Index:
// { satelliteId: 1, status: 1, detectedAt: -1 }
```

### 3. `EvidenceModel`
```typescript
{
  evidenceId: { type: String, required: true, unique: true },
  source: { type: String, required: true },
  sourceId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  parameter: { type: String },
  value: { type: Number },
  baseline: { type: Number },
  unit: { type: String },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}
```

### 4. `SatelliteModel`
```typescript
{
  satelliteId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  noradId: { type: Number },
  intlDesignator: { type: String },
  type: { type: String, default: 'smallsat' },
  operator: { type: String },
  mission: { type: String },
  status: { type: String, default: 'active' },
  launchDate: { type: Date },
  dataSource: { type: String, default: 'simulator' }
}
```

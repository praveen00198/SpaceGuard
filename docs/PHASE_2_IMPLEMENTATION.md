# SpaceGuard AI — Phase 2 Implementation Report
# Backend Persistence & Repository Architecture

---

## 1. Objective

The objective of Phase 2 was to convert the SpaceGuard AI backend from an in-memory demo architecture into a persistent, MongoDB-backed repository architecture while strictly preserving:
- The telemetry $\rightarrow$ anomaly $\rightarrow$ evidence $\rightarrow$ health $\rightarrow$ Gemini AI diagnostic pipeline.
- The real-time in-memory ring buffer (up to 10,000 readings per spacecraft) for low-latency dashboard charting and WebSocket ticks.
- The semantic distinction between `anomalyScore`, `severity`, `healthScore`, and `causalConfidence`.
- Evidence identity stability (`EVID-*`) and deterministic health calculations.
- All public REST API endpoints and Socket.IO contracts.

---

## 2. Before Architecture

```
Telemetry Ingestion / Simulation
               │
               ▼
     TelemetryNormalizer
               │
               ▼
     In-Memory Ring Buffer (10,000 max/satellite)
               │
               ▼
     AnomalyService (Rules + Stats + ML)
               │
               ▼
     EvidenceService (EVID-* tokens in JS Map)
               │
               ▼
     HealthService (Deterministic JS evaluation)
               │
               ▼
     GeminiService (JS Map cache)
```

**Flaws of Before Architecture**:
- All telemetry, anomalies, evidence tokens, and AI assessments disappeared completely upon server restart (100% data loss).
- Satellites were seeded in memory from static array constants; custom spacecraft registrations were lost on restart.
- Historical queries were limited only to whatever remained inside transient JavaScript `Map` instances.

---

## 3. After Architecture

```
Telemetry Ingestion / Simulation
               │
               ▼
     TelemetryNormalizer
               │
               ▼
  ┌─────────────────────────────────────────────────────────┐
  │                   TelemetryService                      │
  │  • Real-time in-memory ring buffer (10k/craft)          │
  │  • Latest reading cache (0ms lookup)                    │
  │  • Controlled Persistence Batch Queue (bounded 5k max)   │
  └────────────┬────────────────────────────┬───────────────┘
               │                            │
      Async Batch Flush                     ▼
               │                AnomalyService (Rules + Stats + ML)
               │                            │
               │                            ▼
               │                 EvidenceService (Stable Sequences)
               │                            │
               │                            ▼
               │                 HealthService (Deterministic Snapshots)
               │                            │
               │                            ▼
               │                 GeminiService (Structured Diagnostic Cache)
               │                            │
               ▼                            ▼
  ┌─────────────────────────────────────────────────────────┐
  │                   Repository Layer                      │
  │  • ISatelliteRepository     → MongoSatelliteRepository  │
  │  • ITelemetryRepository     → MongoTelemetryRepository  │
  │  • IAnomalyRepository       → MongoAnomalyRepository    │
  │  • IEvidenceRepository      → MongoEvidenceRepository   │
  │  • IHealthRepository        → MongoHealthRepository     │
  │  • IAIAssessmentRepository  → MongoAIAssessmentRepo     │
  └────────────────────────────┬────────────────────────────┘
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │                    MongoDB Database                     │
  │  • satellites              • telemetryReadings          │
  │  • anomalies               • evidence                   │
  │  • healthSnapshots         • aiAssessments              │
  └─────────────────────────────────────────────────────────┘
```

The service layer depends exclusively on repository interfaces (`ISatelliteRepository`, `ITelemetryRepository`, etc.) rather than hardcoded Mongoose models. In-memory repository implementations are also provided for deterministic unit testing and disconnected operation.

---

## 4. MongoDB Connection Lifecycle

Implemented in [`backend/src/config/database.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/config/database.ts):
- **Connection Configuration**: Configured through `MONGODB_URI` and `MONGODB_DB_NAME` via environment variables.
- **Fail-Fast & Non-Blocking**: Command buffering is disabled (`mongoose.set('bufferCommands', false)`), and repositories implement `assertConnected()` guards. If the database is unreachable, the system logs a degraded warning and continues operating from the in-memory ring buffer without freezing the event loop.
- **Credential Sanitization**: The helper `sanitizeMongoUri()` redacts embedded passwords (`mongodb://***:***@...`) before emitting connection logs.
- **Connection Events**: Explicit handlers for `connected`, `error`, and `disconnected` states.
- **Graceful Termination**: `disconnectDatabase()` cleanly closes connections on `SIGINT`/`SIGTERM`.

---

## 5. Mongoose Models

All models reside in [`backend/src/models/`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/models/) and mirror the canonical schemas in `backend/src/shared/types.ts`:

1. **`Satellite.ts`** (`satellites` collection):
   - Fields: `satelliteId` (unique index), `name`, `noradId`, `intlDesignator`, `type`, `operator`, `mission`, `status`, `launchDate`, `dataSource`.
   - Timestamps: `createdAt`, `updatedAt`.
2. **`TelemetryReading.ts`** (`telemetryReadings` collection):
   - Fields: `satelliteId`, `parameter`, `timestamp`, `value`, `unit`, `subsystem`, `source`, `sourceRecordId`, `sensorId`, `quality`, `ingestedAt`.
3. **`Anomaly.ts`** (`anomalies` collection):
   - Fields: `anomalyId` (unique index), `satelliteId`, `detectedAt`, `detectionMethod`, `anomalyScore`, `severity`, `parameter`, `subsystem`, `value`, `baseline`, `unit`, `anomalyType`, `evidenceIds`, `status`, `description`.
4. **`Evidence.ts`** (`evidence` collection):
   - Fields: `evidenceId` (unique index), `source`, `sourceId`, `timestamp`, `parameter`, `value`, `baseline`, `unit`, `description`, `createdAt`.
5. **`HealthSnapshot.ts`** (`healthSnapshots` collection):
   - Fields: `satelliteId`, `timestamp`, `subsystems` (nested scores and statuses for power, thermal, comm, attitude, payload), `overallHealth`, `overallStatus`, `activeAnomalies`.
6. **`AIAssessment.ts`** (`aiAssessments` collection):
   - Fields: `assessmentId` (unique index), `anomalyId`, `satelliteId`, `priority`, `summary`, `evidenceClaims`, `interpretation`, `possibleCauses`, `known`, `unknown`, `cannotDetermine`, `uncertainty`, `recommendedInvestigation`, `modelUsed`, `promptVersion`, `requestedAt`, `respondedAt`, `latencyMs`, `status`.

---

## 6. Repository Layer

Located in [`backend/src/repositories/`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/repositories/):
- **Interfaces (`interfaces/`)**: TypeScript contracts (`ISatelliteRepository`, `ITelemetryRepository`, `IAnomalyRepository`, `IEvidenceRepository`, `IHealthRepository`, `IAIAssessmentRepository`).
- **Mongo Implementations (`mongo/`)**: Production Mongoose-backed implementations with compound indexes and aggregation pipelines.
- **In-Memory Implementations (`inmemory/`)**: High-speed, isolated repositories used for unit testing, offline development, and zero-dependency CI verification.
- **Central Registry (`index.ts`)**: Provides dependency-injected getters (`getTelemetryRepository()`, etc.) and setters for switching backends in tests.

---

## 7. Service Migration Summary

All 6 primary backend services were upgraded:
1. **`SatelliteService`**: Now loads from `ISatelliteRepository`. Retains an in-memory cache for synchronous reads and gracefully falls back to seed data if disconnected.
2. **`TelemetryService`**: Ingests readings, maintains real-time ring buffer, feeds anomaly detection, and stages data into a persistence queue for batch writes.
3. **`AnomalyService`**: Creates anomalies, generates evidence via `EvidenceService`, stores active records in memory, and persists to `IAnomalyRepository`.
4. **`EvidenceService`**: Generates stable sequence numbers across restarts using `getNextSequence()` and persists to `IEvidenceRepository`.
5. **`HealthService`**: Computes deterministic health weights and persists `IHealthSnapshot` records.
6. **`GeminiService`**: Checks in-memory cache and `IAIAssessmentRepository` before querying Gemini API; persists structured diagnoses.

---

## 8. Telemetry Persistence Strategy

- **Real-Time Responsiveness**: Incoming readings immediately update the in-memory ring buffer (up to 10,000 readings per satellite) and emit to WebSocket subscribers. Real-time latency remains $< 1\text{ ms}$.
- **Batching & Flushing**: Readings are staged in a bounded persistence queue. The queue is flushed to MongoDB via `insertMany({ ordered: false })` when:
  - Queue size reaches `BATCH_SIZE_THRESHOLD` (50 items), OR
  - Background periodic flush fires (`BATCH_FLUSH_INTERVAL_MS = 1000 ms`), OR
  - Explicit batch ingestion endpoint (`/api/telemetry/ingest/batch`) finishes, OR
  - Graceful shutdown (`SIGINT`/`SIGTERM`) is triggered.
- **Bounded Backpressure**: If MongoDB is unavailable, the queue buffers up to `MAX_QUEUE_SIZE = 5000` readings, dropping the oldest items to prevent memory leaks while keeping real-time operations alive.

---

## 9. Index Strategy

Compound indexes were established to optimize query access patterns:
- **`telemetryReadings`**:
  - `{ satelliteId: 1, timestamp: -1 }` (time-series slice queries)
  - `{ satelliteId: 1, parameter: 1, timestamp: -1 }` (specific parameter chart queries)
  - `{ satelliteId: 1, subsystem: 1, timestamp: -1 }` (subsystem telemetry queries)
- **`anomalies`**:
  - `{ anomalyId: 1 }` (unique domain identifier)
  - `{ satelliteId: 1, detectedAt: -1 }` (recent anomaly timeline)
  - `{ satelliteId: 1, status: 1 }` (active anomaly filtering)
- **`evidence`**:
  - `{ evidenceId: 1 }` (unique domain token)
  - `{ sourceId: 1 }`, `{ createdAt: -1 }`
- **`healthSnapshots`**:
  - `{ satelliteId: 1, timestamp: -1 }` (historical fleet health lookups)
- **`aiAssessments`**:
  - `{ assessmentId: 1 }`, `{ anomalyId: 1 }`
  - `{ satelliteId: 1, requestedAt: -1 }`

---

## 10. Idempotent Satellite Seeding

Implemented in [`backend/src/config/seed.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/config/seed.ts) and [`backend/src/scripts/seed.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/scripts/seed.ts):
- Checks existing satellites by `satelliteId` before inserting.
- Running seed multiple times does **NOT** duplicate satellites or wipe existing records.
- Verified in `repositories.test.ts`:
  - Run 1: 3 seeded, 0 existing (total: 3).
  - Run 2: 0 seeded, 3 existing (total: 3).
- Added npm script: `npm run seed` in `backend/package.json`.

---

## 11. Failure Handling & Graceful Degradation

| Failure Mode | System Behavior |
| :--- | :--- |
| **MongoDB Down at Startup** | Logs warning; starts in degraded mode; real-time ring buffer remains active. |
| **MongoDB Dropped Mid-Flight** | Bounded telemetry queue retains up to 5,000 readings; real-time charts and WebSockets continue; reconnection logged. |
| **Duplicate Document** | `unique: true` indexes reject duplicate domain IDs; service catches conflict and returns clean error. |
| **Database Query Error** | Services catch database errors, log structured warnings, and serve from in-memory fallback. |

---

## 12. Graceful Shutdown Behavior

Implemented in [`backend/src/index.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/index.ts) (`gracefulShutdown()`):
1. Traps `SIGTERM` and `SIGINT`.
2. Halts active simulation timers (`SimulationService.stop()`).
3. Flushes remaining pending telemetry queue (`TelemetryService.flushQueue()`).
4. Closes Socket.IO server and HTTP listener.
5. Cleanly disconnects Mongoose connection (`disconnectDatabase()`).
6. Enforces a 5-second upper bound to prevent hanging shutdown processes.

---

## 13. Testing Results

### Test Execution Matrix

| Test Suite | Location | Tests Passed | Status |
| :--- | :--- | :--- | :--- |
| **Rule Engine** | `src/modules/anomalies/ruleEngine.test.ts` | 2 / 2 |  PASS |
| **Statistical Engine** | `src/modules/anomalies/statisticalEngine.test.ts` | 2 / 2 |  PASS |
| **Health Service** | `src/modules/health/healthService.test.ts` | 2 / 2 |  PASS |
| **Satellite Service** | `src/modules/satellites/satelliteService.test.ts` | 2 / 2 |  PASS |
| **Gemini Grounding** | `src/modules/assessments/geminiService.test.ts` | 2 / 2 |  PASS |
| **Repositories Suite** | `src/repositories/repositories.test.ts` | 16 / 16 |  PASS |
| **Restart Acceptance** | `src/repositories/restartPersistence.test.ts` | 2 / 2 |  PASS |
| **Total Backend Jest** | — | **28 / 28** |  **100% PASS** |
| **Python Pytest Suite** | `tests/integration/` | **12 / 12** |  **100% PASS** |
| **Backend TS Build** | `tsc` (`dist/`) | **0 Errors** |  **100% PASS** |
| **Frontend Production** | `tsc -b && vite build` | **0 Errors (636 modules)** |  **100% PASS** |

---

## 14. Environment Variables

Configured in [`backend/src/config/index.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/config/index.ts):
- `MONGODB_URI`: Connection string (defaults to `mongodb://localhost:27017/spaceguard`).
- `MONGODB_DB_NAME`: Database name (defaults to `spaceguard`).

---

## 15. Restart Persistence Acceptance Verification

The automated verification in [`backend/src/repositories/restartPersistence.test.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/repositories/restartPersistence.test.ts) executed the following sequence:

1. **Pre-Restart**:
   - Seeded satellites (`SG-1`, `SG-2`, `SG-3`).
   - Ingested critical temperature reading (78.5°C) and flushed persistence batch.
   - Detected critical anomaly (`ANOM-SG-1-00001`) with generated evidence token (`EVID-TEL-00001`).
   - Computed and persisted deterministic health snapshot.
   - Generated and persisted structured AI assessment.
2. **Process Termination Simulation**:
   - Cleared all in-memory caches, latest maps, and ring buffers (`clearCache()`).
3. **Post-Restart Application Re-Query**:
   - Running seed resulted in 0 duplicates created (`seeded: 0, existing: 3`).
   - Querying historical telemetry returned the pre-restart 78.5°C reading.
   - Querying anomaly returned `ANOM-SG-1-00001` with status `active`.
   - Querying evidence returned original `EVID-TEL-00001` token.
   - Querying health returned matching pre-restart score.
   - Querying AI assessment returned identical structured diagnosis.

---

## 16. Known Limitations

- **Local Mongod Process**: When running the application locally on a developer workstation without an active `mongod` service, the backend runs in logged degraded mode (real-time ring buffer active, persistence offline).
- **Time-Series Collections**: Standard MongoDB collections with compound indexes are utilized for maximum Mongoose 8 compatibility rather than native MongoDB 5.0+ time-series collections.

---

## 17. Deferred Work

The following items are intentionally preserved for future phases:
- **Phase 3**: Socket.IO client URL configuration (`VITE_WS_URL`) and frontend polling deduplication.
- **Phase 4**: Ingestion polling workers for NASA DONKI and SatNOGS REST endpoints.
- **Phase 5**: Authentication, rate-limiting hardening, and audit logging.
- **Phase 6**: Cloud deployment to Render / MongoDB Atlas / Vercel.
- **Phase 7**: ML pipeline retraining and online inference optimization.

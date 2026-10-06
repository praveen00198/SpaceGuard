# SpaceGuard AI — Phase 1 Audit

> **Role**: Senior Full-Stack Architect, Backend Engineer, Frontend Engineer, Data-Platform Engineer & Production Readiness Auditor  
> **Date**: 2026-09-26  
> **Status**: Comprehensive Engineering Audit Complete  
> **Rule Adherence**: Audit-Only Phase — No Application Source Code Modified.

---

## 1. Executive Summary

SpaceGuard AI is an **evidence-grounded satellite health monitoring and anomaly investigation platform for human flight controllers**. The system is built around the foundational principle:

> **"AI reasons over evidence; AI does not invent evidence."**

The platform combines multi-subsystem telemetry normalization, hybrid multi-engine anomaly detection (Rule Engine + 3-Sigma Statistical Control + Isolation Forest ML), deterministic health scoring, structured evidence generation, and Google Gemini AI reasoning with strict citation constraints.

### Core Audit Verdict
* **What is working exceptionally well**:
  * **Layered Responsibility & Grounding**: The architectural boundary between telemetry detection and AI reasoning is strictly respected. Gemini is never used as an anomaly detector or telemetry generator.
  * **Test Coverage & Verification**: Current baseline test suites pass at **100%**:
    * **10 / 10** Backend Jest tests passing.
    * **12 / 12** Python Pytest integration tests passing.
    * **Frontend Production Build**: **636 modules** compile cleanly in 2.87s with TypeScript 5.7+ (`tsc -b && vite build`).
  * **Frontend Aesthetics & UI**: The React 19 / Tailwind / Recharts dashboard provides a responsive, dark mission-control interface with live chart tickers, filterable anomaly registers, and deep AI assessment modals.
  * **External Credentials**: Keys for Google Gemini, NASA DONKI, and SatNOGS are configured, secured via `.gitignore`, and verified live against remote endpoints.
* **The Primary Vulnerability**:
  * **Total Lack of Database Persistence**: The system currently runs entirely on in-memory JavaScript `Map` structures. MongoDB is configured in `package.json` and `.env.example`, but **no Mongoose schemas, models, or connection logic exist in the codebase**. Every server restart wipes out all historical telemetry, anomalies, evidence, and custom satellites.
* **The Secondary Vulnerabilities**:
  * **Polling Overhead**: The frontend heavily polls REST endpoints (every 1.5s to 4s) instead of relying fully on reactive WebSocket events.
  * **Deployment Configuration**: The Socket.IO client connects to `'/'`, which works in development via Vite proxy but will fail on cross-origin production deployments (e.g. Vercel frontend talking to Render backend).

---

## 2. Current Architecture

```
                                  MISSION OPERATOR / BROWSER
                                               │
                                 ┌─────────────┴─────────────┐
                                 │                           │
                                 ▼                           ▼
                        Vite React 19 Frontend      Socket.IO Client
                        (Tailwind CSS + Recharts)  (Live Readings & Alerts)
                                 │                           │
                                 │ HTTP REST (Proxy)         │ WebSocket (ws://)
                                 ▼                           ▼
                     ┌────────────────────────────────────────────────────────┐
                     │                 EXPRESS 4.21 BACKEND                   │
                     │                                                        │
                     │  ├── Telemetry Normalizer (SI Units, Quality Tags)     │
                     │  ├── Bounded In-Memory Ring Buffer (10k items/sat)     │
                     │  ├── Deterministic Health Engine (Subsystem weights)   │
                     │  ├── Evidence Registry (EVID-xxx unique identifiers)   │
                     │  ├── Simulation Engine (1.0 Hz Fault Injection Ticker) │
                     │  └── Space Weather Client (NOAA SWPC with Cache)       │
                     └───────────────┬────────────────────────┬───────────────┘
                                     │                        │
                    ┌────────────────┴─────────┐              │
                    ▼                          ▼              ▼
           HYBRID ANOMALY ENGINE        GEMINI REASONING   NOAA SWPC
          ┌───────────────────────┐   ┌─────────────────┐ (Public API)
          │ 1. Rule Engine        │   │ gemini-3.8-flash│
          │ 2. Statistical Engine │   │ (JSON Schema,   │
          │ 3. ML Client ─────────┤   │  Evidence IDs)  │
          └───────────┬───────────┘   └─────────────────┘
                      │ HTTP (1200ms timeout)
                      ▼
           PYTHON FASTAPI ML SERVICE
          (Isolation Forest + Density Fallback)
```

---

## 3. Backend Audit

### 3.1 Telemetry Normalizer (`normalizer.ts`)
* **Status**: Correctly Implemented.
* Maps telemetry across 5 subsystems: `power`, `thermal`, `communication`, `attitude`, `payload`.
* Enforces SI units: `V`, `A`, `W`, `C`, `C/min`, `dBm`, `%`, `ms`, `deg`.
* Tags data quality: `valid`, `suspect`, `interpolated`, `missing`, `stale`.

### 3.2 Telemetry Storage (`telemetryService.ts`)
* **Status**: Functional In-Memory Ring Buffer / **Missing Persistence**.
* Bounded to `10000` readings per satellite (`readingsStore.get(satId).push(reading)`).
* Query API provides downsampling, time-window filtering (`startTime`, `endTime`), and latest parameter caching.
* **Fragility**: High memory retention under long-running stress; completely volatile across restarts.

### 3.3 Satellite Management (`satelliteService.ts`)
* **Status**: Functional In-Memory Store / **Missing Persistence**.
* Pre-seeded with 3 spacecraft: `SG-1` (AURA-1), `SG-2` (ORION-3), `SG-3` (PULSAR-X).
* CRUD endpoints (`GET /api/satellites`, `POST /api/satellites`, `GET /api/satellites/:id`) work, but newly created satellites revert to default seeds upon process restart.

### 3.4 Hybrid Anomaly Detection
* **Rule Engine (`ruleEngine.ts`)**: Evaluates critical limits, nominal limits, rate-of-change, and sticky flatlines.
  * *Discrepancy*: Attitude parameters (`roll`, `pitch`, `yaw`) are absent from `PARAMETER_THRESHOLDS`.
  * *Discrepancy*: If a reading breaches nominal limits and exceeds rate-of-change, nominal range fires first.
* **Statistical Engine (`statisticalEngine.ts`)**: Sliding window of 30 samples, computes sample mean and variance. Evaluates Z-score.
  * *Verification*: Stated threshold $|Z| \ge 3.0$ is verified in code.
* **ML Microservice (`ml-service/app/main.py`)**: Runs scikit-learn `IsolationForest(n_estimators=100, contamination=0.03)` with an analytical density fallback.
* **Hybrid Orchestrator (`anomalyService.ts`)**:
  * Respects semantic separation: `anomalyScore` (model confidence) $\ne$ `severity` (operational impact) $\ne$ `healthScore` (subsystem calculation).
  * Automatically creates structured evidence items via `EvidenceService`.

### 3.5 Deterministic Health Engine (`healthService.ts`)
* **Status**: Correctly Implemented.
* Deterministically computes health scores:
  $$\text{Health} = 0.30 \cdot P + 0.25 \cdot T + 0.20 \cdot C + 0.15 \cdot A + 0.10 \cdot PL$$
* Health scores degrade mathematically upon active anomalies and missing sensor data.
* Calculated dynamically on demand; not persisted.

---

## 4. Frontend Audit

### 4.1 UI Architecture & Components
* Built on React 19, TypeScript, and Tailwind CSS.
* **Pages**:
  * `DashboardPage.tsx`: Fleet overview, constellation health, active anomalies, live NOAA space weather card, quick simulation triggers.
  * `TelemetryPage.tsx`: Real-time streaming charts via Recharts, nominal boundary lines, live tickers.
  * `AnomalyCenterPage.tsx`: Multi-filter anomaly log with severity/detector filters and status workflows (`active` $\rightarrow$ `investigating` $\rightarrow$ `resolved`).
  * `SimulationPage.tsx`: Control deck to trigger 7 spacecraft fault injection scenarios.
* **Investigation Modal (`InvestigationModal.tsx`)**:
  * Shows Gemini AI reasoning, evidence citation badges (`EVID-*`), physical interpretation, epistemological boundaries (*Knowns*, *Unknowns*, *Cannot Determine*), diagnostic uncertainty, and actionable recommendations.

### 4.2 State Management & Polling
* **Issue**: The frontend mixes reactive WebSockets with heavy HTTP polling:
  * `DashboardPage.tsx` polls 5 endpoints every 3000ms.
  * `AnomalyCenterPage.tsx` polls every 3000ms.
  * `App.tsx` polls active anomaly counts every 4000ms.
  * `SimulationPage.tsx` polls status every 1500ms.
* **Recommendation**: Consolidate status updates into Socket.IO event broadcasts to eliminate polling overhead.

---

## 5. Database Audit

### Current Persistence Matrix

| Entity | In-Memory | Database | Exposed in API | Rendered in Frontend | Survives Restart |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Satellite** | `Map<string, ISatellite>` | **None** | Yes (`/api/satellites`) | Yes | ❌ No |
| **Telemetry** | `Map<string, ITelemetryReading[]>` | **None** | Yes (`/api/telemetry`) | Yes | ❌ No |
| **Anomaly** | `Map<string, IAnomaly>` | **None** | Yes (`/api/anomalies`) | Yes | ❌ No |
| **Health** | Calculated on-demand | **None** | Yes (`/api/health`) | Yes | ❌ No |
| **Evidence** | `Map<string, IEvidence>` | **None** | Yes (`/api/evidence`) | Yes | ❌ No |
| **AI Assessment** | `Map<string, IAIAssessment>` | **None** | Yes (`/api/assessments`) | Yes | ❌ No |
| **Space Weather** | 2-min memory cache | **None** | Yes (`/api/space-weather`) | Yes | ❌ No |
| **Simulation** | Static class properties | **None** | Yes (`/api/simulation`) | Yes | ❌ No |

* **Audit Finding**: MongoDB is **0% connected** in the runtime code. Mongoose is listed in `package.json` dependencies, but never imported in `backend/src/`. All data is volatile.

---

## 6. API Audit

* Comprehensive inventory documented in [`docs/API_INVENTORY.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/API_INVENTORY.md).
* **Inventory Total**: 15 distinct HTTP endpoints across 8 feature modules.
* **Input Validation**: All POST/PATCH endpoints enforce Zod schemas at controller entry.
* **Error Sanitization**: `errorHandler` catches unhandled exceptions and returns sanitized JSON with internal logging.
* **Contract Consistency**: Frontend and backend property casing (`camelCase`) and enum values match cleanly.

---

## 7. WebSocket Audit

* Documented in [`docs/WEBSOCKET_CONTRACT.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/WEBSOCKET_CONTRACT.md).
* **Events**:
  * `subscribe:telemetry` / `unsubscribe:telemetry` (Client $\rightarrow$ Server)
  * `telemetry:reading` (Server $\rightarrow$ Client)
  * `anomaly:detected` (Server $\rightarrow$ Client)
  * `anomaly:alert` (Server $\rightarrow$ Client, redundant)
* **Discrepancy**: Backend emits both `anomaly:detected` and `anomaly:alert` simultaneously. The frontend only consumes `anomaly:detected`.
* **Discrepancy**: Backend performs both global `io.emit` and room-specific `io.to('telemetry:' + id).emit` for the same reading.

---

## 8. External Integration Audit

* Documented in [`docs/EXTERNAL_INTEGRATIONS.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/EXTERNAL_INTEGRATIONS.md).
* **Live Connectivity Verified**:
  * **NASA DONKI**: Verified live using user's key (returned 5 active space weather events).
  * **SatNOGS DB**: Verified live using user's token (retrieved 2,780 satellites).
  * **Google Gemini AI**: Verified live; model set to `gemini-3.8-flash`.
  * **NOAA SWPC**: Live planetary K-index operational.
* **Gaps**:
  * NASA DONKI and SatNOGS keys are valid and loaded, but their dedicated backend polling services are not yet built (scheduled for Phase 4).

---

## 9. Security Audit

* Documented in [`docs/SECURITY_AUDIT.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/SECURITY_AUDIT.md).
* **Secrets Isolation**: Passed. All keys reside exclusively in root `.env` / `.env.local` and are gitignored.
* **AI Security Boundary**: Passed. Gemini is strictly sandboxed with zero database access, zero shell access, zero function calling, and zero spacecraft commanding authority.
* **CORS**: Restricted in backend; ML service microservice CORS needs restriction in production.

---

## 10. Reliability Audit

* **Graceful Degradation Verified**:
  * If the ML microservice is offline, the backend times out cleanly after 1200ms, marks ML as unavailable, and continues anomaly detection using Rules and Statistics without crashing.
  * If NOAA SWPC is unreachable, the backend falls back to local snapshot data or returns `{ status: "unavailable" }`.
  * If Gemini AI fails or is unconfigured, the backend generates an evidence-grounded deterministic assessment citing the real evidence IDs without throwing a 500 error.

---

## 11. Production Readiness

* Documented in [`docs/DEPLOYMENT_READINESS.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/DEPLOYMENT_READINESS.md).
* **Score**: 70/100 (Development Ready; Persistence & Deployment Blockers Present).
* **Blockers to Production**:
  1. In-memory data volatility (requires MongoDB connection).
  2. Lack of `SIGTERM` / `SIGINT` graceful shutdown handlers.
  3. Hardcoded `/` WebSocket connection URL on the frontend.

---

## 12. Deployment Readiness

* Target Architecture:
  * **Frontend**: Vercel (React SPA)
  * **Backend**: Render / Railway (Node.js container)
  * **Database**: MongoDB Atlas
  * **ML Service**: Render / Railway (Python container)
* **Status**: Compatible once environment variables (`VITE_API_URL`, `VITE_WS_URL`) and MongoDB connection are implemented.

---

## 13. Testing Status

* **Backend Unit & Integration Tests**:
  * Framework: Jest + `ts-jest`
  * Result: **5 test suites passed, 10 / 10 tests passed**.
  * Modules covered: `ruleEngine`, `statisticalEngine`, `healthService`, `satelliteService`, `geminiService`.
* **Python Tests**:
  * Framework: Pytest
  * Result: **12 / 12 tests passed**.
  * Modules covered: Synthetic telemetry generator (8 tests), Isolation Forest ML microservice (4 tests).
* **Frontend Production Build**:
  * Command: `tsc -b && vite build`
  * Result: **Passed (0 errors)**, 636 modules transformed, built in 2.87s.
* **Test Gaps**:
  * No React component interaction tests (Vitest / React Testing Library).
  * No WebSocket end-to-end integration tests.
  * No database repository integration tests (since database is not yet connected).

---

## 14. Technical Debt

1. **Dual Anomaly WebSocket Events**: Emitting both `anomaly:detected` and `anomaly:alert`.
2. **Aggressive Frontend Polling**: Polling up to 5 endpoints every 1.5s–4s rather than using reactive WebSocket push.
3. **Attitude Thresholds Missing in Rule Engine**: `roll`, `pitch`, and `yaw` lack entries in `PARAMETER_THRESHOLDS`.
4. **Unbounded In-Memory Collections**: `evidenceStore` and `anomaliesStore` grow indefinitely until restart.
5. **Vite Proxy Dependency**: Frontend API client assumes relative paths `/api` and `/socket.io`.

---

## 15. Critical Issues

### Issue BE-001: Absence of Database Persistence
* **ID**: `BE-001`
* **Severity**: `CRITICAL`
* **Area**: Backend / Persistence
* **File**: [`backend/src/modules/telemetry/telemetryService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/telemetry/telemetryService.ts) & [`satelliteService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/satellites/satelliteService.ts)
* **Current Behavior**: Telemetry, anomalies, evidence, and custom satellites are stored solely in memory Maps.
* **Expected Behavior**: Telemetry and anomalies must be persisted to MongoDB with compound time-series indexes.
* **Impact**: Total data loss on container restart, redeploy, or crash.
* **Recommended Solution**: Implement Mongoose models and repository layer in Phase 2.
* **Dependencies**: MongoDB connection string (`MONGODB_URI`).

---

## 16. High Priority Issues

### Issue FE-001: Hardcoded Relative WebSocket Origin
* **ID**: `FE-001`
* **Severity**: `HIGH`
* **Area**: Frontend / Networking
* **File**: [`frontend/src/services/socket.ts:8`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/frontend/src/services/socket.ts#L8)
* **Current Behavior**: `socket = io('/', { ... })` connects to the window origin.
* **Expected Behavior**: Connect to `import.meta.env.VITE_WS_URL || window.location.origin`.
* **Impact**: WebSockets will fail completely when frontend is hosted on Vercel and backend on Render.
* **Recommended Solution**: Parameterize socket and API base URLs with environment variables.
* **Dependencies**: None.

### Issue BE-002: Missing Graceful Process Shutdown
* **ID**: `BE-002`
* **Severity**: `HIGH`
* **Area**: Backend / Lifecycle
* **File**: [`backend/src/index.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/index.ts)
* **Current Behavior**: No listener for `SIGTERM` or `SIGINT`.
* **Expected Behavior**: Server drains active HTTP requests, disconnects WebSockets, and stops timers before exiting.
* **Impact**: Dropped connections during cloud redeployments.
* **Recommended Solution**: Add process signal handlers and server draining in Phase 6.
* **Dependencies**: None.

---

## 17. Medium Priority Issues

### Issue FE-002: Excessive HTTP Polling
* **ID**: `FE-002`
* **Severity**: `MEDIUM`
* **Area**: Frontend / Performance
* **File**: [`frontend/src/pages/DashboardPage.tsx:38-42`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/frontend/src/pages/DashboardPage.tsx#L38-L42)
* **Current Behavior**: Dashboard fires 5 API calls every 3000ms.
* **Expected Behavior**: Dashboard receives real-time updates via Socket.IO events and only fetches on mount.
* **Impact**: High unnecessary HTTP traffic on backend.
* **Recommended Solution**: Transition dashboard metrics to Socket.IO broadcasts in Phase 5.
* **Dependencies**: Phase 3.

### Issue BE-003: Duplicate Anomaly Socket Events
* **ID**: `BE-003`
* **Severity**: `MEDIUM`
* **Area**: Backend / WebSockets
* **File**: [`backend/src/index.ts:43,49`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/index.ts#L43-L49)
* **Current Behavior**: Emits both `anomaly:detected` and `anomaly:alert`.
* **Expected Behavior**: Single canonical event `anomaly:detected`.
* **Impact**: Redundant serialization and broadcast overhead.
* **Recommended Solution**: Remove redundant `AnomalyService.onAnomaly` listener in `index.ts`.
* **Dependencies**: None.

---

## 18. Low Priority Issues

### Issue BE-004: Incomplete Attitude Parameter Thresholds in Rule Engine
* **ID**: `BE-004`
* **Severity**: `LOW`
* **Area**: Backend / Anomaly Detection
* **File**: [`backend/src/modules/anomalies/ruleEngine.ts:23-88`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/anomalies/ruleEngine.ts#L23-L88)
* **Current Behavior**: `roll`, `pitch`, and `yaw` are not present in `PARAMETER_THRESHOLDS`.
* **Expected Behavior**: Attitude limits (e.g. $\pm 180^\circ$, max slew rates) should be configured.
* **Impact**: Attitude anomalies are only caught by 3-Sigma or ML, never by the Rule Engine.
* **Recommended Solution**: Add attitude parameter boundaries to `PARAMETER_THRESHOLDS`.
* **Dependencies**: None.

---

## 19. Recommended Next Steps

1. **DO NOT MODIFY CODE YET**: Conclude Phase 1 audit review.
2. **Review & Sign Off**: Verify all findings in [`docs/PHASE_1_AUDIT.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/PHASE_1_AUDIT.md) and [`docs/DATABASE_AUDIT.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/DATABASE_AUDIT.md).
3. **Execute Phase 2 (Backend Persistence)**: Connect Mongoose to MongoDB, create schemas for Telemetry, Satellite, Anomaly, Evidence, and Assessment, and implement persistent repositories while preserving in-memory ring buffers for real-time streaming.

---

## 20. Phase 1 Exit Criteria

| Exit Criterion | Status | Verification Evidence |
| :--- | :---: | :--- |
| **All existing features documented without modification** |  **PASSED** | 12 comprehensive audit documents created in `docs/` |
| **Complete REST API inventory created** |  **PASSED** | [`docs/API_INVENTORY.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/API_INVENTORY.md) (15 endpoints) |
| **Complete WebSocket contract documented** |  **PASSED** | [`docs/WEBSOCKET_CONTRACT.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/WEBSOCKET_CONTRACT.md) |
| **Database & persistence status audited** |  **PASSED** | [`docs/DATABASE_AUDIT.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/DATABASE_AUDIT.md) (100% in-memory confirmed) |
| **External integrations verified live** |  **PASSED** | [`docs/EXTERNAL_INTEGRATIONS.md`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/docs/EXTERNAL_INTEGRATIONS.md) (NOAA, DONKI, SatNOGS, Gemini) |
| **Backend Jest test suite passing** |  **PASSED** | **10 / 10 passed** in 25.3s |
| **Python Pytest test suite passing** |  **PASSED** | **12 / 12 passed** in 28.7s |
| **Frontend production build passing** |  **PASSED** | `tsc -b && vite build` passed (636 modules, 2.87s) |
| **Zero source code modified during audit** |  **PASSED** | Only files in `docs/` created |

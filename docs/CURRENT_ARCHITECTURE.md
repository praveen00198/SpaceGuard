# SpaceGuard AI — Current Implemented Architecture

## 1. System Topology (Actual vs Target)

```
                            [ Web Browser ]
                                   │
                     HTTP / REST   │   Socket.IO (WebSocket)
                     Port 3000     │   Port 3000
                                   ▼
             ┌──────────────────────────────────────────────┐
             │       Node.js Express + Socket.IO Server      │
             │               (backend/src/)                 │
             │                                              │
             │  • Middleware: CORS, Request Logger, Error    │
             │  • REST Routes (15 endpoints)                │
             │  • In-Memory Ring Buffer (10k/spacecraft)     │
             │  • In-Memory Maps (Satellites, Anomalies,     │
             │    Evidence, AI Assessments, Scenarios)      │
             │  • Hybrid Anomaly Engine (Rules + Stats)     │
             │  • Deterministic Health Evaluator            │
             │  • Socket.IO Broadcaster (Rooms + Global)    │
             └─────────────┬──────────────────┬─────────────┘
                           │                  │
            HTTP POST      │                  │  HTTP GET / REST
            Port 8000      │                  │  (External APIs)
                           ▼                  ▼
             ┌───────────────────┐    ┌─────────────────────┐
             │ Python ML Service │    │ External Providers  │
             │ (FastAPI + Sklearn│    │                     │
             │  IsolationForest) │    │ • NOAA SWPC (Live)  │
             └───────────────────┘    │ • NASA DONKI (Auth) │
                                      │ • SatNOGS DB (Auth) │
                                      │ • Google Gemini     │
                                      │   (gemini-3.8-flash)│
                                      └─────────────────────┘
```

## 2. Component Decomposition

### 2.1 Backend (`backend/src/`)
- **Server Entrypoint (`server.ts`)**: Initializes HTTP server, attaches Socket.IO, binds port 3000. Graceful shutdown hooks registered for `SIGTERM` and `SIGINT`.
- **Telemetry Pipeline (`modules/telemetry/`)**:
  - `normalizer.ts`: Validates raw incoming payloads, converts to SI units, attaches metadata and quality tags (`GOOD`, `DEGRADED`, `CORRUPTED`, `MISSING`).
  - `telemetryService.ts`: In-memory ring buffer (capacity: 10,000 points per satellite). Fast time-series slicing (`getHistory()`, `getLatest()`). **No database persistence yet**.
- **Anomaly Detection Subsystem (`modules/anomalies/`)**:
  - `ruleEngine.ts`: Deterministic boundary checks (min/max thresholds, rate-of-change, flatline detection).
  - `statisticalEngine.ts`: Rolling 30-sample window; calculates mean, variance, rolling Z-score. Flags $|Z| \ge 3.0$ as statistical anomaly.
  - `anomalyService.ts`: Hybrid orchestrator. Merges rule, statistical, and ML signals. Computes composite `anomalyScore`, assigns severity (`low`, `medium`, `high`, `critical`), triggers evidence generation, emits WebSocket alerts.
- **Spacecraft Health Subsystem (`modules/health/`)**:
  - `healthService.ts`: Deterministic weighted subsystem health calculation:
    - Power: 30%
    - Thermal: 25%
    - Communication: 20%
    - Attitude: 15%
    - Payload: 10%
  - Deducts health points based on active anomaly severity and sensor quality degradation.
- **Evidence Management (`modules/evidence/`)**:
  - `evidenceService.ts`: Assigns immutable `EVID-<timestamp>-<rand>` identifiers. Stores structured evidence packages in memory.
- **Gemini Reasoning Subsystem (`modules/gemini/`)**:
  - `geminiService.ts`: Packages evidence into a prompt with JSON schema constraints. Invokes `gemini-3.8-flash`. Extracts structured physical interpretations, knowns, unknowns, cannot-determines, and investigation recommendations.
- **Simulation Engine (`modules/simulation/`)**:
  - `simulationService.ts`: 1 Hz timer. Supports 7 scenarios: Nominal, Thermal Spike, Thermal Drift, Battery Degradation, Sensor Flatline, Comm Degradation, Compound Fault. Ingests simulated frames directly into `telemetryService` and the anomaly pipeline.
- **Space Weather Provider (`modules/space-weather/`)**:
  - `spaceWeatherService.ts`: Fetches Kp index and geomagnetic storm scales from NOAA SWPC. 5-minute memory cache. Falls back to static snapshot on network failure.

### 2.2 Frontend (`frontend/src/`)
- **Framework & Tooling**: React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons, Socket.IO Client.
- **State Architecture**:
  - Global real-time state: React context / Socket.IO subscription in `App.tsx` and custom hooks.
  - Page-level server state: Polling intervals (1.5s - 4.0s) via `fetch` inside `useEffect`.
  - Visualization: Recharts real-time line charts, nominal bands, status badges, satellite cards.

### 2.3 Machine Learning Service (`ml-service/app/`)
- **Framework**: Python 3.11+, FastAPI, Uvicorn, scikit-learn, NumPy, Pandas.
- **Inference Pipeline**:
  - Trained `IsolationForest` models stored per subsystem/feature.
  - Analytical kernel density estimation (KDE) fallback if model artifact is missing.
  - Exposes `POST /api/ml/score` returning normalized anomaly probability [0.0, 1.0].

---

## 3. Data Persistence Status (Reality Check)

| Subsystem | Storage Mechanism | Durability | Restart Behavior |
|-----------|-------------------|------------|------------------|
| Telemetry | In-Memory Ring Buffer | Ephemeral (max 10k/craft) | 100% Data Loss |
| Satellites | In-Memory Map (Hardcoded Seed) | Ephemeral | Reverts to 3 default seeds |
| Anomalies | In-Memory Map | Ephemeral | 100% Data Loss |
| Evidence | In-Memory Map | Ephemeral | 100% Data Loss |
| AI Assessments | In-Memory Map | Ephemeral | 100% Data Loss |
| Space Weather | In-Memory Object + Cache | Ephemeral (5 min TTL) | Refetched on startup |
| Simulations | In-Memory State | Ephemeral | Cancelled on restart |

---

## 4. Key Strengths of Current Implementation
1. **Clean Modular Structure**: Code follows clear separation of concerns into distinct business modules.
2. **Evidence-Grounded AI**: Gemini does not invent telemetry; it acts strictly as an analytical reasoning engine over generated evidence tokens (`EVID-*`).
3. **Deterministic Core**: Anomaly rules and health calculations are strictly deterministic and mathematically verifiable.
4. **Resilient Fallbacks**: NOAA SWPC and ML services degrade gracefully to local fallbacks without throwing unhandled exceptions.

---

## 5. Primary Architectural Gaps
1. **Zero Database Persistence**: MongoDB is listed in `package.json` but has 0 active connections or Mongoose schemas.
2. **Dual Real-time Pattern**: Frontend mixes WebSocket event subscriptions with heavy REST polling intervals (every 1.5s - 4s).
3. **Hardcoded Localhost & WebSocket URL**: Frontend defaults to relative `/` paths which fail in cross-origin production deployments (e.g. Vercel $\rightarrow$ Render).

# SpaceGuard AI — Phase 3 Implementation Report
# Frontend + Realtime Architecture Hardening

> **Status**: COMPLETE  
> **Date**: 2026-09-26  
> **Target Services**: `frontend/` (React 19 + TypeScript + Vite + Tailwind CSS), `backend/` (Node.js + Socket.IO 4.8)

---

## 1. Objective

The objective of Phase 3 was to harden the communication architecture between the React frontend and the MongoDB-backed persistent backend. This required eliminating fragile same-origin assumptions (`io('/')`), removing redundant HTTP polling intervals (1.5s–4.0s) across all views, centralizing Socket.IO connection and lifecycle management, establishing bounded client-side buffers with deduplication, handling reconnection gaps via state resynchronization, and preparing the frontend for split production deployment (e.g. Vercel $\rightarrow$ Render/Railway) without modifying ML models, Gemini reasoning, or database schemas.

---

## 2. Previous Realtime Architecture

In the Phase 1 audit and Phase 2 baseline:
1. **Same-Origin Assumption**: The frontend initialized Socket.IO with `io('/')`, assuming the backend was always co-located behind a local Vite development proxy.
2. **Aggressive REST Polling**:
   - `DashboardPage.tsx`: Polled 5 REST endpoints every 3000ms (`/api/satellites`, `/api/health`, `/api/anomalies`, `/api/space-weather/current`, `/api/simulation/status`).
   - `AnomalyCenterPage.tsx`: Polled `/api/anomalies` every 3000ms.
   - `SimulationPage.tsx`: Polled `/api/simulation/status` every 1500ms.
   - `App.tsx`: Polled `/api/anomalies?status=active` every 4000ms solely for the navigation bar badge.
3. **Double Socket Delivery**: The backend emitted `telemetry:reading` and `anomaly:detected` globally via `io.emit(...)` and simultaneously via `io.to('telemetry:' + id).emit(...)`, delivering duplicate packets to room subscribers.
4. **No Reconnection Resynchronization**: Disconnections left unrecoverable gaps in displayed telemetry and missed anomaly alerts.
5. **Static Connection UI**: The navbar hardcoded "TELEMETRY LINK LIVE" regardless of actual network or socket connectivity.

---

## 3. New Realtime Architecture

Phase 3 established a clean, decoupled **REST + Socket.IO** architecture:

```
                  FRONTEND (React 19 + Vite)
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
     REST Client                             Socket.IO
   (services/api.ts)                    (services/socket.ts)
          │                                       │
  • Initial Snapshot                      • Live Telemetry Stream
  • Historical Range Queries              • Anomaly Alerts
  • State Resync on Reconnect             • Simulation State Broadcasts
  • Command Triggers (Start/Stop)                 │
          │                                       │
          └───────────────────┬───────────────────┘
                              ↓
              Bounded Client Buffers & Deduplication
                              ↓
                     React Presentation State
                              ↓
                         Dashboard UI
```

---

## 4. REST Responsibilities

The REST API is exclusively responsible for:
- **Initial State Loading**: Fetching baseline spacecraft metadata (`/api/satellites`), initial constellation health (`/api/health`), latest anomalies (`/api/anomalies?limit=5`), and NOAA space weather (`/api/space-weather/current`).
- **Bounded Historical Queries**: Fetching bounded telemetry slices (`/api/telemetry?satelliteId=...&limit=120`) on page load and spacecraft switching.
- **State Resynchronization**: Backfilling telemetry readings and anomaly lists missed during a network disconnection or reconnect event.
- **Operator Commands**: Mutating anomaly investigation statuses (`PATCH /api/anomalies/:id/status`) and initiating/halting simulations (`POST /api/simulation/start`, `POST /api/simulation/stop`).

---

## 5. Socket.IO Responsibilities

The WebSocket layer is exclusively responsible for:
- **Live Telemetry Downlink**: Streaming real-time telemetry readings (`telemetry:reading`) at ~1 Hz per parameter.
- **Immediate Anomaly Alerts**: Pushing detected anomalies (`anomaly:detected`) across rule, statistical, and ML engines without delay.
- **Simulation Lifecycle Events**: Broadcasting simulation status transitions (`simulation:status`) to keep all open tabs synchronized.
- **Connection Health Tracking**: Emitting connection lifecycle transitions (`connect`, `disconnect`, `connect_error`, `reconnect_attempt`, `reconnect`) to drive UI indicators.

---

## 6. VITE_API_URL

- Centralized in `frontend/src/services/api.ts`.
- In local development: Defaults to empty string `''`, enabling the Vite reverse proxy to forward `/api/*` to `http://localhost:3001`.
- In split production: Reads `import.meta.env.VITE_API_URL` (e.g. `https://api.spaceguard.example.com`).
- Added to `.env.example` and `frontend/.env.example`.

---

## 7. VITE_WS_URL

- Centralized in `frontend/src/services/socket.ts` through `getWebSocketUrl()`.
- In local development: Defaults to `window.location.origin` (proxied by Vite to `http://localhost:3001`).
- In split production: Reads `import.meta.env.VITE_WS_URL` (e.g. `https://api.spaceguard.example.com` or `wss://...`).
- Added to `.env.example` and `frontend/.env.example`.

---

## 8. Socket Lifecycle

Managed centrally via singleton `getSocket()` in `frontend/src/services/socket.ts`:
- **States**: `type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected'`
- **Hook**: `useRealtimeStatus()` in `frontend/src/hooks/useRealtimeStatus.ts` provides reactive status to UI components.
- **Status Indicator**: `Navbar.tsx` dynamically displays:
  - `connected`: Emerald indicator + "TELEMETRY LINK LIVE"
  - `reconnecting`: Amber pulsing indicator + "LINK RECONNECTING..."
  - `connecting`: Cyan pulsing indicator + "LINK CONNECTING..."
  - `disconnected`: Rose indicator + "TELEMETRY LINK OFFLINE"

---

## 9. Reconnection Behavior

- Configured using native Socket.IO Manager options:
  - `reconnection: true`
  - `reconnectionAttempts: Infinity`
  - `reconnectionDelay: 1000`
  - `reconnectionDelayMax: 5000`
  - `timeout: 10000`
- No recursive `setInterval` loops or duplicate retry timers.

---

## 10. State Resynchronization

- `onReconnect(callback)` event bus registered in `frontend/src/services/socket.ts`.
- When Socket.IO fires `reconnect`:
  - `App.tsx`: Resynchronizes active anomaly counter.
  - `DashboardPage.tsx`: Refetches fleet health and recent anomalies.
  - `TelemetryPage.tsx`: Refetches bounded historical telemetry for the selected satellite and merges with current state without duplicates.
  - `AnomalyCenterPage.tsx`: Refetches active anomalies list.
  - `SimulationPage.tsx`: Refetches current simulation status.

---

## 11. Polling Removed

All periodic HTTP polling loops in the frontend have been completely eliminated:
1. **`App.tsx:20`**: Removed `setInterval(updateCount, 4000)`. Replaced by initial REST load + `subscribeToAnomalies` listener.
2. **`DashboardPage.tsx:37`**: Removed `setInterval(fetchData, 3000)`. Replaced by initial REST load + live Socket.IO stream.
3. **`AnomalyCenterPage.tsx:22`**: Removed `setInterval(fetchAnomalies, 3000)`. Replaced by initial REST load + `subscribeToAnomalies` listener.
4. **`SimulationPage.tsx:32`**: Removed `setInterval(fetchStatus, 1500)`. Replaced by initial REST load + `subscribeToSimulationStatus` and live telemetry tick incrementer.

---

## 12. Polling Intentionally Retained

Only one `setInterval` remains in `frontend/src`:
- **Location**: `frontend/src/components/Navbar.tsx:19`
- **Interval**: 1000ms
- **Purpose**: Local Mission Elapsed Time (UTC) clock display (`setUtcTime(now.toUTCString())`).
- **Rationale**: Pure local UI timer. Does not make network or API requests.

**Explicit Statement**: No unexplained periodic API polling remains in the codebase.

---

## 13. Telemetry Client Buffering

- Enforced in `frontend/src/pages/TelemetryPage.tsx`:
  - `MAX_CHART_POINTS = 60` points per subsystem parameter.
  - As new packets arrive over Socket.IO, `updated.shift()` maintains a strict 60-point bounded window.
  - Deduplication via `getTelemetryReadingKey(reading)`: `${satelliteId}:${parameter}:${timestamp}`. Duplicate packets (e.g. from network retries or overlapping REST history) are discarded before updating state.
  - Browser memory consumption remains flat regardless of session duration.

---

## 14. Anomaly State Handling

- Enforced in `frontend/src/pages/AnomalyCenterPage.tsx` and `DashboardPage.tsx`:
  - `MAX_ANOMALIES_STORED = 100` records in memory.
  - Incoming anomalies from `anomaly:detected` are prepended only if `anomalyId` is not already present.
  - Status updates (`handleUpdateStatus`) apply optimistically/locally to in-memory state without refetching the full table, preventing filter resets or modal disruptions.

---

## 15. Error & Loading States

- Handled gracefully across all views:
  - **REST API Unavailable**: Explicit error banner with a "Retry" button. Existing cached data remains viewable.
  - **Socket.IO Disconnected**: Navbar displays "TELEMETRY LINK OFFLINE", informing the operator that data is no longer live without destroying existing charts.
  - **Empty States**: Clear operational messages ("All subsystems operating within nominal envelopes" / "No anomalies matching selected filters").

---

## 16. Testing

### Jest Backend Tests
- **Command**: `npm test` in `backend/`
- **Result**: 7/7 test suites passed, 28/28 tests passed (including MongoDB repository and graceful restart acceptance tests).

### Python ML & Synthetic Telemetry Tests
- **Command**: `python -m pytest tests/integration`
- **Result**: 12/12 passed in 18.71s.

### Frontend Realtime Architecture Tests
- **Command**: `npx tsx tests/frontend-realtime.test.ts`
- **Result**: 6/6 test suites passed:
  1. Telemetry reading key generation & deduplication
  2. Bounded telemetry buffer & deduplication merge
  3. Anomaly deduplication and bounded buffer
  4. Connection status state machine transitions
  5. Reconnection resync event bus handlers
  6. Environment URL resolution and fallback

### Production Build
- **Command**: `npm run build` in `frontend/`
- **Result**: `tsc -b && vite build` passed cleanly with 0 TypeScript errors.

---

## 17. End-to-End Verification

Performed live using the browser subagent interacting with the backend and frontend:
1. **Dashboard Load**: Successfully loaded satellites SG-1, SG-2, SG-3 and constellation health via REST. Connection status showed `TELEMETRY LINK LIVE` with emerald pulsing dot.
2. **Simulation Trigger**: Triggered `Thermal Spike` scenario on SG-1. Status updated immediately to `THERMAL-SPIKE` with `STREAMING PACKETS`.
3. **Live Socket Telemetry**: Ingested tick counter incremented live over Socket.IO without page polling (165 $\rightarrow$ 275 $\rightarrow$ 1000+ packets).
4. **Telemetry Explorer**: Live temperature values spiked to `59.72 °C` on SG-1 charts with no duplicate points or chart glitches.
5. **Anomaly Center**: Sequential, non-duplicating anomalies (`ANOM-SG-1-00790`, `ANOM-SG-1-00789`) appeared dynamically in the feed with correct severities, scores, and investigation triggers.
6. **Simulation Stop**: Stopped simulation; status cleanly reverted to `STANDBY / IDLE` with badge `STOPPED`.

---

## 18. Known Limitations

- Gemini AI calls in development require a valid `GEMINI_API_KEY` with available quota. When quota is exceeded or offline, the system safely falls back to deterministic rule reasoning.
- Recharts re-renders on new data points; while bounded to 60 points per parameter, future optimization in Phase 5 could leverage canvas-based rendering for multi-hundred Hz streams.

---

## 19. Deferred Work

The following items are intentionally deferred to future phases per the project boundaries:
- **Phase 4**: External data integrations (NOAA SWPC live polling, NASA DONKI, SatNOGS DB).
- **Phase 5**: Authentication, RBAC, rate-limiting hardening.
- **Phase 6**: Production deployment scripts (Docker compose, Vercel/Render manifests).
- **Phase 7**: Advanced ML residual-based fault diagnosis.

# SpaceGuard AI — WebSocket Contract & Event Architecture

> Audit Baseline: Phase 1 Audit
> Implementation: Socket.IO 4.8 (Server: Node.js, Client: React 19)

---

## 1. Socket.IO Configuration

* **Server Initialization**: [`backend/src/index.ts:30-36`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/index.ts#L30-L36)
* **Client Initialization**: [`frontend/src/services/socket.ts:6-14`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/frontend/src/services/socket.ts#L6-L14)
* **Transport Modes**: `['websocket', 'polling']`
* **Default Path**: `/socket.io/`

---

## 2. Event Inventory

| Event Name | Direction | Producer | Consumer | Payload Schema | Frequency | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `subscribe:telemetry` | Client → Server | `socket.ts` | `backend/src/index.ts:128` | `{ satelliteId: string }` | On view mount | Joins client to satellite room `telemetry:${satelliteId}` |
| `unsubscribe:telemetry`| Client → Server | `socket.ts` | `backend/src/index.ts:135` | `{ satelliteId: string }` | On view unmount | Leaves satellite room `telemetry:${satelliteId}` |
| `telemetry:reading` | Server → Client | `TelemetryService.onTelemetry` | `TelemetryPage.tsx`, `SimulationPage.tsx` | `ITelemetryReading` | ~1 Hz per parameter | Streams normalized telemetry packets (single broadcast) |
| `anomaly:detected` | Server → Client | `TelemetryService.onTelemetry` | `DashboardPage.tsx`, `AnomalyCenterPage.tsx`, `App.tsx` | `IAnomaly` | Event-driven (on anomaly) | Broadcasts anomaly detection alert |
| `anomaly:alert` | Server → Client | `AnomalyService.onAnomaly` | *(Legacy compatibility)* | `IAnomaly` | Event-driven (on anomaly) | Legacy alert event |
| `simulation:status` | Server → Client | `SimulationService.onStatusChange` | `DashboardPage.tsx`, `SimulationPage.tsx` | `{ isRunning: boolean; currentScenario: string; targetSatelliteId: string; ticksGenerated: number }` | On sim start/stop | Broadcasts simulation state updates in real-time |

---

## 3. Detailed Event Payloads

### `subscribe:telemetry`
```json
{
  "satelliteId": "SG-1"
}
```

### `telemetry:reading`
```json
{
  "satelliteId": "SG-1",
  "parameter": "temperature",
  "timestamp": "2026-09-26T12:00:01.000Z",
  "value": 22.45,
  "unit": "C",
  "subsystem": "thermal",
  "source": "simulator",
  "quality": "valid",
  "ingestedAt": "2026-09-26T12:00:01.050Z"
}
```

### `anomaly:detected`
```json
{
  "anomalyId": "ANOM-SG-1-00001",
  "satelliteId": "SG-1",
  "detectedAt": "2026-09-26T12:00:03.000Z",
  "detectionMethod": "rule",
  "anomalyScore": 0.95,
  "severity": "critical",
  "parameter": "temperature",
  "subsystem": "thermal",
  "value": 68.4,
  "baseline": 22.0,
  "unit": "C",
  "anomalyType": "threshold",
  "evidenceIds": ["EVID-TEL-00001", "EVID-ANO-00002"],
  "status": "active",
  "description": "Rule: CRITICAL_RANGE_BREACH triggered",
  "createdAt": "2026-09-26T12:00:03.050Z",
  "updatedAt": "2026-09-26T12:00:03.050Z"
}
```

### `simulation:status`
```json
{
  "isRunning": true,
  "currentScenario": "thermal-spike",
  "targetSatelliteId": "SG-1",
  "ticksGenerated": 42
}
```

---

## 4. Phase 3 Hardening & Audit Resolutions

### Dual Anomaly Emission (BE-WS-001) — RESOLVED in Phase 3
* **Resolution**: TelemetryService emits `anomaly:detected` once to `io.emit(...)`. Redundant duplicate emission to `io.to(...)` was removed.

### Global vs Room Broadcasts (BE-WS-002) — RESOLVED in Phase 3
* **Resolution**: Single global broadcast `io.emit('telemetry:reading', reading)` ensures all connected clients and tabs receive each reading exactly once without duplicate room-delivery multiplication. Frontend handles client-side parameter and satellite filtering alongside identity-based deduplication (`satelliteId:parameter:timestamp`).

### Cross-Origin Production Connection (FE-WS-001) — RESOLVED in Phase 3
* **Resolution**: Replaced hardcoded `io('/')` with `getWebSocketUrl()` reading `import.meta.env.VITE_WS_URL || window.location.origin`. Production split deployments (Vercel frontend + Render backend) can configure `VITE_WS_URL=https://api.spaceguard.io`.

### Reconnect State Synchronization — ADDED in Phase 3
* **Resolution**: Added `onReconnect(callback)` event bus on client Socket.IO singleton. On reconnection, Dashboard, Telemetry Explorer, and Anomaly Command Center query bounded REST snapshots to reconcile any missed readings during network disconnections.

---

## 5. Phase 5 Realtime Security & Abuse Controls

To prevent denial-of-service and arbitrary room subscription attacks, Socket.IO enforces:
1. **Origin Verification**: Client handshake origin must match allowed CORS origins (`CORS_ALLOWED_ORIGINS`).
2. **Satellite ID Validation**: Every `subscribe:telemetry` and `unsubscribe:telemetry` payload must match `/^[A-Za-z0-9_-]{1,32}$/`.
3. **Room Cap**: Each socket connection can subscribe to a maximum of **10 satellite rooms** concurrently. Excess subscription requests are rejected with an error event.
4. **Connection Cap**: A maximum of **25 concurrent Socket.IO connections** per client IP is enforced.
5. **Disconnect Cleanup**: Sockets automatically leave all joined rooms and clean up event listeners upon disconnection.

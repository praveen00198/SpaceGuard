# SpaceGuard AI — Frontend Architecture Audit

> Audit Baseline: Phase 1 Audit
> Stack: React 19, TypeScript 5.7+, Vite 8, Tailwind CSS 4, Recharts 3.10, Socket.IO Client 4.8

---

## 1. Actual vs Target Architecture Comparison

### Target Reference Structure (Section 33):
```
frontend/src/
├── components/ (ui/, charts/, telemetry/, anomalies/, satellites/, common/)
├── pages/      (Dashboard/, Satellites/, Telemetry/, Anomalies/, Investigation/, Simulation/)
├── features/   (satellites/, telemetry/, health/, anomalies/, evidence/, spaceWeather/, ai/)
├── services/
├── hooks/
├── stores/
├── types/
└── utils/
```

### Actual Codebase Structure Found:
```
frontend/src/
├── components/
│   ├── InvestigationModal.tsx  (194 lines — comprehensive AI assessment view)
│   ├── Navbar.tsx              (78 lines — mission clock & navigation)
│   ├── StatusBadge.tsx         (30 lines — aerospace status pill)
│   └── TelemetryChart.tsx      (93 lines — Recharts line chart)
├── pages/
│   ├── AnomalyCenterPage.tsx   (183 lines — filterable anomaly log & actions)
│   ├── DashboardPage.tsx       (235 lines — fleet health & simulation quick-controls)
│   ├── SimulationPage.tsx      (198 lines — interactive fault injection lab)
│   └── TelemetryPage.tsx       (187 lines — multi-subsystem chart explorer)
├── services/
│   ├── api.ts                  (174 lines — centralized fetch API client)
│   └── socket.ts               (39 lines — Socket.IO client singleton)
├── types/
│   └── index.ts                (128 lines — canonical TypeScript interfaces)
├── App.tsx                     (47 lines — BrowserRouter layout & active anomaly polling)
├── index.css                   (48 lines — design tokens & scrollbars)
└── main.tsx                    (10 lines — React root mounting)
```

### Gap Analysis:
* **Current State**: The frontend is cohesive, clean, and avoids micro-file fragmentation. Components are focused and well-scoped (< 250 lines each).
* **Missing Target Directories**: No `features/`, `hooks/`, `stores/`, or `utils/` directories exist yet. State is handled locally via React `useState` and `useEffect`.
### Phase 3 Architecture Evolution:
* **Added Directories**: `frontend/src/hooks/` was created with `useRealtimeStatus.ts` providing reactive connection status.
* **Services Hardened**:
  * `services/api.ts`: Centralized with `VITE_API_URL` support and `apiUrl()` resolver.
  * `services/socket.ts`: Expanded to support `VITE_WS_URL`, full Socket.IO connection status lifecycle, `onReconnect` resync event bus, and deduplication keys.
* **State Management**:
  * Replaced all redundant HTTP polling loops (`App.tsx`, `DashboardPage.tsx`, `AnomalyCenterPage.tsx`, `SimulationPage.tsx`) with REST initial snapshot + Socket.IO live stream.
  * Reconnection synchronization backfills missed state over REST upon socket reconnect.
  * Chart data bounded to 60 points with identity-based deduplication (`satelliteId:parameter:timestamp`).

---

## 2. Component Audit & Responsibilities

| Component | Responsibility | Props / State | Strengths | Fragilities / Opportunities |
| :--- | :--- | :--- | :--- | :--- |
| **`Navbar`** | Header navigation, UTC clock ticker, live link indicator | Props: `activeAnomalyCount` | Independent 1s UTC clock ticker | Polling count passed from parent |
| **`StatusBadge`** | Aerospace color-coded pill (nominal, warning, critical, low, medium, high) | Props: `status`, `size` | Reusable across anomalies, health, and satellites | Pulse animation on critical |
| **`TelemetryChart`** | Time-series chart with reference lines and tooltips | Props: `parameter`, `unit`, `data`, `nominalMin`, `nominalMax` | Clean Recharts integration, auto-scales, nominal boundary overlay | Fixed height, re-renders on every data point |
| **`InvestigationModal`** | Deep AI diagnostic review, citation badges, epistemological separation | Props: `anomaly`, `onClose` | Formats knowns, unknowns, cannot determine cleanly | Calls `api.generateAssessment` on mount if not cached |
| **`DashboardPage`** | Constellation overview, satellite cards, active anomalies, weather widget | Local State | Multi-dimensional overview, quick fault injection | High polling frequency (5 requests every 3s) |
| **`TelemetryPage`** | Subsystem filtering and multi-parameter live chart grids | Local State | Subscribes cleanly to WebSocket streaming | Buffer limited to 60 points in UI state |
| **`AnomalyCenterPage`** | Filterable anomaly registry and status workflow | Local State | Severity, detector, and status filters | Re-polls every 3s to update status changes |
| **`SimulationPage`** | Fault injection scenarios catalog and execution control deck | Local State | Clear scenario cards and real-time status banner | Polling interval is 1500ms |

---

## 3. TypeScript & Type Safety Audit

* **`any` Usage**: **0 occurrences** in `frontend/src`. Strong typing is enforced throughout.
* **Imports**: Strict adherence to TypeScript `verbatimModuleSyntax` with `import type { ... }`.
* **Type Contract Consistency**:
  * Frontend interfaces in `frontend/src/types/index.ts` strictly match backend JSON schemas.
  * Date fields are typed as `string` in the frontend (matching JSON serialized dates) and parsed with `new Date(d.timestamp)`.

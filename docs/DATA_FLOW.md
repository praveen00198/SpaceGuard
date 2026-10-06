# SpaceGuard AI — Real-World Data Flow Audit

> Audit Baseline: Phase 1 Audit
> Analysis: End-to-end tracing of Workflows A, B, C, and D through actual source code.

---

## Workflow A — Normal Telemetry Ingestion Flow

```
[Simulation Ticker / External Source]
       │ (raw packet: satelliteId, parameter, value, timestamp)
       ▼
TelemetryNormalizer.normalize()
       │ (verifies parameter mapping, assigns canonical SI unit, tags DataQuality)
       ▼
TelemetryService.ingestReading()
       │
       ├──▶ In-Memory Ring Buffer (`readingsStore.get(satId).push(reading)`)
       ├──▶ Latest Parameter Cache (`latestReadingsCache.set(...)`)
       │
       ▼
AnomalyService.processReading()
       │ (Evaluates Rule, Statistical, and ML engines)
       ▼
[No anomaly detected] (returns null)
       │
       ▼
Socket.IO Broadcast
       │ (io.emit('telemetry:reading', reading))
       ▼
Frontend TelemetryPage / Recharts
       (Appends to chart buffer, renders live value ticker)
```

### Real Implementation Nuances:
1. **Health Calculation is NOT automatically triggered on ingestion**:
   * As seen in [`telemetryService.ts:25-60`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/telemetry/telemetryService.ts#L25-L60), health is **NOT** re-calculated or pushed when normal telemetry arrives.
   * Instead, the frontend polls `/api/health` every 3 seconds, which then triggers `HealthService.computeHealth()`.
2. **Quality Tag Assignment**:
   * If `value` is `NaN`, normalizer tags quality as `'missing'`; otherwise `'valid'`.

---

## Workflow B — Anomaly Detection Pipeline

```
ITelemetryReading
       │
       ├──▶ 1. RuleEngine.evaluate(reading)
       │       - Checks critical thresholds (e.g. temp > 60°C)
       │       - Checks nominal thresholds (e.g. temp > 45°C)
       │       - Checks rate-of-change (e.g. Δ > 0.5°C/s)
       │       - Checks sticky sensor flatlines (10 consecutive identical non-zero ticks)
       │
       ├──▶ 2. StatisticalEngine.evaluate(reading)
       │       - Updates rolling 30-sample buffer
       │       - Computes mean and standard deviation
       │       - Computes Z-score = |val - mean| / std
       │       - Flags anomaly if |Z| >= 3.0
       │
       └──▶ 3. MLEngine.evaluate(reading)
               - HTTP POST to FastAPI `/api/predict` (1200ms timeout)
               - IsolationForest inference per parameter
               - Returns is_anomaly and normalized score
       │
       ▼
Hybrid Anomaly Orchestrator (`AnomalyService.processReading`)
       │
       ├── Combines methods: 'rule', 'statistical', 'ml', or 'hybrid'
       ├── Calculates composite anomalyScore: min(1.0, maxScore * 0.7 + avgScore * 0.3)
       ├── Assigns operational severity: 'critical' | 'high' | 'medium' | 'low'
       │
       ▼
Evidence Generation (`EvidenceService.createEvidence`)
       │
       ├── Primary telemetry evidence: EVID-TEL-xxxxx (value vs baseline)
       ├── Engine trigger evidence: EVID-ANO-xxxxx (specific rule/stat/ML evidence)
       │
       ▼
Storage & Notifications
       │
       ├── Saved in `anomaliesStore` Map
       ├── Notifies listeners (calls `io.emit('anomaly:detected', anomaly)`)
       └── Emits duplicate `io.emit('anomaly:alert', anomaly)`
```

---

## Workflow C — Evidence-Grounded AI Investigation Flow

```
Human Operator clicks "AI Investigate →" on Anomaly
       │
       ▼
Frontend: `api.generateAssessment(anomalyId)`
       │ HTTP POST `/api/assessments/generate/:anomalyId`
       ▼
Backend: `GeminiService.assessAnomaly(anomaly)`
       │
       ├── 1. Gathers context:
       │      - Anomaly record (parameter, observed value, baseline, severity, score)
       │      - Structured Evidence items via `EvidenceService.getEvidenceForIds(anomaly.evidenceIds)`
       │      - Spacecraft metadata via `SatelliteService.getSatelliteById(anomaly.satelliteId)`
       │      - Space Weather snapshot via `SpaceWeatherService.getSpaceWeather()`
       │
       ├── 2. Assembles Evidence Package Prompt:
       │      - List of valid `[EVID-...]` items
       │      - Instructions enforcing: "Every claim MUST cite valid evidence IDs"
       │
       ├── 3. API Execution:
       │      - If `GEMINI_API_KEY` present: Calls `gemini-3.8-flash:generateContent` with JSON schema
       │      - If absent or failed: Calls `generateFallbackAssessment()`
       │
       ├── 4. Response Schema:
       │      - priority
       │      - summary
       │      - evidenceClaims [{ claim, evidenceIds: ['EVID-...'] }]
       │      - interpretation (physical subsystem dynamics)
       │      - possibleCauses
       │      - known []
       │      - unknown []
       │      - cannotDetermine []
       │      - uncertainty
       │      - recommendedInvestigation []
       │
       ├── 5. Caches in `assessmentCache` Map
       │
       ▼
Frontend: `InvestigationModal.tsx`
       (Renders full investigation report with interactive evidence badges)
```

---

## Workflow D — Simulation & Fault Injection Flow

```
Operator selects scenario (e.g. 'thermal-spike') in Simulation Lab
       │
       ▼
POST `/api/simulation/start`
       │
       ▼
`SimulationService.start(scenarioId, satelliteId, intervalMs)`
       │
       ├── Clears any existing interval timer
       ├── Sets static isRunning = true, tickCount = 0
       ├── Starts 1.0 Hz `setInterval`
       │
       ▼
Every 1000ms: `generateTick()`
       │
       ├── Computes nominal base values with Gaussian noise
       ├── Injects scenario fault after tick 3:
       │     - 'thermal-spike': Temperature rises by +38°C
       │     - 'thermal-drift': Temperature climbs +0.8°C/tick
       │     - 'battery-degradation': Battery decays to 2.85V, current spikes to 3.8A
       │     - 'sensor-dropout': Roll sensor freezes at exact constant 15.42°
       │     - 'comm-degradation': Packet loss climbs to 25%, latency to 1250ms
       │     - 'multi-anomaly': Concurrent thermal spike and battery collapse
       │
       ├── Generates 11 parameter readings
       │
       ▼
Pushed into `TelemetryService.ingestReading()` (Same canonical pipeline!)
       │
       ▼
Executes Normalizer ➔ Buffer ➔ Anomaly Engine ➔ Evidence ➔ WebSockets
```

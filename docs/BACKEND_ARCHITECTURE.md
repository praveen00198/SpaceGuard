# SpaceGuard AI — Backend Architecture Audit

> Audit Baseline: Phase 1 Audit
> Stack: Node.js 22+, TypeScript 5.7+, Express 4.21, Socket.IO 4.8, Winston 3.17, Zod 3.24

---

## 1. Actual vs Target Architecture Comparison

### Target Architecture Reference (Section 34):
```
backend/src/
├── config/
├── middleware/
├── routes/
├── modules/ (satellites, telemetry, health, anomalies, space-weather, correlation, evidence, assessments, simulation)
├── ingestion/ (nasa, satnogs, celestrak, noaa)
├── repositories/
├── models/
├── websocket/
├── services/
└── utils/
```

### Actual Codebase Structure Found:
```
backend/src/
├── config/
│   └── index.ts                 (Environment config, dotenv priority loader)
├── middleware/
│   └── errorHandler.ts          (Centralized 500 & 404 handlers)
├── modules/
│   ├── anomalies/
│   │   ├── anomalyRoutes.ts     (GET /, GET /:id, PATCH /:id/status)
│   │   ├── anomalyService.ts    (Hybrid orchestrator, score synthesis)
│   │   ├── mlEngine.ts          (FastAPI HTTP client with degradation)
│   │   ├── ruleEngine.ts        (Thresholds, rate of change, flatline)
│   │   └── statisticalEngine.ts (3-sigma rolling Z-score engine)
│   ├── assessments/
│   │   ├── assessmentRoutes.ts  (GET /anomaly/:id, POST /generate/:id)
│   │   └── geminiService.ts     (Gemini API client & grounded fallback)
│   ├── correlation/             (Empty placeholder directory)
│   ├── evidence/
│   │   ├── evidenceRoutes.ts    (GET /, GET /:id)
│   │   └── evidenceService.ts   (Evidence generator & retrieval)
│   ├── health/
│   │   ├── healthRoutes.ts      (GET /, GET /:satelliteId)
│   │   └── healthService.ts     (Deterministic subsystem calculations)
│   ├── orbital/                 (Empty placeholder directory)
│   ├── satellites/
│   │   ├── satelliteRoutes.ts   (GET /, GET /:id, POST /)
│   │   ├── satelliteService.ts  (Pre-seeded satellites & in-memory store)
│   │   └── schemas.ts           (Zod validation schemas)
│   ├── simulation/
│   │   ├── simulationRoutes.ts  (GET /scenarios, GET /status, POST /start, POST /stop)
│   │   └── simulationService.ts (1.0 Hz fault injection ticker)
│   ├── space-weather/
│   │   ├── spaceWeatherRoutes.ts (GET /current)
│   │   └── spaceWeatherService.ts (NOAA SWPC live client & snapshot fallback)
│   └── telemetry/
│       ├── normalizer.ts        (Canonical parameter/unit normalizer)
│       ├── schemas.ts           (Zod ingestion & query schemas)
│       ├── telemetryRoutes.ts   (GET /, GET /latest/:id, GET /stats/:id, POST /ingest)
│       └── telemetryService.ts  (10k ring-buffer & event emitter)
├── shared/
│   ├── logger.ts                (Winston JSON-structured logger)
│   └── types.ts                 (Canonical TypeScript interfaces)
└── index.ts                     (Server bootstrap, Socket.IO, middleware mount)
```

---

## 2. Layer Responsibilities & Evaluation

### 1. Ingestion & Normalization Layer
* **Responsibility**: Validate raw incoming data and convert into `ITelemetryReading`.
* **Evaluation**: `TelemetryNormalizer` cleanly isolates unit conversions and subsystem mapping.
* **Missing**: Source-specific adapters for raw SatNOGS frames and CelesTrak GP orbital elements.

### 2. Detection & Health Layer
* **Responsibility**: Evaluate telemetry against operational rules, rolling statistics, and ML models; compute health scores.
* **Evaluation**:
  * Clean separation of concerns: Rule engine does not know about ML; statistical engine does not know about rules.
  * `AnomalyService` acts as the single hybrid orchestrator.
  * Health engine is strictly deterministic and mathematical.

### 3. Evidence & Reasoning Layer
* **Responsibility**: Assemble evidence packages and invoke grounded LLM reasoning.
* **Evaluation**:
  * Evidence is generated with unique IDs before Gemini is called.
  * Gemini receives evidence IDs in the prompt and must cite them.
  * Deterministic fallback guarantees system availability even during API outages.

### 4. Middleware & Cross-Cutting Concerns
* **Helmet**: Configured on [`index.ts:53`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/index.ts#L53) for HTTP security headers.
* **Morgan**: Morgan stream pipes HTTP access logs to Winston `logger.info()`.
* **Rate Limiting**: `express-rate-limit` (100 req / 15 min window) applied to `/api/`.
* **Winston**: JSON-structured logging with timestamp, service name, and log levels.

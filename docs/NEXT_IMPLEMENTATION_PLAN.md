# SpaceGuard AI — Prioritized Implementation Roadmap (Phases 2–9)

> Audit Baseline: Phase 1 Audit
> Execution Rule: Do NOT start implementing during Phase 1. This document defines the exact sequential roadmap for subsequent phases.

---

## Roadmap Overview

```
PHASE 2: Backend Persistence (MongoDB & Repositories)
    ↓
PHASE 3: API & Data Architecture Hardening
    ↓
PHASE 4: Real-time & External Context Integrations (DONKI, SatNOGS, CelesTrak)
    ↓
PHASE 5: Frontend Production Architecture & Optimization
    ↓
PHASE 6: Security, Process Lifecycle & Reliability
    ↓
PHASE 7: Production Cloud Deployment (Render + Vercel + Atlas)
    ↓
PHASE 8: End-to-End System Validation & Benchmarking
    ↓
PHASE 9: ML Enhancements & Multimodal Features
```

---

## Phase 2: Backend Persistence (MongoDB & Repositories)

* **Objective**: Replace volatile in-memory Maps with persistent MongoDB collections using Mongoose, while retaining in-memory caching for real-time performance.
* **Files Affected**:
  * `backend/src/config/database.ts` (new)
  * `backend/src/models/` (new Mongoose schemas for Telemetry, Satellite, Anomaly, Evidence, Assessment)
  * `backend/src/repositories/` (new data access layer)
  * `backend/src/modules/telemetry/telemetryService.ts`
  * `backend/src/modules/satellites/satelliteService.ts`
  * `backend/src/modules/anomalies/anomalyService.ts`
  * `backend/src/modules/evidence/evidenceService.ts`
  * `backend/src/modules/assessments/geminiService.ts`
  * `backend/src/index.ts` (DB connection lifecycle)
* **Dependencies**: MongoDB server (local / container / Atlas).
* **Risks**: High-frequency telemetry write latency. Must use bulk inserts and compound time-series indexes.
* **Tests Required**: Repository unit tests with `mongodb-memory-server` or mock database connection.
* **Definition of Done**: Data survives full backend server restart; time-series queries execute in < 50ms.

---

## Phase 3: API & Data Architecture Hardening

* **Objective**: Standardize pagination, remove duplicate Socket.IO emissions, and refine route parameter handling.
* **Files Affected**:
  * `backend/src/modules/telemetry/telemetryRoutes.ts` (cursor-based pagination)
  * `backend/src/modules/anomalies/anomalyRoutes.ts` (batch status updates)
  * `backend/src/index.ts` (unify `anomaly:detected` and `anomaly:alert`)
  * `frontend/src/services/api.ts` (add query cancellation & request timeouts)
* **Dependencies**: Phase 2 completed.
* **Risks**: Breaking API contracts if query parameter schemas are modified without updating frontend clients.
* **Tests Required**: Route integration tests for all REST endpoints.
* **Definition of Done**: All collection queries support pagination; duplicate Socket.IO events eliminated.

---

## Phase 4: Real-Time & External Context Integrations

* **Objective**: Implement active ingestion from NASA DONKI, SatNOGS DB, and CelesTrak GP/OMM data.
* **Files Affected**:
  * `backend/src/modules/space-weather/donkiService.ts` (new)
  * `backend/src/modules/orbital/orbitalService.ts` (new CelesTrak client)
  * `backend/src/modules/correlation/correlationEngine.ts` (new cross-event correlation)
  * `backend/src/modules/space-weather/spaceWeatherRoutes.ts`
* **Dependencies**: NASA API Key, SatNOGS Token (already verified in `.env.local`).
* **Risks**: External API rate limits and downtime.
* **Tests Required**: Mocked HTTP integration tests with recorded fixtures.
* **Definition of Done**: Solar flare and geomagnetic storm events correlate with satellite telemetry spikes on the investigation timeline.

---

## Phase 5: Frontend Production Architecture & Optimization

* **Objective**: Replace polling intervals with reactive WebSocket state, introduce environment-aware API URLs, and add chart downsampling.
* **Files Affected**:
  * `frontend/src/services/socket.ts` (environment-aware backend URL)
  * `frontend/src/services/api.ts` (`VITE_API_URL` prefix)
  * `frontend/src/pages/DashboardPage.tsx` (replace 3s polling with event subscriptions)
  * `frontend/src/pages/AnomalyCenterPage.tsx` (reactive anomaly list updates)
  * `frontend/src/components/TelemetryChart.tsx` (LTTB downsampling for large series)
* **Dependencies**: Phase 3 completed.
* **Risks**: UI stale state during reconnection events.
* **Tests Required**: React component rendering and interaction tests (Vitest / React Testing Library).
* **Definition of Done**: Zero polling loops on Dashboard and Anomaly pages; cross-origin socket connection verified.

---

## Phase 6: Security, Process Lifecycle & Reliability

* **Objective**: Implement graceful process shutdown, restrict ML microservice CORS, and harden production security headers.
* **Files Affected**:
  * `backend/src/index.ts` (`SIGTERM` / `SIGINT` connection draining)
  * `ml-service/app/main.py` (restrict `allow_origins`)
  * `backend/src/modules/simulation/simulationService.ts` (stop on shutdown)
* **Dependencies**: None.
* **Risks**: Hanging connections during deployment restarts.
* **Tests Required**: Process signal termination tests.
* **Definition of Done**: Server cleanly terminates within 5 seconds of receiving `SIGTERM` without dropping active requests.

---

## Phase 7: Production Cloud Deployment

* **Objective**: Deploy frontend to Vercel, Node.js backend to Render/Railway, and connect to MongoDB Atlas.
* **Files Affected**:
  * `vercel.json` (frontend SPA routing config)
  * `render.yaml` or `railway.json` (backend process definitions)
  * `Dockerfile` / `docker-compose.yml`
* **Dependencies**: Cloud accounts (Vercel, Render/Railway, Atlas).
* **Risks**: Cross-origin WebSocket negotiation through cloud reverse proxies.
* **Tests Required**: Health check and WebSocket ping test on live production URLs.
* **Definition of Done**: Full platform accessible via HTTPS with valid SSL and live WebSocket links.

---

## Phase 8: End-to-End Validation & Benchmarking

* **Objective**: Execute automated end-to-end evaluation using synthetic and historical NASA SMAP datasets.
* **Files Affected**:
  * `tests/e2e/` (playwright / automated integration flows)
  * `scripts/evaluate_pipeline.py` (precision/recall benchmark script)
* **Dependencies**: Phases 2–7 completed.
* **Risks**: Flaky test runs on network latency.
* **Tests Required**: End-to-end telemetry ingestion ➔ anomaly trigger ➔ AI assessment citation validation.
* **Definition of Done**: Ground truth anomaly detection precision > 85%, recall > 80%, zero fabricated evidence citations.

---

## Phase 9: ML Enhancements & Multimodal Features (Post-MVP)

* **Objective**: Train multivariate temporal models and multi-subsystem correlation models.
* **Files Affected**:
  * `ml-service/app/models/` (Autoencoders, One-Class SVM)
  * `ml-service/app/features/` (FFT spectral features, wavelets)
* **Explicit Policy**: Postponed until Phases 2–8 are fully completed and stabilized.

# SpaceGuard AI — Phase 5 Implementation Document
# Security, Reliability, Observability & Failure Resilience

> **Phase Status**: Complete  
> **Baseline Regressions**: 0  
> **Backend Jest**: 49 / 49 tests passing (+17 new tests)  
> **ML Pytest**: 12 / 12 tests passing  
> **Frontend Realtime**: 6 / 6 tests passing  
> **Frontend Build**: PASS (`tsc -b && vite build`)

---

## 1. Scope & Objectives

Phase 5 hardens the SpaceGuard AI platform against API abuse, malicious input, resource exhaustion, and component/dependency outages without modifying ML algorithms, rewriting operational code, or adding arbitrary identity systems prematurely.

The core objectives achieved:
1. **Layered API Defense**: CORS validation, Helmet HTTP security headers, request body limits, centralized error taxonomy, and route-sensitive rate limiting.
2. **Strict Input Boundaries**: Zod schema validation across all REST route parameters, query strings, and request bodies with MongoDB operator injection defenses and bounded query limits.
3. **Socket.IO Realtime Hardening**: Origin validation, satellite ID regex validation (`/^[A-Za-z0-9_-]{1,32}$/`), room caps (10 rooms/socket), connection caps (25 sockets/IP), and untrusted payload validation.
4. **Resilience & Graceful Degradation**: Core telemetry, rule-based anomaly detection, and evidence creation continue uninterrupted when external providers (NOAA, NASA, SatNOGS, CelesTrak), the Python ML service, or Gemini AI are unavailable or timing out.
5. **Observability & Request Correlation**: Request ID generation (`X-Request-Id`), JSON-structured Winston logging, Morgan HTTP access logging, and a detailed `/api/system/health` endpoint distinguishing liveness from readiness.
6. **Graceful Shutdown**: SIGINT and SIGTERM handlers to flush persistence buffers, stop active simulations, terminate background tasks, close Socket.IO, and disconnect MongoDB cleanly.

---

## 2. Security Audit & Hardening Matrix

| Category | Prior State | Phase 5 Hardened State |
|---|---|---|
| **CORS** | Single origin string or wildcard | Multi-origin comma-separated array validator (`CORS_ALLOWED_ORIGINS`) with exact origin matching and credentials support |
| **HTTP Headers** | None | Helmet enabled: `frameguard: deny`, `noSniff: true`, `referrerPolicy: no-referrer` |
| **Request Size Limits** | Default / `10mb` | JSON payload bounded to `256kb`; URL-encoded bounded to `64kb` |
| **Input Validation** | Ad-hoc in some controllers | Strict Zod validation on `params`, `query`, and `body` before controller entry |
| **Mongo Operator Injection** | Vulnerable if `$ne`, `$gt` passed in query | Zod transforms validate exact types; string constraints reject operators |
| **Query Limits** | Unbounded (`limit=999999999`) | Hard maximum bounded: max 500 items, default 50 |
| **Time Windows** | Unbounded | Maximum time window capped at 30 days (`2592000000 ms`) |
| **Rate Limiting** | Global 100 req / 15 min | Route-sensitive rate limiters for General Read, AI, Simulation, and External Refresh |
| **Socket.IO** | Unchecked room joins | Satellite ID regex check, max 10 rooms/socket, max 25 connections/IP |
| **Error Leakage** | Mixed `err.message` exposures | Standardized `AppError` taxonomy; stack traces and internal secrets never leaked |
| **SSRF Surface** | Verified NOT PRESENT | All 6 outbound `fetch` targets are hardcoded internal/provider URLs |
| **Path Traversal Surface** | Verified NOT PRESENT | Only 1 static fixture path read (`path.resolve`); no user input in paths |

---

## 3. Route-Sensitive Rate Limiting

Rate limiting is applied conditionally by route sensitivity:

| Limiter | Route / Scope | Limit | Window | Purpose |
|---|---|---:|---:|---|
| **General Read** | `/api/*` (GET) | 300 req | 1 min | Protects database and server from burst scraping |
| **Expensive AI** | `/api/anomalies/:id/assessment` | 10 req | 1 min | Protects Gemini token quota and prevents API budget exhaustion |
| **Simulation Control** | `/api/simulation/start`, `/stop` | 20 req | 1 min | Prevents telemetry generator CPU thrashing and memory spikes |
| **External Refresh** | `/api/space-weather/refresh`, `/orbital/sync` | 15 req | 1 min | Prevents upstream IP rate-limiting from NOAA, NASA, and CelesTrak |
| **Socket Connection** | Socket.IO handshake | 25 conn | per IP | Prevents websocket connection flooding |

---

## 4. Input Validation & Schema Specifications

New and enhanced Zod validation schemas are enforced at the HTTP boundary via [`validateRequest`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/middleware/validation.ts):

* **`SatelliteIdSchema`**: Strict alphanumeric identifier string with dashes and underscores (`/^[A-Za-z0-9_-]{1,32}$/`).
* **`AnomalyIdSchema`**: Strict format matching `ANOM-[A-Za-z0-9_-]+-\d{5}`.
* **`EvidenceIdSchema`**: Strict format matching `EVID-[A-Za-z0-9_-]+-\d{5}`.
* **`PaginationLimitSchema`**: Coerced integer, min 1, max 500, default 50.
* **`BoundedTimeRangeQuerySchema`**: Validates start and end timestamps; enforces `end >= start` and `end - start <= 30 days`.
* **`StartSimulationSchema`**: Whitelist check on scenario names (`thermal_spike`, `power_loss`, `comm_dropout`, `attitude_drift`, `payload_degraded`, `sensor_bias`, `coupled_failure`); bounded `intervalMs` (100ms - 10,000ms).

---

## 5. Centralized Error Taxonomy

All API responses conform to a unified error shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Field 'limit' must be less than or equal to 500",
    "details": [...]
  }
}
```

### Supported Error Codes
* `VALIDATION_ERROR` (HTTP 400) — Malformed query, invalid parameters, or payload validation failure.
* `MALFORMED_JSON` (HTTP 400) — Unparseable JSON body sent by client.
* `NOT_FOUND` (HTTP 404) — Requested resource does not exist.
* `PAYLOAD_TOO_LARGE` (HTTP 413) — Body exceeded the 256kb limit.
* `RATE_LIMIT_EXCEEDED` (HTTP 429) — Route request quota exceeded; includes `Retry-After` header.
* `SERVICE_UNAVAILABLE` (HTTP 503) — Database or mandatory subsystem temporarily offline.
* `INTERNAL_ERROR` (HTTP 500) — Uncaught server exception; stack trace logged to Winston but never exposed to client.

---

## 6. Dependency Failure Matrix & Graceful Degradation

SpaceGuard AI separates core real-time processing from secondary enrichment dependencies:

| Dependency | Classification | Failure Mode | System Behavior | Recovery Mechanism |
|---|---|---|---|---|
| **MongoDB** | Core Persistence | Unreachable / Connection Dropped | In-memory ring buffer retains latest 200 telemetry points, active anomalies, and health states. Endpoints return cached data or controlled 503. Health endpoint reports `degraded_in_memory`. | Automatic Mongoose reconnect with exponential backoff; buffer flushes on reconnection. |
| **Python ML Service** | Secondary Detector | Offline / Timeout (1.2s) | Rule Engine and Statistical Engine continue detecting anomalies; `mlContribution` remains null. No fabricated ML scores. Health reports ML unavailable. | Automatic retry throttled to 10s intervals when offline. |
| **Gemini AI** | Secondary Explainer | Offline / Quota / Timeout (15s) | Core anomaly, evidence, and correlation pipelines remain 100% functional. Grounded deterministic fallback assessment is returned citing evidence without hallucination. | Resumes live generative assessments on next valid request. |
| **NOAA SWPC** | Context Provider | API Timeout (3s) / HTTP 5xx | Space weather service serves cached snapshot (2-minute TTL) with `status: 'cached'`. If cache empty, returns structured nominal default labeled `unavailable`. | Background refresh retries on next scheduled interval. |
| **NASA DONKI** | Context Provider | Offline / Rate Limited | Persisted DONKI events remain in MongoDB and correlation engine continues matching against historical flares/CMEs. | Sync task retries on next schedule. |
| **SatNOGS** | Context Provider | API Timeout (5s) / Token Invalid | Persisted observations remain available. UI marks observation feed as stale or offline without crashing. | Recovers when SatNOGS network responds. |
| **CelesTrak** | Orbital Context | Offline / HTTP Timeout | Cached TLE records and precomputed SAA bounding box geometry continue providing orbital crossing context. | Recovers on next scheduled TLE sync. |
| **Socket.IO** | Realtime Delivery | Client Disconnected / Network Drop | Client transitions through `connecting -> connected -> disconnected -> reconnecting` state machine. Telemetry resync occurs over REST upon reconnect. | Exponential reconnection built into `useSocket` hook. |

---

## 7. Observability & Monitoring

* **Request ID Tracking**: Every incoming HTTP request is assigned a unique `req.id` (via `X-Request-Id` or generated `req_uuid`). Propagated in response headers and logged with Morgan.
* **Structured Winston Logging**: High-signal JSON logs with timestamps, log levels (`debug`, `info`, `warn`, `error`), service tag (`spaceguard-backend`), and metadata. Avoids flooding by logging telemetry at `debug` and operations at `info`.
* **System Health Endpoint** (`GET /api/system/health`):
  * **Liveness**: HTTP 200 with `{ status: "ok" }`.
  * **Readiness**: `{ ready: true }` indicating ability to serve traffic.
  * **Dependency Breakdown**: Detailed status for `database`, `mlService`, `geminiAi`, and `externalProviders`.

---

## 8. Graceful Shutdown Workflow

On `SIGTERM` or `SIGINT`:
1. Stop accepting new HTTP requests (`httpServer.close()`).
2. Stop active telemetry simulation runs (`SimulationService.stop()`).
3. Terminate external sync intervals and background timers.
4. Disconnect all connected Socket.IO clients (`io.close()`).
5. Close MongoDB database connections (`mongoose.connection.close()`).
6. Exit process cleanly (`process.exit(0)`).

---

## 9. Verification & Test Summary

* **Security Test Suite** ([`src/middleware/security.test.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/middleware/security.test.ts)): 10 / 10 passed.
* **Rate Limiter Test Suite** ([`src/middleware/rateLimiter.test.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/middleware/rateLimiter.test.ts)): 3 / 3 passed.
* **Failure Injection Suite** ([`src/middleware/failureInjection.test.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/middleware/failureInjection.test.ts)): 4 / 4 passed.
* **Backend Unit & Integration**: 49 / 49 passed.
* **Python ML Pytest Suite**: 12 / 12 passed.
* **Frontend Realtime Test Suite**: 6 / 6 passed.
* **Frontend Production Build**: Built in 2.22s with zero TypeScript errors.

---

## 10. Known Gaps & Deferred Items

### Implemented in Phase 5
* HTTP Security Headers (Helmet).
* Request size limiting.
* Input validation & MongoDB query operator sanitation.
* Bounded query parameters and time ranges.
* Centralized error handling and secret leak prevention.
* Route-sensitive rate limiting.
* Socket.IO room caps and regex validation.
* Failure resilience across all external dependencies.
* Health & readiness observability.

### Deferred to Phase 6 (Production Deployment)
* **Authentication & RBAC**: JWT/OAuth2 bearer tokens and user roles (`operator`, `admin`, `analyst`). All API endpoints currently operate unauthenticated.
* **Distributed Rate Limiting**: In-memory sliding window rate limiter is appropriate for single-instance Node.js; multi-instance deployment will require Redis-backed store.
* **Production CSP & Reverse Proxy**: Content-Security-Policy headers tailored to production CDN/Vercel/Render domains.
* **Container Health Probes**: Kubernetes / Docker compose `livenessProbe` and `readinessProbe` binding to `/api/system/health`.

### Deferred to Phase 7 (Advanced ML & Research)
* Online incremental learning for Isolation Forest.
* Subsystem residual cross-coupling matrices.
* Bayesian belief networks for causal fault probability estimation.

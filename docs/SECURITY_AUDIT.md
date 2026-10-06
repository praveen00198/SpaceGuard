# SpaceGuard AI — Security Audit & Threat Assessment

> **Audit Baseline**: Phase 5 Implementation  
> **Status**: Hardened Application Boundary (Transport, Input, Resource, Realtime)  
> **Note on Authentication**: Application hardening is complete. User identity authentication and Role-Based Access Control (RBAC) are deferred to Phase 6 deployment.

---

## 1. Executive Summary

In Phase 5, SpaceGuard AI's attack surface was systematically audited and hardened against the OWASP API Top 10 vulnerabilities, resource exhaustion attacks, and operational dependency failures.

| Security Control | Phase 1 Status | Phase 5 Status | Verification |
|---|---|---|---|
| **CORS Policy** | Permissive / Localhost | Restricted Multi-Origin Validator | Unit Test + Configuration |
| **HTTP Security Headers** | Missing | Enabled (Helmet `noSniff`, `frameguard`, etc.) | Unit Test |
| **Request Payload Size** | Unbounded (`10MB` default) | Clamped to `256 KB` (JSON) / `64 KB` (URL-encoded) | Security Test 2 (HTTP 413) |
| **Input Validation** | Partial | Comprehensive Zod schemas on all routes | Security Tests 3, 4, 5, 8, 9 |
| **NoSQL Injection ($ne, $gt)** | Unchecked | Explicit type parsing & Mongo operator rejection | Security Test 6 |
| **Query Parameter Limits** | Unbounded | Max limit 500, Max time range 30 days | Security Test 7 |
| **Rate Limiting** | Global 100/15min | Route-sensitive limiters (Read, AI, Sim, Sync) | Rate Limiter Tests 1-3 |
| **Realtime Security** | Unvalidated socket joins | Regex room checks, 10 rooms/conn, 25 conns/IP | Realtime Tests |
| **Information Leakage** | Mixed | Centralized `AppError`, zero stack traces leaked | Security Test 10 |
| **SSRF Surface** | Verified NOT PRESENT | No user-controlled outbound URLs | Static Audit |
| **Path Traversal Surface** | Verified NOT PRESENT | No user-controlled filesystem lookups | Static Audit |

---

## 2. Secrets & Credentials Isolation

* **Finding**: `PASS`
* **Verification**:
  * All secrets (`GEMINI_API_KEY`, `NASA_API_KEY`, `SATNOGS_API_TOKEN`, `MONGODB_URI`) are located exclusively in root `.env` / `.env.local`.
  * `.gitignore` explicitly ignores `.env`, `.env.local`, and `.env.*.local`.
  * None of the `frontend/` source files or build bundles contain private API keys or tokens.
  * No `VITE_` prefixed environment variables expose secrets to the client browser.
  * Gemini API is called strictly from backend [`geminiService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/assessments/geminiService.ts).
  * Error responses sanitize all credentials and database connection strings before sending responses.

---

## 3. Cross-Origin Resource Sharing (CORS)

* **Finding**: `PASS`
* **Implementation**:
  * Backend parses comma-separated origins from `CORS_ALLOWED_ORIGINS` (defaulting to `http://localhost:5173`).
  * Dynamic origin validator allows valid frontend origins while blocking malicious cross-origin scripts.
  * Both REST and Socket.IO share the identical CORS origin validation policy.

---

## 4. HTTP Security Headers

* **Finding**: `PASS`
* **Implementation**:
  * Helmet middleware is configured:
    * `X-Content-Type-Options: nosniff` to prevent MIME-type sniffing.
    * `X-Frame-Options: DENY` to eliminate clickjacking vectors.
    * `Referrer-Policy: no-referrer` to prevent referrer information leakage.

---

## 5. Input Validation & Query Bounds

* **Finding**: `PASS`
* **Implementation**:
  * Every endpoint validates parameters, query strings, and body structures via Zod middleware before hitting service logic.
  * `limit` query parameters are strictly clamped to a maximum of 500 items.
  * Time range queries require `end >= start` and enforce a maximum window of 30 days (`2592000000 ms`).
  * No raw client objects are passed into MongoDB queries.
  * Alphanumeric identifiers (`satelliteId`, `anomalyId`, `evidenceId`) are validated with strict regex patterns.

---

## 6. Rate Limiting & Abuse Prevention

* **Finding**: `PASS`
* **Implementation**:
  * **General Read API**: 300 requests/minute per client IP.
  * **AI Assessment Endpoint**: 10 requests/minute per client IP.
  * **Simulation Lifecycle**: 20 requests/minute per client IP.
  * **External Space Data Refresh**: 15 requests/minute per client IP.
  * Exceeded quotas return HTTP 429 `RATE_LIMIT_EXCEEDED` with a standard `Retry-After` header.

---

## 7. Socket.IO Realtime Abuse Protection

* **Finding**: `PASS`
* **Implementation**:
  * Handshake validates client origin against allowed CORS origins.
  * Per-IP connection ceiling of 25 concurrent connections.
  * Satellite room subscriptions validated against `/^[A-Za-z0-9_-]{1,32}$/`.
  * Each socket is capped at a maximum of 10 simultaneous room subscriptions.

---

## 8. Server-Side Request Forgery (SSRF) & Path Traversal

* **Finding**: `PASS (Surface Not Present)`
* **Verification**:
  * Static code analysis verified that zero user-supplied query parameters or body parameters are used to construct outbound HTTP URLs.
  * All outbound HTTP requests target predefined, hardcoded base URLs (`NOAA`, `NASA DONKI`, `SatNOGS`, `CelesTrak`, `Gemini`, `ML Service`).
  * Zero user-controlled strings are passed to `fs` or `path` functions. Only static fixture files are accessed via `path.resolve(__dirname, ...)`.

---

## 9. Error Sanitization & Leakage Prevention

* **Finding**: `PASS`
* **Implementation**:
  * Centralized error handler captures all synchronous and asynchronous errors.
  * Internal error stack traces, database schemas, and configuration variables are logged to Winston but **never exposed in HTTP responses**.
  * Clients receive a standardized JSON response:
    ```json
    {
      "success": false,
      "error": {
        "code": "VALIDATION_ERROR | NOT_FOUND | RATE_LIMIT_EXCEEDED | ...",
        "message": "Human-readable safe explanation"
      }
    }
    ```

---

## 10. AI Reasoning Sandboxing (Principles 1 & 8)

* **Finding**: `PASS`
* **Audit of Gemini Capabilities**:
  * **Database Access**: NONE. Gemini receives only an in-memory evidence payload.
  * **Spacecraft Commanding**: NONE. SpaceGuard has no commanding endpoints or uplink capabilities.
  * **Tool/Execution Access**: NONE. Gemini is invoked with zero function tools or code interpreters.
  * **Grounded Output**: System enforces strict JSON output matching the evidence citation schema.
  * **Offline Fallback**: When Gemini is unavailable, the deterministic fallback engine provides evidence analysis without hallucination.

---

## 11. Known Security Gaps & Deferred Scope

* **Authentication & RBAC**: Currently, all endpoints operate without user credentials. Multi-user accounts, JWT authentication, and operator role enforcement are explicitly scheduled for Phase 6.
* **Distributed Rate Limiting**: The current rate limiter uses an in-memory sliding window, which is robust for single-instance Node.js processes. Horizontal multi-instance scaling in Phase 6 will require Redis backing.

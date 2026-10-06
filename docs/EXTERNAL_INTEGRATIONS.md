# SpaceGuard AI — External API & Integration Audit

> Audit Baseline: Phase 1 Audit
> Verification: Tested live against remote endpoints on 2026-09-26.

---

## 1. External Integration Status Matrix

| Integration | Base URL / Endpoint | Auth Type | Env Variable | Status in Code | Live API Verified | Timeout | Cache Strategy | Graceful Fallback |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **NOAA SWPC** | `https://services.swpc.noaa.gov` | None (Public) | `NOAA_SWPC_BASE_URL` | **Implemented & Correlated** | Yes | 3000ms | 2-min in-memory | Local snapshot file (`kp_index.json`) ➔ honest `unavailable` status |
| **NASA DONKI** | `https://api.nasa.gov/DONKI/` | API Key | `NASA_API_KEY` | **Implemented & Correlated** | Yes | 4000ms | 5-min in-memory + Mongo repo | Database cache / in-memory cache |
| **SatNOGS DB** | `https://db.satnogs.org/api/` | Token | `SATNOGS_API_TOKEN` | **Implemented** | Yes | 3500ms | 10-min in-memory | Ground metadata fallback |
| **CelesTrak** | `https://celestrak.org/` | None (Public) | `CELESTRAK_BASE_URL` | **Implemented & Correlated** | Yes | 3000ms | 5-min in-memory | Mission orbital profile calculation |
| **Google Gemini** | `generativelanguage.googleapis.com` | API Key | `GEMINI_API_KEY` | **Implemented** | Yes | Standard fetch | In-memory `assessmentCache` | Grounded deterministic rule-fallback reasoning |
| **ML Microservice** | `http://localhost:8000` | None (Internal) | `ML_SERVICE_URL` | **Implemented** | Yes (12/12 tests) | 1200ms | None | `{ available: false }` throttled 10s retry |

---

## 2. Integration Deep Dive

### 1. NOAA Space Weather Prediction Center (SWPC)
* **File Reference**: [`backend/src/modules/space-weather/spaceWeatherService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/space-weather/spaceWeatherService.ts)
* **Implemented Endpoint**: `/products/noaa-planetary-k-index.json`
* **Behavior**:
  * Extracts the most recent 3-hour planetary K-index.
  * Maps Kp value to NOAA geomagnetic storm scales (G0 through G5).
  * In-memory cache TTL: 2 minutes (`120,000ms`).
  * If live fetch fails, falls back to `data/raw/space-weather/kp_index.json`.
  * If file missing, returns honest `{ status: "unavailable" }` without crash.
* **Phase 4 Correlation**: Active Kp $\ge$ 5.0 triggers temporal overlap evaluation generating formal `EVID-ENV-...` non-causal evidence items.

---

### 2. NASA DONKI (Space Weather Database of Notifications, Knowledge, Information)
* **File Reference**: [`backend/src/modules/space-weather/donkiService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/space-weather/donkiService.ts)
* **Current State**:
  * Implemented `DonkiService.fetchEvents()` and `getEventsInWindow(start, end)`.
  * Normalizes NASA space weather notifications, solar flares (FLR), coronal mass ejections (CME), and geomagnetic storms (GST) into canonical `IEnvironmentalEvent` schema.
  * Persists records to MongoDB with compound index `(timestamp, eventType)`.
  * Caches in-memory for 5 minutes (`300,000ms`).
* **Phase 4 Correlation**: Flags temporal overlap with anomalies occurring within $\pm 60$ minutes of solar activity. Attaches non-causal contextual evidence (`EVID-ENV-...`) with explicit disclaimers.

---

### 3. SatNOGS DB API
* **File Reference**: [`backend/src/modules/satellites/satnogsService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/satellites/satnogsService.ts)
* **Current State**:
  * Implemented `SatNogsService.getSatelliteMetadata(noradId)` with authentication (`Token <key>`).
  * Exposes endpoint `GET /api/satellites/:id/satnogs`.
  * In-memory caching for 10 minutes (`600,000ms`).
  * Provides ground station observation telemetry frames and operational status (alive, decayed, transmitters count).

---

### 4. CelesTrak Orbital Data (GP / OMM) & SAA Corridor Analysis
* **File Reference**: [`backend/src/modules/orbital/orbitalService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/orbital/orbitalService.ts)
* **Current State**:
  * Implemented `OrbitalService.getOrbitalContext(satelliteId, noradId)`.
  * Queries CelesTrak General Perturbations (GP) elements in JSON format.
  * Evaluates satellite orbital regime (LEO, MEO, GEO, HEO), inclination, and period.
  * Calculates spacecraft latitude/longitude ground track trajectory and evaluates South Atlantic Anomaly (SAA) high-radiation corridor traversal.
  * Exposes endpoint `GET /api/orbital/context/:satelliteId`.
* **Phase 4 Correlation**: Traversal of the SAA zone generates environmental overlap evidence (`EVID-ORB-...`) documenting elevated radiation environment without asserting hardware failure causality.

---

### 5. Google Gemini AI Diagnostics
* **File Reference**: [`backend/src/modules/assessments/geminiService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/assessments/geminiService.ts)
* **Model**: `gemini-3.8-flash` (updated from deprecated `gemini-2.0-flash`).
* **Request Flow**:
  * HTTP POST with `generationConfig: { responseMimeType: "application/json", temperature: 0.2 }`.
  * Context payload includes Satellite metadata, Space Weather status, Anomaly details, and explicit list of `[EVID-...]` items.
* **Grounding Enforcement**:
  * Prompt explicitly forbids inventing evidence IDs.
  * Response parsed and validated against `IAIAssessment` schema.
* **Fallback Behavior**:
  * If `GEMINI_API_KEY` is missing or the API returns 503 / 429 / network error, `generateFallbackAssessment()` executes.
  * The fallback engine analyzes the parameter type (thermal, power, comms) and generates an evidence-grounded assessment citing the real `EVID-*` IDs.
* **Frontend Direct Calls**: None. All Gemini communication happens strictly on the backend.

---

### 6. Python FastAPI ML Microservice
* **File Reference**: [`backend/src/modules/anomalies/mlEngine.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/anomalies/mlEngine.ts) and [`ml-service/app/main.py`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/ml-service/app/main.py)
* **Protocol**: HTTP REST over `http://localhost:8000/api/predict`.
* **Timeout**: 1200ms with `AbortController`.
* **Degradation**: If the ML service is not running or takes > 1200ms, `MLEngine` returns `{ detected: false, score: 0.0, available: false }` and sets a 10-second throttle to avoid log spam. The Hybrid Anomaly Engine proceeds using the Rule and Statistical engines without error.

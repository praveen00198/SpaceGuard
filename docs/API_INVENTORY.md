# SpaceGuard AI — REST API Inventory

> Audit Baseline: Phase 1 Audit
> Date: 2026-09-26
> Environment: Node.js 22+ / Express 4.21 / TypeScript 5.7

This document is an exhaustive inventory of all HTTP REST API endpoints currently implemented in `backend/src/`.

---

## 1. System Endpoints

### `GET /api/system/health`
* **File Reference**: [`backend/src/index.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/index.ts)
* **Purpose**: System liveness, readiness, and dependency health status.
* **Authentication**: None.
* **Rate Limit**: General Read (300 req / min).
* **Response**:
  ```json
  {
    "status": "ok",
    "ready": true,
    "service": "spaceguard-backend",
    "version": "0.1.0",
    "timestamp": "2026-09-26T12:00:00.000Z",
    "uptime": 124.5,
    "dependencies": {
      "database": { "status": "connected", "required": false },
      "mlService": { "status": "ready", "required": false },
      "geminiAi": { "status": "configured", "required": false },
      "externalProviders": { "status": "available", "required": false }
    }
  }
  ```
* **Status Codes**: `200 OK`.

---

### `GET /api/system/data-sources`
* **File Reference**: [`backend/src/index.ts:87-99`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/index.ts#L87-L99)
* **Purpose**: Returns the operational status and connection state of internal and external data sources.
* **Authentication**: None.
* **Request Body**: None.
* **Query Parameters**: None.
* **Path Parameters**: None.
* **Response**:
  ```json
  {
    "sources": [
      { "name": "In-Memory Store", "status": "connected", "type": "database" },
      { "name": "ML Service", "status": "ready", "type": "internal" },
      { "name": "NOAA SWPC", "status": "active", "type": "external" },
      { "name": "NASA DONKI", "status": "standby", "type": "external" },
      { "name": "CelesTrak", "status": "standby", "type": "external" },
      { "name": "SatNOGS", "status": "standby", "type": "external" },
      { "name": "Gemini AI", "status": "configured", "type": "ai" }
    ]
  }
  ```
* **Status Codes**: `200 OK`.
* **Dependencies**: `config.gemini.apiKey`. Note: statuses for DONKI, CelesTrak, SatNOGS are currently hardcoded mock indicators.

---

## 2. Satellite Endpoints (`/api/satellites`)

### `GET /api/satellites`
* **File Reference**: [`backend/src/modules/satellites/satelliteRoutes.ts:7-13`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/satellites/satelliteRoutes.ts#L7-L13)
* **Controller/Service**: `SatelliteService.getAllSatellites()`
* **Purpose**: Retrieve list of all tracked satellites.
* **Authentication**: None.
* **Query Parameters**: None.
* **Response**:
  ```json
  {
    "data": [
      {
        "satelliteId": "SG-1",
        "name": "AURA-1 (LEO Climate Monitor)",
        "noradId": 44321,
        "intlDesignator": "2022-045A",
        "type": "smallsat",
        "operator": "SpaceGuard Ops",
        "mission": "Atmospheric Earth Observation",
        "status": "active",
        "launchDate": "2022-04-12T00:00:00.000Z",
        "dataSource": "simulator",
        "createdAt": "2026-09-26T12:00:00.000Z",
        "updatedAt": "2026-09-26T12:00:00.000Z"
      }
    ],
    "total": 3
  }
  ```
* **Status Codes**: `200 OK`.

---

### `GET /api/satellites/:id`
* **File Reference**: [`backend/src/modules/satellites/satelliteRoutes.ts:15-23`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/satellites/satelliteRoutes.ts#L15-L23)
* **Controller/Service**: `SatelliteService.getSatelliteById(id)`
* **Purpose**: Retrieve single satellite by identifier.
* **Path Parameters**: `id` (string).
* **Response (Success)**: `200 OK` with `{ "data": ISatellite }`.
* **Response (Not Found)**: `404 Not Found` with `{ "error": { "code": "NOT_FOUND", "message": "Satellite ... not found" } }`.

---

### `POST /api/satellites`
* **File Reference**: [`backend/src/modules/satellites/satelliteRoutes.ts:25-45`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/satellites/satelliteRoutes.ts#L25-L45)
* **Controller/Service**: `SatelliteService.createSatellite(data)`
* **Validation**: Zod schema `CreateSatelliteSchema`.
* **Request Body**:
  ```json
  {
    "satelliteId": "SAT-TEST",
    "name": "Orbital Probe Alpha",
    "noradId": 99123,
    "type": "cubesat",
    "operator": "Testing Corp",
    "status": "active",
    "dataSource": "simulator"
  }
  ```
* **Response**: `201 Created` with `{ "data": ISatellite }`.
* **Errors**: `400 Bad Request` (validation error), `409 Conflict` (duplicate satellite ID).

---

## 3. Telemetry Endpoints (`/api/telemetry`)

### `GET /api/telemetry`
* **File Reference**: [`backend/src/modules/telemetry/telemetryRoutes.ts:11-23`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/telemetry/telemetryRoutes.ts#L11-L23)
* **Controller/Service**: `TelemetryService.getHistory(query)`
* **Validation**: Zod `TelemetryQuerySchema`.
* **Query Parameters**:
  * `satelliteId` (optional string)
  * `parameter` (optional string)
  * `subsystem` (optional `'power' | 'thermal' | 'communication' | 'attitude' | 'payload'`)
  * `startTime` (optional ISO date string)
  * `endTime` (optional ISO date string)
  * `limit` (optional integer, min 1, max 5000, default 500)
* **Response**: `200 OK` with `{ "data": ITelemetryReading[], "total": number }`.

---

### `GET /api/telemetry/latest/:satelliteId`
* **File Reference**: [`backend/src/modules/telemetry/telemetryRoutes.ts:25-29`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/telemetry/telemetryRoutes.ts#L25-L29)
* **Controller/Service**: `TelemetryService.getLatestReadings(satelliteId)`
* **Path Parameters**: `satelliteId` (string).
* **Response**: `200 OK` with `{ "data": ITelemetryReading[], "total": number }`.

---

### `GET /api/telemetry/stats/:satelliteId`
* **File Reference**: [`backend/src/modules/telemetry/telemetryRoutes.ts:31-35`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/telemetry/telemetryRoutes.ts#L31-L35)
* **Controller/Service**: `TelemetryService.getStats(satelliteId)`
* **Response**: `200 OK` with:
  ```json
  {
    "data": {
      "totalReadings": 1500,
      "activeParametersCount": 11,
      "lastIngestedAt": "2026-09-26T12:05:00.000Z"
    }
  }
  ```

---

### `POST /api/telemetry/ingest`
* **File Reference**: [`backend/src/modules/telemetry/telemetryRoutes.ts:37-54`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/telemetry/telemetryRoutes.ts#L37-L54)
* **Controller/Service**: `TelemetryService.ingestReading(input)`
* **Validation**: Zod `TelemetryReadingInputSchema`.
* **Request Body**:
  ```json
  {
    "satelliteId": "SG-1",
    "parameter": "temperature",
    "value": 22.5,
    "unit": "C",
    "subsystem": "thermal",
    "timestamp": "2026-09-26T12:00:00Z",
    "source": "simulator",
    "quality": "valid"
  }
  ```
* **Side Effects**:
  1. Stores reading in memory buffer.
  2. Updates latest parameter cache.
  3. Executes `AnomalyService.processReading(reading)`.
  4. Broadcasts reading and anomaly (if detected) over Socket.IO.
* **Response**: `201 Created` with:
  ```json
  {
    "data": { "..." },
    "anomalyDetected": false,
    "anomaly": null
  }
  ```

---

### `POST /api/telemetry/ingest/batch`
* **File Reference**: [`backend/src/modules/telemetry/telemetryRoutes.ts:56-72`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/telemetry/telemetryRoutes.ts#L56-L72)
* **Controller/Service**: `TelemetryService.ingestBatch(readings)`
* **Validation**: Zod `BatchTelemetryInputSchema` (1 to 2000 items).
* **Response**: `201 Created` with `{ "data": { "ingested": 11, "anomaliesDetected": 1 } }`.

---

## 4. Anomaly Endpoints (`/api/anomalies`)

### `GET /api/anomalies`
* **File Reference**: [`backend/src/modules/anomalies/anomalyRoutes.ts:7-25`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/anomalies/anomalyRoutes.ts#L7-L25)
* **Controller/Service**: `AnomalyService.getAnomalies(filter)`
* **Query Parameters**:
  * `satelliteId` (optional string)
  * `severity` (`'low' | 'medium' | 'high' | 'critical'`)
  * `status` (`'active' | 'investigating' | 'resolved' | 'dismissed'`)
  * `subsystem` (optional string)
  * `limit` (optional integer, default 100)
* **Response**: `200 OK` with `{ "data": IAnomaly[], "total": number }`.

---

### `GET /api/anomalies/:id`
* **File Reference**: [`backend/src/modules/anomalies/anomalyRoutes.ts:27-35`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/anomalies/anomalyRoutes.ts#L27-L35)
* **Path Parameters**: `id` (string).
* **Response**: `200 OK` with `{ "data": IAnomaly }` or `404 Not Found`.

---

### `PATCH /api/anomalies/:id/status`
* **File Reference**: [`backend/src/modules/anomalies/anomalyRoutes.ts:37-53`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/anomalies/anomalyRoutes.ts#L37-L53)
* **Path Parameters**: `id` (string).
* **Request Body**: `{ "status": "active" | "investigating" | "resolved" | "dismissed" }`.
* **Response**: `200 OK` with updated `{ "data": IAnomaly }` or `400 Bad Request` or `404 Not Found`.

---

## 5. Health Endpoints (`/api/health`)

### `GET /api/health`
* **File Reference**: [`backend/src/modules/health/healthRoutes.ts:22-29`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/health/healthRoutes.ts#L22-L29)
* **Controller/Service**: `HealthService.computeHealth()` for all satellites.
* **Response**: `200 OK` with `{ "data": IHealthSnapshot[], "total": number }`.

---

### `GET /api/health/:satelliteId`
* **File Reference**: [`backend/src/modules/health/healthRoutes.ts:8-20`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/health/healthRoutes.ts#L8-L20)
* **Path Parameters**: `satelliteId` (string).
* **Response**: `200 OK` with `{ "data": IHealthSnapshot }` or `404 Not Found`.

---

## 6. Evidence Endpoints (`/api/evidence`)

### `GET /api/evidence`
* **File Reference**: [`backend/src/modules/evidence/evidenceRoutes.ts:6-10`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/evidence/evidenceRoutes.ts#L6-L10)
* **Query Parameters**: `limit` (default 100).
* **Response**: `200 OK` with `{ "data": IEvidence[], "total": number }`.

---

### `GET /api/evidence/:id`
* **File Reference**: [`backend/src/modules/evidence/evidenceRoutes.ts:12-20`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/evidence/evidenceRoutes.ts#L12-L20)
* **Path Parameters**: `id` (e.g. `EVID-TEL-00001`).
* **Response**: `200 OK` with `{ "data": IEvidence }` or `404 Not Found`.

---

## 7. AI Assessment Endpoints (`/api/assessments`)

### `GET /api/assessments/anomaly/:anomalyId`
* **File Reference**: [`backend/src/modules/assessments/assessmentRoutes.ts:7-15`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/assessments/assessmentRoutes.ts#L7-L15)
* **Path Parameters**: `anomalyId` (string).
* **Response**: `200 OK` with `{ "data": IAIAssessment }` or `404 Not Found`.

---

### `POST /api/assessments/generate/:anomalyId`
* **File Reference**: [`backend/src/modules/assessments/assessmentRoutes.ts:17-31`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/assessments/assessmentRoutes.ts#L17-L31)
* **Path Parameters**: `anomalyId` (string).
* **Side Effects**: Calls Google Gemini API (or runs deterministic evidence-grounded fallback) and caches assessment.
* **Response**: `200 OK` with `{ "data": IAIAssessment }`.
* **Errors**: `404 Not Found` if anomaly does not exist, `500 Internal Server Error` if generation fails.

---

## 8. Simulation Endpoints (`/api/simulation`)

### `GET /api/simulation/scenarios`
* **File Reference**: [`backend/src/modules/simulation/simulationRoutes.ts:6-8`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/simulation/simulationRoutes.ts#L6-L8)
* **Response**: `200 OK` with `{ "scenarios": SimulationScenarioConfig[] }`.

---

### `GET /api/simulation/status`
* **File Reference**: [`backend/src/modules/simulation/simulationRoutes.ts:10-12`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/simulation/simulationRoutes.ts#L10-L12)
* **Response**: `200 OK` with `{ "status": { "isRunning": boolean, "currentScenario": string, "targetSatelliteId": string, "ticksGenerated": number } }`.

---

### `POST /api/simulation/start`
* **File Reference**: [`backend/src/modules/simulation/simulationRoutes.ts:14-27`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/simulation/simulationRoutes.ts#L14-L27)
* **Request Body**:
  ```json
  {
    "scenarioId": "thermal-spike",
    "satelliteId": "SG-1",
    "intervalMs": 1000
  }
  ```
* **Response**: `200 OK` with confirmation and status, or `400 Bad Request` if scenario not found.

---

### `POST /api/simulation/stop`
* **File Reference**: [`backend/src/modules/simulation/simulationRoutes.ts:29-32`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/simulation/simulationRoutes.ts#L29-L32)
* **Response**: `200 OK` with confirmation and status.

---

## 9. Space Weather Endpoints (`/api/space-weather`)

### `GET /api/space-weather/current`
* **File Reference**: [`backend/src/modules/space-weather/spaceWeatherRoutes.ts:6-9`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/space-weather/spaceWeatherRoutes.ts#L6-L9)
* **Controller/Service**: `SpaceWeatherService.getSpaceWeather()`
* **Response**: `200 OK` with:
  ```json
  {
    "data": {
      "source": "NOAA SWPC Live",
      "retrievedAt": "2026-09-26T12:00:00.000Z",
      "kpIndex": 2.33,
      "geomagneticStormLevel": "G0 (Quiet/Unsettled)",
      "solarRadiationLevel": "S0 (Normal)",
      "radioBlackoutLevel": "R0 (Normal)",
      "status": "live"
    }
  }
  ```

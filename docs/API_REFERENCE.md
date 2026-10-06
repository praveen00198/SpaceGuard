# SpaceGuard AI — API Reference

## Base URL

```
http://localhost:3001/api
```

## Endpoints

### Satellites

| Method | Path | Description |
|--------|------|-------------|
| GET | `/satellites` | List all satellites |
| GET | `/satellites/:id` | Get satellite details |
| POST | `/satellites` | Create satellite |
| PUT | `/satellites/:id` | Update satellite |

### Telemetry

| Method | Path | Description |
|--------|------|-------------|
| GET | `/telemetry` | Query telemetry (with filters) |
| GET | `/telemetry/:satelliteId` | Get telemetry for a satellite |
| GET | `/telemetry/:satelliteId/latest` | Get latest readings |
| POST | `/telemetry` | Ingest telemetry reading(s) |

#### Query Parameters (GET /telemetry)
| Param | Type | Description |
|-------|------|-------------|
| satelliteId | string | Filter by satellite |
| parameter | string | Filter by parameter name |
| startTime | ISO 8601 | Start of time range |
| endTime | ISO 8601 | End of time range |
| limit | number | Max results (default 1000) |

### Anomalies

| Method | Path | Description |
|--------|------|-------------|
| GET | `/anomalies` | List anomalies (with filters) |
| GET | `/anomalies/:id` | Get anomaly details |
| PATCH | `/anomalies/:id/status` | Update anomaly status |

#### Query Parameters (GET /anomalies)
| Param | Type | Description |
|-------|------|-------------|
| satelliteId | string | Filter by satellite |
| status | string | Filter by status (active/resolved) |
| severity | string | Filter by severity |
| limit | number | Max results |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/:satelliteId` | Get current health snapshot |
| GET | `/health/:satelliteId/history` | Get health history |

### Environment

| Method | Path | Description |
|--------|------|-------------|
| GET | `/environment/current` | Get current space weather |
| GET | `/environment/events` | Get recent environmental events |
| GET | `/environment/kp-index` | Get current Kp index |

### Orbital

| Method | Path | Description |
|--------|------|-------------|
| GET | `/orbital/:satelliteId` | Get orbital data |

### Evidence

| Method | Path | Description |
|--------|------|-------------|
| GET | `/evidence/:id` | Get evidence record |
| GET | `/evidence` | Query evidence (with filters) |

### Assessments

| Method | Path | Description |
|--------|------|-------------|
| POST | `/assessments` | Request AI assessment |
| GET | `/assessments/:id` | Get assessment result |
| GET | `/assessments` | List assessments |

### Simulation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/simulation/start` | Start simulation scenario |
| POST | `/simulation/stop` | Stop simulation |
| GET | `/simulation/status` | Get simulation status |
| GET | `/simulation/scenarios` | List available scenarios |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/system/health` | System health check |
| GET | `/system/data-sources` | List data source status |

## WebSocket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe:telemetry` | `{ satelliteId }` | Subscribe to live telemetry |
| `unsubscribe:telemetry` | `{ satelliteId }` | Unsubscribe |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `telemetry:update` | `TelemetryReading` | New telemetry reading |
| `anomaly:detected` | `Anomaly` | New anomaly detected |
| `health:update` | `HealthSnapshot` | Health score changed |
| `environment:update` | `EnvironmentalEvent` | New environmental event |

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid satellite ID format",
    "details": []
  }
}
```

## HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable (external dependency down) |

# SpaceGuard AI — Observability

## Structured Logging

All services use JSON-structured logging:

```json
{
  "timestamp": "2026-09-25T10:32:00Z",
  "level": "info",
  "service": "backend",
  "module": "telemetry",
  "message": "Telemetry ingested",
  "satelliteId": "SAT-001",
  "recordCount": 100
}
```

## Tracked Events

| Category | Events |
|----------|--------|
| API | Request received, response sent, validation error, rate limit hit |
| Telemetry | Ingestion success/failure, parsing error, quality flag |
| Anomaly | Detection triggered, severity, detection method |
| External API | Request sent, response received, failure, timeout, cache hit |
| ML | Inference request, response, latency, error |
| AI | Assessment request, response, latency, grounding check, failure |
| WebSocket | Connection, disconnection, subscription |
| Database | Connection, query error, slow query |

## Security
- Never log API keys or secrets
- Never log raw authentication tokens
- Sanitize PII if ever present

## Log Levels
- `error` — Failures requiring attention
- `warn` — Degraded operation (cached data, retries)
- `info` — Normal operations (ingestion, detection)
- `debug` — Detailed diagnostic information (dev only)

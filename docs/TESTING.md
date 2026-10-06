# SpaceGuard AI — Testing Strategy

## Overview

Testing covers backend, ML, AI, frontend, and end-to-end workflows.

## Backend Tests

### Unit Tests
- Service module functions (health calculation, anomaly scoring, evidence generation)
- Utility functions (unit conversion, timestamp normalization)
- Schema validation

### Integration Tests
- API endpoint request/response
- Database operations
- External API client (with mocked responses)
- WebSocket events

### Validation Tests
- Zod schema validation (valid and invalid inputs)
- Edge cases (null, undefined, empty, very large values)

## ML Tests

### Preprocessing Tests
- Data loading from different formats
- Feature computation accuracy
- Normalization correctness
- Missing value handling

### Model Tests
- Training completes without error
- Inference produces valid scores (0-1 range)
- Reproducibility (same seed → same results)

### Evaluation Tests
- Metric computation (precision, recall, F1)
- Results match expected on known inputs

## AI Tests

### Structured Output Tests
- Output conforms to expected JSON schema
- All required fields present

### Evidence Grounding Tests
- Every claim references valid evidence IDs
- No fabricated evidence IDs in output
- Unsupported claims are flagged

### Failure Tests
- Gemini unavailable → graceful fallback
- Timeout → appropriate error response
- Invalid response → error handling

## Frontend Tests

### Component Tests
- Rendering with valid data
- Loading states
- Error states
- Empty states

### Interaction Tests
- User actions produce expected state changes
- Form validation feedback

## Required Test Scenarios

| # | Scenario | Expected Result |
|---|----------|----------------|
| 1 | Normal telemetry | No anomaly detected |
| 2 | Temperature spike | Anomaly detected (rule + statistical + ML) |
| 3 | Temperature drift | Trend anomaly detected |
| 4 | Sensor dropout | Sensor anomaly / missing data flagged |
| 5 | Space weather + telemetry anomaly | Temporal correlation reported (NOT causal) |
| 6 | Telemetry anomaly without environmental event | "Environmental relationship unsupported" |
| 7 | NOAA unavailable | System continues; "Environmental data unavailable" |
| 8 | Gemini unavailable | ML + anomaly engine continues; "AI unavailable" |
| 9 | Multiple anomalies | Multiple investigation items created |
| 10 | Missing telemetry | "Insufficient evidence" (no fabricated conclusions) |

## Test Infrastructure

- **Backend**: Jest + Supertest
- **ML**: pytest
- **Frontend**: Vitest + React Testing Library
- **E2E**: Playwright (future)

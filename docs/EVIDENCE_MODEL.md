# SpaceGuard AI — Evidence Model

## Purpose

The evidence system ensures every significant observation, detection, and assessment is traceable to source data. Evidence is the bridge between raw data and AI reasoning.

## Evidence Lifecycle

```
Data Source → Observation → Evidence Record → Evidence Package → AI Assessment → Human Investigation
```

## Evidence Generation

Evidence is generated automatically when:

| Trigger | Evidence Source | Example |
|---------|---------------|---------|
| Telemetry exceeds threshold | `telemetry` | "Temperature 58.4°C exceeds threshold 55°C" |
| Statistical anomaly detected | `anomaly` | "Z-score 3.2 exceeds 3σ threshold" |
| ML anomaly score high | `anomaly` | "Isolation Forest score 0.91" |
| Space weather event | `environment` | "Kp index reached 7 (major storm)" |
| Orbital event | `orbit` | "Satellite entering South Atlantic Anomaly" |
| Historical match | `historical` | "Similar thermal drift observed on 2026-01-15" |

## Evidence Record Structure

```json
{
  "evidenceId": "EV-001",
  "source": "telemetry",
  "sourceId": "SAT-001-TEMP-SENSOR-1",
  "timestamp": "2026-09-25T10:32:00Z",
  "parameter": "temperature",
  "value": 58.4,
  "baseline": 46.8,
  "unit": "C",
  "description": "Temperature reading 11.6°C above baseline",
  "createdAt": "2026-09-25T10:32:01Z"
}
```

## Evidence-to-Claim Mapping

Every AI claim must map to evidence:

```json
{
  "claim": "Battery voltage has dropped below operational threshold",
  "evidenceIds": ["EV-003", "EV-004"],
  "grounded": true
}
```

Ungrounded claims (no evidence IDs) are flagged during validation.

## Evidence Quality

| Quality | Criteria |
|---------|---------|
| **Strong** | Multiple independent sources confirm the observation |
| **Moderate** | Single reliable source with consistent historical context |
| **Weak** | Single source, no historical context, possible measurement error |
| **Insufficient** | Evidence is missing or contradictory |

## Evidence Validation

Before including evidence in an AI assessment:
1. Verify evidence ID exists in the database
2. Verify timestamp is within relevant time window
3. Verify source is accessible and data quality is acceptable
4. Flag stale evidence (source not updated recently)

## Evidence in the UI

Investigation page shows:
- Each evidence item with source, timestamp, and description
- Links between claims and evidence
- Visual indicators for evidence quality
- Source provenance for each evidence item

# SpaceGuard AI — Data Pipeline

## Overview

The data pipeline transforms raw data from heterogeneous sources into normalized canonical telemetry for storage, analysis, and visualization.

## Pipeline Stages

```
Raw Source
    ↓
Parser (source-specific)
    ↓
Validation (schema check)
    ↓
Normalization (field mapping)
    ↓
Unit Conversion (to SI/canonical units)
    ↓
Timestamp Normalization (to UTC ISO 8601)
    ↓
Quality Checks (range, consistency, freshness)
    ↓
Canonical Telemetry
    ↓
Storage (MongoDB)
```

## Source-Specific Parsers

### NASA SMAP/MSL Parser
- **Input**: `.npy` files (one per channel)
- **Mapping**: Channel ID → parameter name (via mapping file)
- **Timestamp**: Synthetic (index-based, no absolute timestamps in source)
- **Labels**: Loaded from `labeled_anomalies.csv`
- **Quality**: Set to `valid` (dataset is curated)

### OPS-SAT Parser
- **Input**: CSV files (`segments.csv`, `dataset.csv`)
- **Mapping**: Column headers → canonical parameters
- **Timestamp**: From segment metadata
- **Quality**: Set to `valid` (ground-truth annotated)

### SatNOGS Parser
- **Input**: JSON from SatNOGS DB API
- **Mapping**: Decoder-specific field mapping (varies per satellite)
- **Timestamp**: From observation timestamp
- **Quality**: `valid` or `suspect` based on decoder confidence

### Simulator Parser
- **Input**: Generated telemetry objects
- **Mapping**: Direct (simulator outputs canonical format)
- **Timestamp**: Simulation clock
- **Quality**: Set to `valid`

## Validation Rules

| Check | Description | Action on Failure |
|-------|-------------|-------------------|
| Required fields | satelliteId, timestamp, parameter, value present | Reject record |
| Timestamp validity | Parseable ISO 8601, not in future | Reject record |
| Value type | Numeric, not NaN/Infinity | Mark quality as `suspect` |
| Parameter known | Parameter exists in satellite configuration | Log warning |
| Unit consistency | Unit matches expected for parameter | Flag for review |
| Duplicate check | Same satellite + parameter + timestamp | Skip duplicate |

## Unit Conversion

| Parameter Type | Source Units | Canonical Unit |
|---------------|-------------|----------------|
| Temperature | °F, K | °C |
| Voltage | mV | V |
| Current | mA | A |
| Angle | rad | deg |
| Power | mW | W |
| Pressure | psi, bar | Pa |

## Quality Checks

| Check | Description | Quality Assignment |
|-------|-------------|-------------------|
| Range check | Value within physical bounds | `suspect` if out of range |
| Freshness | Timestamp within expected window | `stale` if too old |
| Flatline | Same value repeated > threshold | `suspect` |
| Gap detection | Missing expected readings | `missing` |
| Interpolation | Value was interpolated | `interpolated` |

## Provenance Tracking

Every batch of ingested data creates a provenance record:

```json
{
  "datasetId": "NASA-SMAP-MSL",
  "source": "NASA JPL",
  "retrievedAt": "2026-09-25T00:00:00Z",
  "sourceVersion": "telemanom-v1",
  "license": "Public Domain",
  "checksum": "sha256:...",
  "preprocessingVersion": "v1",
  "recordCount": 135000,
  "notes": "Initial ingestion of SMAP channels P-1 through P-55"
}
```

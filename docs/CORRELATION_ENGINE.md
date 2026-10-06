# SpaceGuard AI — Correlation Engine

## Purpose

The correlation engine identifies relationships between anomalies and contextual data. It explicitly distinguishes correlation from causation.

## Inputs

| Input | Source | Description |
|-------|--------|-------------|
| Telemetry anomalies | Anomaly Engine | Currently detected anomalies |
| Historical anomalies | Database | Past anomalies for the satellite |
| Orbital context | CelesTrak | Satellite position, orbit type |
| Space weather | NOAA SWPC / NASA DONKI | Geomagnetic activity, solar events |
| Mission context | Satellite metadata | Subsystem configuration, mission phase |

## Correlation Types

### 1. Temporal Overlap
Two events occurring within a configurable time window.

```json
{
  "relationship": "temporal_overlap",
  "sourceEvent": "ANM-001 (thermal drift)",
  "contextEvent": "Kp index 7 (major geomagnetic storm)",
  "timeGap": "45 minutes",
  "confidence": 0.71,
  "causalEvidence": false,
  "note": "Temporal proximity does not establish causation"
}
```

### 2. Parameter Relationship
Correlated changes across related telemetry parameters.

```json
{
  "relationship": "parameter_correlation",
  "parameters": ["battery_voltage", "battery_current"],
  "correlation": -0.85,
  "window": "30 minutes",
  "interpretation": "Voltage decrease correlates with current increase"
}
```

### 3. Subsystem Relationship
Anomalies affecting related subsystems.

```json
{
  "relationship": "subsystem_coupling",
  "subsystems": ["power", "thermal"],
  "anomalyIds": ["ANM-001", "ANM-002"],
  "note": "Power and thermal subsystems are physically coupled"
}
```

### 4. Historical Similarity
Current anomaly matches patterns from past events.

```json
{
  "relationship": "historical_similarity",
  "currentAnomaly": "ANM-001",
  "historicalAnomaly": "ANM-045",
  "similarity": 0.82,
  "matchedFeatures": ["temperature_drift_rate", "deviation_magnitude"],
  "resolution": "Heater control recalibrated"
}
```

### 5. Environmental Overlap
Anomaly timing overlaps with environmental conditions.

```json
{
  "relationship": "environmental_overlap",
  "anomaly": "ANM-001",
  "environmentalCondition": "South Atlantic Anomaly passage",
  "temporalOverlap": true,
  "note": "Satellite was in SAA region during anomaly window"
}
```

## Important: Correlation ≠ Causation

The correlation engine NEVER claims causation. It reports:
- Whether events overlap temporally
- Statistical correlation coefficients
- Historical similarity scores

The output explicitly states:
```json
{
  "causalEvidence": false,
  "note": "Correlation reported; causal determination requires further investigation"
}
```

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `temporalWindow` | 60 min | Time window for temporal overlap |
| `correlationThreshold` | 0.5 | Minimum correlation coefficient to report |
| `similarityThreshold` | 0.7 | Minimum historical similarity to report |
| `maxHistoricalResults` | 5 | Maximum historical matches to return |

# SpaceGuard AI — Telemetry

## Telemetry Lifecycle

```
Source → Ingestion → Validation → Normalization → Storage → Retrieval → Visualization
```

## Telemetry Sources

| Source | Type | Update Pattern |
|--------|------|----------------|
| Synthetic generator | Simulated | Configurable (1-60s intervals) |
| NASA SMAP/MSL | Historical dataset | Batch import |
| OPS-SAT AD | Historical dataset | Batch import |
| SatNOGS | Near-real-time | Observation-dependent (opportunistic) |

## Canonical Telemetry Parameters

### Power Subsystem
| Parameter | Unit | Typical Range | Description |
|-----------|------|---------------|-------------|
| battery_voltage | V | 3.0–4.2 | Battery bus voltage |
| battery_current | A | 0–5 | Battery charge/discharge current |
| solar_panel_voltage | V | 0–30 | Solar array voltage |
| solar_panel_current | A | 0–3 | Solar array current |
| power_consumption | W | 0–100 | Total power consumption |

### Thermal Subsystem
| Parameter | Unit | Typical Range | Description |
|-----------|------|---------------|-------------|
| temperature | °C | -40 to +85 | Component temperature |
| heater_status | — | 0/1 | Heater on/off state |
| thermal_gradient | °C/min | -2 to +2 | Temperature rate of change |

### Communication Subsystem
| Parameter | Unit | Typical Range | Description |
|-----------|------|---------------|-------------|
| signal_strength | dBm | -120 to -40 | Received signal strength |
| packet_loss_rate | % | 0–100 | Communication packet loss |
| link_latency | ms | 0–2000 | Round-trip communication delay |
| data_rate | bps | 0–115200 | Current data transmission rate |

### Attitude Subsystem
| Parameter | Unit | Typical Range | Description |
|-----------|------|---------------|-------------|
| roll | deg | -180 to +180 | Roll angle |
| pitch | deg | -90 to +90 | Pitch angle |
| yaw | deg | -180 to +180 | Yaw angle |
| angular_velocity | deg/s | 0–10 | Rotation rate |

### Payload
| Parameter | Unit | Typical Range | Description |
|-----------|------|---------------|-------------|
| payload_temperature | °C | -20 to +60 | Payload instrument temperature |
| payload_power | W | 0–50 | Payload power consumption |

## Data Quality

Every telemetry reading carries a quality indicator:

| Quality | Meaning |
|---------|---------|
| `valid` | Normal, verified reading |
| `suspect` | Possible measurement error or out-of-range |
| `interpolated` | Value was interpolated from neighbors |
| `missing` | Expected reading was not received |
| `stale` | Reading is older than expected update interval |

## Retention Policy

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| High-resolution telemetry | 30 days | Storage efficiency |
| Downsampled telemetry | 1 year | Trend analysis |
| Anomaly-related telemetry | Indefinite | Investigation reference |
| Simulation telemetry | Session-based | Temporary by nature |

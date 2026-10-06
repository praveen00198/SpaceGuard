# SpaceGuard AI — Data Sources

## Overview

SpaceGuard integrates data from multiple categories to provide comprehensive satellite health monitoring and anomaly investigation.

## Category A: Historical Spacecraft Telemetry

### NASA SMAP/MSL Dataset
- **Purpose**: ML training and evaluation benchmark
- **Source**: NASA JPL via Telemanom project
- **Content**: 82 anonymized telemetry channels with expert-labeled anomalies
- **Use**: Isolation Forest training, detection baseline measurement
- **Limitations**: Anonymized channels, no subsystem mapping, binary labels only

### ESA OPS-SAT (OPSSAT-AD)
- **Purpose**: Secondary validation with real satellite data
- **Source**: KP Labs / ESA via Zenodo
- **Content**: Real CubeSat bus telemetry segments with ground-truth annotations
- **Use**: Model validation on real-world data
- **Limitations**: CubeSat-specific, segmented format, mission ended 2024

## Category B: Near-Real-Time Telemetry

### SatNOGS
- **Purpose**: Public observation-derived telemetry
- **Source**: Libre Space Foundation
- **Content**: Decoded telemetry frames from crowd-sourced ground stations
- **Use**: Near-real-time satellite monitoring (where decoders exist)
- **Important**: This is observation-dependent, opportunistic telemetry — not continuous real-time feeds. Coverage gaps are expected.

## Category C: Orbital Data

### CelesTrak
- **Purpose**: Orbital context for satellite position and environment
- **Source**: CelesTrak / USSPACECOM
- **Content**: GP/OMM orbital elements (TLE/JSON/CSV)
- **Use**: Orbital Context Layer — determine satellite position, orbit type, potential environmental exposure

## Category D: Space Weather

### NOAA SWPC
- **Purpose**: Current and historical space weather conditions
- **Source**: NOAA Space Weather Prediction Center
- **Content**: Kp index, solar wind, geomagnetic activity, alerts
- **Use**: Environmental Context Layer — correlate anomalies with space weather

### NASA DONKI
- **Purpose**: Discrete space weather events
- **Source**: NASA CCMC
- **Content**: CMEs, solar flares, geomagnetic storms, particle events
- **Use**: Environmental Context Layer — identify significant events near anomaly times

## Category E: Synthetic Data

### SpaceGuard Telemetry Simulator
- **Purpose**: Testing, demonstration, and ML evaluation
- **Source**: Internal generator
- **Content**: Configurable telemetry with fault injection and ground truth
- **Use**: Pipeline testing, demo mode, controlled evaluation scenarios

## Data Flow Summary

```
Historical Datasets ──┐
                      ├──▶ Parser ──▶ Canonical Schema ──▶ MongoDB
SatNOGS API ──────────┤
                      │
Telemetry Simulator ──┘

CelesTrak API ────────────▶ Orbital Context ──▶ MongoDB

NOAA SWPC ────────────┐
                      ├──▶ Environmental Context ──▶ MongoDB
NASA DONKI ───────────┘
```

# SpaceGuard AI

**Evidence-grounded satellite health monitoring and anomaly investigation platform for human operators.**

> AI reasons over evidence; AI does not invent the evidence.

## Overview

SpaceGuard combines satellite telemetry, orbital data, space weather, deterministic health calculations, hybrid anomaly detection (rules + statistics + ML), context correlation, evidence management, and Gemini-based evidence-grounded reasoning — all while maintaining full transparency about what is known, uncertain, and unknown.

The system remains useful even if the AI layer is unavailable.

## Architecture

```
DATA (telemetry, orbital, space weather, historical, synthetic)
    ↓
DATA NORMALIZATION → FEATURE ENGINEERING
    ↓
RULES + STATISTICS + ML (Isolation Forest)
    ↓
HYBRID ANOMALY ENGINE → CORRELATION ENGINE → EVIDENCE LAYER
    ↓
GEMINI AI (structured assessment, evidence-grounded)
    ↓
HUMAN OPERATOR (investigation, decision)
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Recharts, Socket.IO |
| **Backend** | Node.js, TypeScript, Express, MongoDB, Mongoose, Socket.IO |
| **ML Service** | Python, FastAPI, scikit-learn (Isolation Forest), NumPy, Pandas |
| **AI** | Google Gemini (structured output, evidence-grounded) |
| **Database** | MongoDB |

## Features

- 🛰️ **Satellite Fleet Monitoring** — Dashboard with health overview
- 📊 **Telemetry Visualization** — Charts with anomaly markers and thresholds
- 🔍 **Hybrid Anomaly Detection** — Rules + Statistics + ML (Isolation Forest)
- 🌊 **Environmental Context** — NOAA space weather, NASA DONKI events
- 🌍 **Orbital Context** — CelesTrak orbital data
- 📋 **Evidence System** — Every claim traceable to source data
- 🤖 **AI Assessment** — Gemini-powered, evidence-grounded reasoning
- 🔬 **Investigation Page** — Timeline, evidence, context, AI assessment
- 🎮 **Simulation Mode** — Configurable fault injection with ground truth
- 📡 **Real-Time Updates** — WebSocket for live telemetry
- 🧪 **ML Evaluation** — Reproducible experiments with documented metrics

## Repository Structure

```
spaceguard-ai/
├── README.md
├── AGENTS.md              ← Coding guidelines for agents/developers
├── CONTRIBUTING.md
├── CHANGELOG.md
├── LICENSE
├── .env.example           ← Environment configuration template
├── .gitignore
│
├── docs/                  ← 25+ documentation files
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DATASET_CATALOG.md
│   ├── DATA_SCHEMA.md
│   ├── ML_ARCHITECTURE.md
│   ├── AI_ARCHITECTURE.md
│   ├── EVIDENCE_MODEL.md
│   └── ...
│
├── frontend/              ← React + TypeScript + Vite + Tailwind
├── backend/               ← Node.js + TypeScript + Express
├── ml-service/            ← Python + FastAPI + scikit-learn
│
├── data/                  ← Datasets (large files gitignored)
│   ├── raw/
│   ├── processed/
│   ├── synthetic/
│   └── metadata/
│
├── scripts/
│   └── data/              ← Dataset download and generation scripts
│
└── tests/
    └── integration/
```

## Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB 7+

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys:
#   GEMINI_API_KEY (from https://aistudio.google.com/apikey)
#   NASA_API_KEY (from https://api.nasa.gov/)
#   SATNOGS_API_TOKEN (from https://db.satnogs.org/)
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### 3. Backend

```bash
cd backend
npm install
npm run dev          # http://localhost:3001
```

### 4. ML Service

```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5. MongoDB

```bash
mongod --dbpath /data/db
```

## Data Sources

| Source | Type | Status |
|--------|------|--------|
| NASA SMAP/MSL | Historical telemetry + anomaly labels | ✅ Selected |
| ESA OPS-SAT (OPSSAT-AD) | Historical telemetry + annotations | ✅ Selected |
| SatNOGS | Near-real-time observation-derived telemetry | ✅ Selected |
| CelesTrak | Orbital data (GP/OMM) | ✅ Selected |
| NOAA SWPC | Space weather (Kp, solar wind) | ✅ Selected |
| NASA DONKI | Space weather events (CME, flares, storms) | ✅ Selected |

See [docs/DATASET_CATALOG.md](docs/DATASET_CATALOG.md) for detailed metadata.

## Data Scripts

```bash
# Download NASA SMAP/MSL dataset
python scripts/data/download_nasa_dataset.py --output data/raw/nasa-smap-msl/

# Download NOAA space weather data
python scripts/data/download_space_weather.py --output data/raw/space-weather/

# Generate synthetic telemetry
python scripts/data/synthetic_telemetry.py --scenario thermal_spike --output data/synthetic/
```

## Testing

```bash
# Backend
cd backend && npm test

# ML Service
cd ml-service && pytest tests/

# Synthetic telemetry generator
pytest tests/integration/test_synthetic_telemetry.py
```

## Simulation Mode

Run fault injection scenarios:

| Scenario | Description |
|----------|-------------|
| `normal` | Stable operation — no anomalies |
| `thermal_spike` | Sudden temperature increase |
| `thermal_drift` | Gradual temperature rise |
| `battery_degradation` | Declining battery voltage |
| `voltage_drop` | Sudden voltage decrease |
| `sensor_dropout` | Sensor stops reporting |
| `sensor_flatline` | Sensor reports constant value |
| `oscillation` | Periodic value oscillation |
| `variance_change` | Signal variance increases |

## Development Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **0** | Foundation, research, architecture | ✅ Complete |
| **1** | Data pipeline, normalization | 🔜 Next |
| **2** | Satellite + telemetry + simulation | ⬜ Planned |
| **3** | Health engine + anomaly detection | ⬜ Planned |
| **4** | External context + correlation | ⬜ Planned |
| **5** | Gemini AI integration | ⬜ Planned |
| **6** | Investigation experience | ⬜ Planned |
| **7** | Validation + testing | ⬜ Planned |

## Key Principles

1. **Evidence over invention** — AI reasons over evidence, never fabricates it
2. **Semantic separation** — Anomaly scores ≠ fault probabilities ≠ health scores
3. **Graceful degradation** — System works without AI, without external APIs
4. **Source transparency** — Every data point shows source and timestamp
5. **No false claims** — Performance metrics come from experiments, not assumptions

## Limitations

- ML model (Isolation Forest) is not yet trained — Phase 3
- Gemini integration is not yet implemented — Phase 5
- External API integrations are placeholder — Phase 4
- SatNOGS provides opportunistic, observation-dependent data, not continuous feeds
- No autonomous spacecraft commanding capability

## Research References

- Hundman et al., "Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding," KDD 2018
- Health Monitoring of a Satellite System (analytical redundancy approach — documented as future research direction)

See [docs/RESEARCH_NOTES.md](docs/RESEARCH_NOTES.md) for details.

## License

MIT License — see [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

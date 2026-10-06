# SpaceGuard AI — System Architecture

## Overview

SpaceGuard is an evidence-grounded satellite health monitoring and anomaly investigation platform. The architecture follows a layered responsibility model where each layer has a clear, non-overlapping role.

## Responsibility Model

```
                    SPACEGUARD AI

DATA
 │
 ├── Telemetry (real, historical, synthetic)
 ├── Orbital data (CelesTrak)
 ├── Space weather (NOAA SWPC, NASA DONKI)
 ├── Historical data (NASA SMAP/MSL, OPS-SAT)
 └── Synthetic data (generator)
          │
          ▼
   DATA NORMALIZATION
          │
          ▼
   FEATURE ENGINEERING
          │
     ┌────┼────┐
     ▼    ▼    ▼
   RULES STATS ML
     │    │    │
     └────┼────┘
          ▼
    ANOMALY ENGINE
          │
          ▼
   CORRELATION ENGINE
          │
          ▼
     EVIDENCE LAYER
          │
          ▼
       GEMINI AI
          │
          ▼
 STRUCTURED ASSESSMENT
          │
          ▼
   HUMAN OPERATOR
```

### Layer Responsibilities

| Layer | Question Answered |
|-------|-------------------|
| Data | What happened? |
| Rules / Statistics | Does this violate expected behaviour? |
| ML | Does this pattern look abnormal? |
| Correlation | What other relevant events occurred? |
| Evidence | What facts support this observation? |
| Gemini | How can evidence be explained to the operator? |
| Human | What should be investigated or decided? |

## System Components

### Frontend (Port 5173)

```
React + TypeScript + Vite + Tailwind CSS
├── Dashboard — fleet overview, health, active anomalies
├── Satellite Detail — metadata, orbit, health, subsystems
├── Telemetry Explorer — parameter selection, charts, anomaly markers
├── Anomaly Center — active anomalies, severity, detection method
├── Investigation Page — timeline, evidence, context, AI assessment
└── Simulation Control — scenario selection, pipeline observation
```

**Rules:**
- No business logic in components
- API calls through service layer
- WebSocket for real-time telemetry updates
- All data displays source and timestamp

### Backend (Port 3001)

```
Node.js + TypeScript + Express
├── modules/
│   ├── satellites/       — satellite CRUD, metadata
│   ├── telemetry/        — ingestion, storage, retrieval
│   ├── health/           — deterministic health calculations
│   ├── anomalies/        — hybrid anomaly engine
│   ├── space-weather/    — NOAA SWPC, NASA DONKI integration
│   ├── orbital/          — CelesTrak orbital data
│   ├── correlation/      — context correlation engine
│   ├── evidence/         — evidence generation and management
│   ├── assessments/      — Gemini AI integration
│   ├── simulation/       — synthetic telemetry and scenarios
│   └── data-sources/     — external data source management
├── middleware/            — auth, validation, error handling, logging
├── config/               — environment, database, external APIs
└── shared/               — types, utilities, constants
```

**Rules:**
- Business logic in services, not route handlers
- Zod validation on all inputs
- Structured JSON logging
- Centralized error handling
- Gemini API keys server-side only

### ML Service (Port 8000)

```
Python + FastAPI
├── api/          — prediction and evaluation endpoints
├── models/       — Isolation Forest and future models
├── preprocessing/ — data cleaning, normalization
├── features/     — feature engineering pipelines
├── inference/    — model inference service
└── evaluation/   — metrics, experiment tracking
```

**Rules:**
- Clean API contract with backend
- No direct database access (receives data via API)
- Feature engineering is reusable and parameter-aware
- Model evaluation is reproducible

### Database (MongoDB)

Collections:
- `satellites` — satellite metadata
- `telemetryReadings` — time-series telemetry (indexed: satelliteId + timestamp + parameter)
- `anomalies` — detected anomalies
- `healthSnapshots` — subsystem and overall health
- `environmentalEvents` — space weather events
- `orbitalSnapshots` — orbital state
- `evidence` — evidence records
- `aiAssessments` — Gemini AI assessment results
- `simulationScenarios` — simulation configurations
- `datasetMetadata` — data provenance records

## Data Flow

### Telemetry Ingestion

```
Source (SatNOGS / Simulator / Dataset)
    │
    ▼
Parser (source-specific)
    │
    ▼
Validation (Zod schema)
    │
    ▼
Normalization (canonical schema)
    │
    ▼
Unit Conversion
    │
    ▼
Quality Check
    │
    ▼
MongoDB Storage
    │
    ├──▶ WebSocket → Frontend (real-time)
    └──▶ Anomaly Engine (detection pipeline)
```

### Anomaly Detection Pipeline

```
Telemetry Reading
    │
    ▼
Feature Engineering
    │
    ├──▶ Rule Engine (thresholds, rate-of-change)
    ├──▶ Statistical Engine (z-score, EWMA, change-point)
    └──▶ ML Engine (Isolation Forest via ML service)
    │
    ▼
Hybrid Anomaly Engine (combines results)
    │
    ▼
Anomaly Record (with detection method, score, severity)
    │
    ├──▶ Evidence Generation
    ├──▶ Correlation Engine
    └──▶ WebSocket → Frontend
```

### AI Assessment Pipeline

```
Anomaly + Context
    │
    ▼
Evidence Package Assembly
    │  ├── Satellite state
    │  ├── Telemetry summary
    │  ├── Anomaly results (all detection methods)
    │  ├── Historical similar anomalies
    │  ├── Space weather context
    │  ├── Orbital context
    │  └── Evidence IDs
    │
    ▼
Gemini API (structured output)
    │
    ▼
Structured Assessment
    │  ├── Priority
    │  ├── Summary
    │  ├── Evidence-linked claims
    │  ├── Possible causes
    │  ├── Known / Unknown / Cannot determine
    │  ├── Uncertainty statement
    │  └── Recommended investigation steps
    │
    ▼
Frontend (Investigation Page)
```

## External API Integration

| Source | Type | Update Frequency | Auth Required |
|--------|------|-------------------|---------------|
| NOAA SWPC | Space weather | 1-min to 3-hour | No |
| NASA DONKI | Space weather events | Event-driven | API key (free) |
| CelesTrak | Orbital data (GP/OMM) | 1-2x daily | No |
| SatNOGS DB | Satellite telemetry | Observation-dependent | API token |
| Gemini | AI reasoning | On-demand | API key |

## Security Boundaries

```
┌─────────────────────────────────┐
│           FRONTEND              │
│   (No API keys, no secrets)     │
└──────────────┬──────────────────┘
               │ HTTP / WebSocket
┌──────────────▼──────────────────┐
│           BACKEND               │
│   (API keys, DB access,        │
│    Gemini calls, validation)    │
├──────────────┬──────────────────┤
│   ML SERVICE │                  │
│   (No external API access)     │
└──────────────┴──────────────────┘
               │
┌──────────────▼──────────────────┐
│         MONGODB                 │
│   (localhost only in dev)       │
└─────────────────────────────────┘
```

## Real-Time Architecture

```
Telemetry Source
       │
       ▼
  Ingestion Service
       │
       ▼
     Backend
       │
       ├──▶ MongoDB (persistence)
       ├──▶ Anomaly Engine (detection)
       └──▶ Socket.IO → Frontend (live display)
```

Source types must be clearly distinguished:
- `historical` — past data from datasets
- `near-real-time` — data from SatNOGS (observation-dependent, opportunistic)
- `live` — direct telemetry feed (future capability)
- `simulated` — synthetic telemetry generator

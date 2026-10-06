# AGENTS.md — SpaceGuard AI Coding Guidelines

> This file must be read by any agent or developer before modifying the codebase.

## Architecture Overview

SpaceGuard AI is a monorepo with three main services:

```
frontend/     → React + TypeScript + Vite + Tailwind CSS
backend/      → Node.js + TypeScript + Express + MongoDB
ml-service/   → Python + FastAPI + scikit-learn
```

Supporting directories:

```
docs/         → All documentation
data/         → Datasets, metadata, download scripts (large files gitignored)
scripts/      → Data acquisition, setup, validation, development scripts
tests/        → Integration, e2e, fixtures
```

## Core Principles

### 1. Evidence Over Invention
AI reasons over evidence; AI does not invent evidence. Gemini receives structured evidence packages and must not fabricate telemetry, events, or evidence IDs.

### 2. Semantic Separation
These values are NEVER interchangeable:
- `anomalyScore` — How unusual a pattern is (model output)
- `severity` — Operational impact level
- `faultProbability` — Likelihood of actual fault (requires evidence)
- `causalConfidence` — Strength of causal relationship
- `healthScore` — Deterministic subsystem health calculation

### 3. Graceful Degradation
Every external dependency (Gemini, NOAA, SatNOGS, CelesTrak, MongoDB, ML service) may fail. The system must:
- Continue operating with reduced functionality
- Display honest "unavailable" messages
- Never silently replace failed data with fake data

### 4. Data Provenance
Every dataset must have documented origin, license, retrieval date, and preprocessing version.

### 5. Source Transparency
Every data point shown to the user must indicate its source and timestamp.

## Coding Rules

### TypeScript (Frontend & Backend)
- Strong typing everywhere — avoid `any`
- Use Zod for runtime validation at boundaries
- Use interfaces for data contracts
- Keep business logic in service modules, NOT in route handlers or React components
- No magic numbers — use named constants
- No hardcoded API keys or URLs — use environment variables
- No duplicated schemas — share types where possible

### Python (ML Service)
- Type hints on all functions
- Docstrings for public functions
- Use Pydantic for API schemas
- Keep model logic separate from API routes
- No hardcoded paths — use configuration

### General
- Modular code — each module has clear responsibilities
- Meaningful names — no single-letter variables in business logic
- Error handling at boundaries — catch and transform errors
- Structured logging — use JSON-structured log entries
- No dead code — remove unused imports and functions

## Folder Responsibilities

### `frontend/src/`
```
components/    → Reusable UI components
pages/         → Route-level page components
hooks/         → Custom React hooks
services/      → API client functions
stores/        → State management
types/         → TypeScript type definitions
utils/         → Pure utility functions
constants/     → Application constants
```

### `backend/src/`
```
modules/       → Feature modules (satellites, telemetry, health, anomalies, etc.)
  └── each module has: routes, controllers, services, schemas, models
middleware/    → Express middleware (auth, validation, error handling, logging)
config/       → Application configuration
shared/       → Shared utilities and types
```

### `ml-service/app/`
```
api/           → FastAPI routes
models/        → ML model definitions and training
preprocessing/ → Data preprocessing pipelines
features/      → Feature engineering
inference/     → Model inference service
evaluation/    → Model evaluation framework
```

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files (TS) | camelCase | `telemetryService.ts` |
| Files (React) | PascalCase | `SatelliteCard.tsx` |
| Files (Python) | snake_case | `feature_engineering.py` |
| Interfaces | PascalCase with `I` prefix | `ITelemetryReading` |
| Types | PascalCase | `AnomalyScore` |
| Constants | UPPER_SNAKE_CASE | `MAX_TELEMETRY_POINTS` |
| API routes | kebab-case | `/api/space-weather` |
| Database collections | lowercase plural | `telemetryReadings` |
| Environment variables | UPPER_SNAKE_CASE | `MONGODB_URI` |

## Testing Requirements

- Every service module must have unit tests
- Every API endpoint must have integration tests
- ML models must have evaluation tests with documented metrics
- Frontend components must handle loading, error, and empty states
- AI outputs must be tested for evidence grounding

## Security Rules

- API keys NEVER in frontend code
- API keys NEVER committed to Git
- All user input validated with Zod/Pydantic
- CORS configured to specific origins
- Rate limiting on all public endpoints
- Error responses never expose internal details
- Gemini API called only from backend

## AI Rules

- Gemini receives structured evidence packages only
- Gemini output must be schema-constrained (structured output)
- Gemini must not access raw databases directly
- Gemini failure must not crash the anomaly engine
- AI assessments must reference evidence IDs
- AI uncertainty must be explicitly stated

## Data Rules

- Raw datasets stay in `data/raw/` (gitignored if large)
- Download scripts in `scripts/data/`
- Every dataset needs a provenance record in `data/metadata/`
- Canonical telemetry schema is the single source of truth
- External data must specify source type: `historical`, `near-real-time`, `live`, `simulated`
- Mock/demo data must be explicitly labeled

## Prohibited Shortcuts

- ❌ Hardcoding telemetry data in UI components
- ❌ Using Gemini for anomaly detection or health scoring
- ❌ Treating anomaly score as fault probability
- ❌ Silently replacing failed API responses with fake data
- ❌ Claiming ML accuracy without running experiments
- ❌ Committing large datasets to Git
- ❌ Creating unnecessary microservice architecture
- ❌ Using deep learning without justification from data/evaluation
- ❌ Skipping the evidence layer for AI assessments
- ❌ Inferring causality from temporal correlation alone

## How to Add a New Feature

```
1. Document the feature purpose
2. Design the data flow
3. Implement backend service + schema + routes
4. Implement frontend components + API client
5. Write tests
6. Update documentation
7. Record decisions in docs/DECISIONS.md if significant
```

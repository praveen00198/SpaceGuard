# SpaceGuard AI — Roadmap

## Phase 0: Foundation ✅
- Repository initialization
- Monorepo structure
- Documentation set
- Dataset research and catalog
- Canonical telemetry schema
- Frontend/backend/ML foundation
- Synthetic telemetry generator

## Phase 1: Data Foundation ✅
- Dataset acquisition scripts (NASA SMAP/MSL, NOAA space weather)
- Data normalization pipeline (Canonical normalizer)
- Sample dataset import and provenances
- Data provenance tracking

## Phase 2: Satellite + Telemetry ✅
- Satellite management (CRUD + in-memory store)
- Telemetry ingestion and storage ring buffer
- Telemetry visualization (Recharts streaming charts)
- Simulation mode with fault injection
- WebSocket real-time updates via Socket.IO

## Phase 3: Health + Anomaly ✅
- Deterministic health engine (power, thermal, comm, attitude, payload)
- Rule-based anomaly detection (thresholds, rates, flatlines)
- Statistical anomaly detection (sliding 3-sigma control & z-score)
- Isolation Forest ML service (FastAPI)
- Hybrid anomaly engine combining all methods
- Anomaly persistence and command center UI

## Phase 4: External Context (In Progress)
- NOAA SWPC integration ✅
- NASA DONKI integration
- CelesTrak orbital data
- SatNOGS integration
- Multi-source correlation engine

## Phase 5: Gemini AI ✅
- Evidence package assembly
- Gemini API integration with structured schemas
- Evidence grounding validation (citing valid evidence IDs)
- Epistemological boundaries (known, unknown, cannot determine)
- Graceful degradation and grounded fallback reasoning

## Phase 6: Investigation Experience ✅
- AI Investigation modal and workflow
- Evidence browser and citation badges
- Timeline and contextual telemetry display


## Phase 7: Validation
- Full test suite execution
- ML evaluation experiments
- AI grounding evaluation
- Performance testing
- Security review

---

## Future (Post-MVP)

### Advanced ML
- Autoencoder anomaly detection
- One-Class SVM
- LSTM / GRU temporal models
- Multivariate forecasting

### Fault Diagnosis
- Fault classification
- Fault isolation
- Probabilistic diagnosis

### Research
- Analytical redundancy (per research paper)
- Residual generation
- Model-based fault detection
- Sequential probability methods

### Advanced AI
- Mission documentation RAG
- Incident report retrieval
- Operational procedure lookup

### Advanced Systems
- Physics-informed ML
- Predictive maintenance
- Degradation prediction
- Remaining useful life estimation

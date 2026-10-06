# SpaceGuard AI — Architecture Decisions

## ADR-001: Monorepo Structure

**Date**: 2026-09-25  
**Context**: Need to organize frontend, backend, and ML service  
**Options**: Monorepo vs separate repos  
**Decision**: Monorepo  
**Reason**: Simplifies development workflow, shared types, atomic commits across services  
**Consequences**: Need clear module boundaries; shared `.gitignore` and config

## ADR-002: Isolation Forest as Initial ML Model

**Date**: 2026-09-25  
**Context**: Need unsupervised anomaly detection for telemetry  
**Options**: Isolation Forest, Autoencoder, One-Class SVM, LSTM  
**Decision**: Isolation Forest  
**Reason**: Unsupervised (no labels needed for training), fast, interpretable, proven in industrial settings. Complexity must be justified by data and evaluation — start simple.  
**Consequences**: May miss complex temporal patterns; can upgrade after evaluation

## ADR-003: Separate Python ML Service

**Date**: 2026-09-25  
**Context**: ML code needs scikit-learn, NumPy, Pandas  
**Options**: Python embedded in Node, separate Python service, JavaScript ML  
**Decision**: Separate Python FastAPI service  
**Reason**: Python ML ecosystem is mature; clean API boundary; independently testable  
**Consequences**: Additional service to deploy; inter-service communication overhead

## ADR-004: MongoDB for MVP

**Date**: 2026-09-25  
**Context**: Need a database for telemetry, anomalies, evidence  
**Options**: PostgreSQL, MongoDB, TimescaleDB, InfluxDB  
**Decision**: MongoDB  
**Reason**: Flexible schema for heterogeneous telemetry; good for document-oriented evidence; fast prototyping; can add time-series optimizations later  
**Consequences**: May need migration to TimescaleDB for production-scale time-series queries

## ADR-005: Evidence-Grounded AI (Not Autonomous AI)

**Date**: 2026-09-25  
**Context**: How should AI (Gemini) interact with the system?  
**Options**: AI as primary analyst, AI as evidence interpreter, no AI  
**Decision**: AI as evidence interpreter only  
**Reason**: AI should not invent data or make ungrounded claims. Evidence package constrains AI to reason over supplied facts. System must work without AI.  
**Consequences**: Requires robust evidence generation; structured output schema; grounding validation

## ADR-006: Hybrid Anomaly Detection

**Date**: 2026-09-25  
**Context**: How to combine detection methods?  
**Options**: ML only, rules only, hybrid  
**Decision**: Hybrid (rules + statistics + ML)  
**Reason**: Each method catches different anomaly types. Rules catch threshold violations (deterministic), statistics catch distributional changes, ML catches complex patterns. Agreement increases confidence.  
**Consequences**: More complex system; need to define combination logic

## ADR-007: Tailwind CSS for Frontend

**Date**: 2026-09-25  
**Context**: User specified Tailwind CSS in the requirements  
**Options**: Vanilla CSS, Tailwind CSS, CSS Modules  
**Decision**: Tailwind CSS  
**Reason**: User requirement; rapid prototyping; consistent design tokens; works well with React components  
**Consequences**: Need PostCSS setup; utility-class approach

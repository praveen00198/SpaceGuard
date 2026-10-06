# SpaceGuard AI — Product Requirements Document

## Problem Statement

Satellite operators need to monitor spacecraft health continuously, detect anomalies early, and investigate issues with evidence-grounded reasoning. Current approaches range from manual threshold monitoring to black-box ML systems that provide scores without explanation.

SpaceGuard bridges this gap by combining deterministic health calculations, hybrid anomaly detection (rules + statistics + ML), environmental context correlation, and evidence-grounded AI reasoning — all while maintaining transparency about what is known, what is uncertain, and what cannot be determined.

## Users

### Primary: Satellite Operations Engineers
- Monitor fleet health in real-time
- Investigate anomalies with full context
- Need evidence trails for every alert
- Require understanding of detection method and confidence

### Secondary: Mission Analysts
- Review historical anomaly patterns
- Correlate environmental events with satellite behavior
- Evaluate detection system performance

### Tertiary: System Administrators
- Configure detection thresholds
- Manage data sources
- Monitor system health

## Goals

1. **Detect anomalies** using hybrid methods (rules, statistics, ML)
2. **Provide evidence** for every detection — traceable to source data
3. **Correlate context** — orbital, environmental, historical
4. **Explain findings** using Gemini AI grounded in supplied evidence
5. **Support investigation** with timeline, telemetry, and evidence views
6. **Maintain transparency** — always show source, method, confidence, uncertainty
7. **Degrade gracefully** — work without AI, without external APIs, without ML

## Non-Goals (MVP)

- Autonomous spacecraft commanding
- Real mission-control integration
- Multi-agent AI systems
- Digital twin simulation
- Predictive maintenance / remaining useful life
- Fleet optimization
- Model fine-tuning infrastructure

## MVP Requirements

### Data Foundation
- [ ] Canonical telemetry schema
- [ ] NASA SMAP/MSL dataset integration
- [ ] Synthetic telemetry generator with fault injection
- [ ] Data normalization pipeline
- [ ] Data provenance tracking

### Satellite & Telemetry
- [ ] Satellite management (CRUD)
- [ ] Telemetry ingestion and storage
- [ ] Telemetry visualization with charts
- [ ] Real-time updates via WebSocket
- [ ] Source labeling (historical / simulated / live)

### Health & Anomaly Detection
- [ ] Deterministic health engine (power, thermal, communication, attitude, payload)
- [ ] Rule-based anomaly detection
- [ ] Statistical anomaly detection
- [ ] Isolation Forest anomaly detection (via ML service)
- [ ] Hybrid anomaly engine combining all methods
- [ ] Anomaly persistence and retrieval

### Environmental Context
- [ ] NOAA SWPC space weather integration
- [ ] NASA DONKI event integration
- [ ] CelesTrak orbital data integration
- [ ] Correlation engine (temporal, parameter, subsystem)

### Evidence & AI
- [ ] Evidence generation and management
- [ ] Gemini integration with structured evidence packages
- [ ] Schema-constrained structured output
- [ ] Evidence-grounded AI assessments
- [ ] Graceful AI failure handling

### User Interface
- [ ] Dashboard (fleet overview, health, active anomalies)
- [ ] Satellite detail view
- [ ] Telemetry explorer
- [ ] Anomaly center
- [ ] Investigation page (timeline, evidence, context, AI assessment)
- [ ] Simulation mode

### Quality
- [ ] Backend unit and integration tests
- [ ] ML evaluation framework
- [ ] AI grounding evaluation
- [ ] Frontend component tests
- [ ] Error handling across all external dependencies

## Future Features

See `docs/ROADMAP.md` for the complete future roadmap.

## User Stories

### US-1: Anomaly Detection
> As a satellite operator, I want to see anomalies detected automatically across my fleet so I can prioritize investigation.

### US-2: Investigation
> As a satellite operator, I want to investigate an anomaly with full context (telemetry, history, environment, evidence, AI assessment) so I can understand what happened.

### US-3: Evidence Trail
> As a mission analyst, I want every AI claim linked to specific evidence IDs so I can verify the reasoning.

### US-4: Simulation
> As a developer, I want to run simulation scenarios (thermal spike, battery degradation, etc.) so I can test the entire detection pipeline.

### US-5: Source Transparency
> As a satellite operator, I want to know the source and freshness of every data point so I can assess reliability.

### US-6: Graceful Degradation
> As a satellite operator, I want the system to continue working if the AI service or an external data source goes down.

## Success Criteria

1. System detects injected synthetic anomalies with measurable precision/recall
2. Every AI claim references at least one evidence ID
3. System continues operating when any single external dependency fails
4. Investigation page shows complete context for any anomaly
5. All data sources are labeled with provenance information

# Changelog

All notable changes to SpaceGuard AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Repository initialization with monorepo structure
- Complete documentation set (30+ documents)
- Canonical telemetry schema & normalizer
- Synthetic telemetry generator with fault injection (normal, thermal spike, drift, battery degradation, dropout, comm degradation, compound faults)
- Multi-engine Anomaly Detection:
  - Deterministic Rule Engine (boundary thresholds, rate-of-change limits, sensor flatline)
  - Statistical Engine (sliding window 3-sigma control & rolling z-score)
  - Python FastAPI ML Service with Isolation Forest inference per telemetry parameter
  - Hybrid Anomaly Engine orchestrator uniting all detection methods
- Deterministic Health Calculation Engine with per-subsystem scoring (power, thermal, comm, attitude, payload)
- Space Weather service integrating NOAA SWPC live feeds and cached geomagnetic storm indices
- Evidence Management Service with structured `evidenceId` generation
- Gemini AI Reasoning Engine enforcing Principle 1 (Evidence Over Invention), structured schema output, epistemological separation (known, unknown, cannot determine), and robust fallback
- Real-time WebSocket streaming via Socket.IO for telemetry packets and live anomaly alerts
- Rich Mission Operations Frontend (React 19, TypeScript, Recharts, Tailwind CSS):
  - Mission Dashboard with constellation health, active anomaly metrics, and live NOAA space weather card
  - Telemetry Stream Explorer with multi-subsystem interactive time-series charts and nominal boundary bands
  - Anomaly Command Center with multi-parameter filtering, severity tags, and status workflow
  - AI Deep Investigation modal displaying grounded claims, citation tags, physical interpretations, and controller recommendations
  - Simulation & Fault Injection Lab with interactive scenario execution and real-time packet generation
- Comprehensive test coverage: 12/12 Python Pytest tests and 10/10 Backend Jest unit/integration tests passing

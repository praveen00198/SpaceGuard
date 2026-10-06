# SpaceGuard AI — System Overview

SpaceGuard AI is an evidence-grounded satellite health monitoring and anomaly investigation platform for human operators.

For detailed architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React + TypeScript + Vite + Tailwind CSS                  │
│  Dashboard │ Satellite │ Telemetry │ Anomaly │ Investigation│
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│                        BACKEND                              │
│  Node.js + TypeScript + Express                            │
│  ┌────────┬──────────┬────────┬───────────┬──────────────┐ │
│  │Satellite│Telemetry │ Health │ Anomaly   │ Evidence     │ │
│  │        │          │ Engine │ Engine    │ + AI         │ │
│  └────────┴──────────┴────────┴───────────┴──────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ External API Clients: NOAA │ DONKI │ CelesTrak │SatNOGS│ │
│  └────────────────────────────────────────────────────────┘ │
└───────┬────────────────────────────┬────────────────────────┘
        │                            │
┌───────▼──────────┐    ┌────────────▼────────────┐
│   ML SERVICE     │    │       MONGODB           │
│ Python + FastAPI │    │  Telemetry, Anomalies,  │
│ Isolation Forest │    │  Evidence, Assessments   │
└──────────────────┘    └─────────────────────────┘
```

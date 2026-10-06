# ML Phase 4: Operational Integration, Model Selection & Evidence Packaging

> **Status:** Implemented & Verified  
> **Date:** October 2026  
> **System:** SpaceGuard AI Operational Anomaly Engine & ML Microservice  

---

## 1. Executive Summary

Phase 4 bridges the empirical research from Phase 3B/3C into the operational SpaceGuard AI system. The multi-scale temporal hybrid architecture (Model M4), which emerged as the highest-performing detector across NASA SMAP/MSL benchmarks, is now deployed inside `ml-service/app/`.

In accordance with SpaceGuard AI core principles:
1. **Evidence Over Invention:** Gemini and operators receive deterministically structured evidence packages containing z-scores, rolling baseline medians, moving average divergences, and contributing feature rankings.
2. **Semantic Separation:** Strict invariants are preserved at every stage:
   $$\text{anomalyScore} \neq \text{severity} \neq \text{faultProbability} \neq \text{causalConfidence}$$
3. **Graceful Degradation:** If the ML service, feature buffer, or temporal window encounters an issue, the system degrades to deterministic threshold evaluation without crashing or fabricating telemetry.
4. **Full Backward Compatibility:** The FastAPI ML service endpoints (`/health`, `/models`, `/api/predict`, `/predict`) retain their original schema contracts while supplying enriched evidence metadata payloads.

---

## 2. Architecture & Data Flow

```
[Spacecraft Telemetry Stream]
             │
             ▼
[Node.js Backend: telemetryService]
             │
             ▼
[Node.js Backend: anomalyService]
             │
             ├──► [Threshold Evaluator (Subsystem Rules)]
             │
             └──► [mlEngine.ts (HTTP POST /api/predict/window or /api/predict)]
                                   │
                                   ▼
                   [FastAPI ml-service: main.py]
                                   │
                                   ▼
                   [OperationalHybridEngine (hybrid_engine.py)]
                   ├── Online Ring Buffer (W=30 history per sat/param)
                   ├── First-order Delta & Multi-scale EMA Divergence
                   ├── Isolation Forest Anomaly Scoring
                   └── EvidencePackager (evidence.py)
                                   │
                                   ▼
                   [Response Payload: is_anomaly, anomaly_score, evidence={...}]
                                   │
                                   ▼
[Node.js Backend: anomalyService]
             │
             ├──► Persists Anomaly Record (with deterministic anomalyScore & baseline)
             │
             └──► [EvidenceService.createEvidence]
                                   │
                                   ▼
[Gemini AI Investigation Engine (geminiService.ts)]
             │
             └──► Receives Structured Evidence Package (evidenceIds, zScore, divergence)
                  Outputs Grounded Root-Cause Analysis referencing exact Evidence IDs
```

---

## 3. Operational Model Specifications (Model M4)

### 3.1 Detector Components
The operational engine combines:
- **Baseline Feature Extraction:** Raw parameter magnitude, rate of change ($\Delta x_t = x_t - x_{t-1}$), and multi-scale exponential moving average divergence ($x_t - \text{EMA}_{k}(x)$).
- **Isolation Forest Scorer:** Calibrated against continuous telemetry profiles to calculate multidimensional isolation depth.
- **Statistical Z-Score Anchor:** Rolling baseline window ($W = 30$) computing online median $\mu_{\text{roll}}$ and standard deviation $\sigma_{\text{roll}}$:
  $$z = \frac{x_t - \mu_{\text{roll}}}{\sigma_{\text{roll}} + \epsilon}$$
- **Composite Anomaly Score:**
  $$S_{\text{composite}} = 0.6 \cdot S_{\text{IF}} + 0.4 \cdot \min\left(1.0, \frac{|z|}{4.0}\right)$$

### 3.2 Online State Management
- Built-in ring buffer per `(satellite_id, parameter)` tracking up to 100 historical readings.
- Cold-start handling: Single-point evaluation safely bootstraps from static nominal bounds until dynamic buffer exceeds minimum window ($W \ge 3$).

---

## 4. Evidence Packaging Specification

The evidence package complies with `docs/EVIDENCE_MODEL.md` and generates structured JSON tokens:

```json
{
  "evidenceId": "EV-ML-SATELLITE-01-BATTERY_TEMP-1728148900000",
  "source": "ml_inference_service",
  "category": "anomaly_detection",
  "satelliteId": "SATELLITE-01",
  "parameter": "battery_temp",
  "timestamp": "2026-10-05T22:30:00.000Z",
  "observedValue": 48.7,
  "baselineValue": 24.2,
  "zScore": 4.12,
  "anomalyScore": 0.884,
  "contributingFeatures": [
    { "name": "z_score", "importance": 0.52 },
    { "name": "rate_of_change", "importance": 0.31 },
    { "name": "ema_divergence", "importance": 0.17 }
  ],
  "disclaimer": "anomalyScore is a statistical deviation metric; not fault probability or severity"
}
```

---

## 5. Backend Integration Details

### 5.1 `backend/src/modules/anomalies/mlEngine.ts`
- Calls `POST /api/predict/window` when time-series window data is available, with seamless fallback to `POST /api/predict`.
- Parses both flat fields and the enriched `evidence` token.
- Returns `evidenceMetadata` and `contributingFeatures` alongside standard ML response.

### 5.2 `backend/src/modules/anomalies/anomalyService.ts`
- Correlates ML findings with deterministic subsystem rules.
- Feeds `baselineValue`, `observedValue`, `parameter`, and `unit` directly into `EvidenceService.createEvidence`.
- Injects structured evidence tokens into Gemini investigation context via `geminiService.investigateAnomaly`.

### 5.3 Semantic Separation Invariants
- `anomalyScore` is stored directly on the anomaly record as returned by the ML model.
- `severity` is computed purely by deterministic operational rules (`CRITICAL`, `WARNING`, `INFO`).
- `faultProbability` is never produced by the ML detector or Gemini; operational teams assess fault disposition based on grounded evidence.

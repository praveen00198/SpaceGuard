# SpaceGuard AI — ML Phase 4 Plan
## Operational Model Integration & Evidence Packaging Pipeline

> **Phase:** ML Phase 4  
> **Status:** Plan & Methodology Definition  
> **Scope:** Operationalizing research anomaly models, building the Evidence Packaging Engine, and integrating grounded telemetry evidence with the Node.js backend and Gemini root-cause investigation pipeline.  
> **Core Principle:** **Evidence Over Invention** — Gemini AI acts strictly as an evidence interpreter, never an autonomous anomaly detector or data generator.

---

## 1. Executive Summary & Objectives

Through **Phases 3A, 3B, and 3C**, SpaceGuard AI established rigorous empirical benchmarks on real NASA spacecraft telemetry:
- **Phase 3A:** Built leakage-safe preprocessing, continuous/command separation, and temporal feature representations.
- **Phase 3B:** Evaluated classical statistical baselines (M0, M1), Isolation Forests (M2, M3), and transparent Hybrids (M4), proving that multi-scale temporal features lift event recall to 100% on MSL.
- **Phase 3C:** Evaluated deep sequence models (D1 Forecaster, D2 Autoencoder, D3 Deep Hybrid), confirming that sequence residuals suppress mode-transition false alarms and achieve 0.704 point-adjusted $F_1$.

**Phase 4 Goal:**
Bridge the gap between experimental research models and the operational SpaceGuard AI system:
1. **Operational Model Selection & Packaging:** Embed the proven multi-scale hybrid detector into the production FastAPI ML service (`ml-service/app/`).
2. **Evidence Packaging Engine:** Convert raw model scores, feature deviations, and prediction residuals into structured, traceable evidence records conforming to `docs/EVIDENCE_MODEL.md`.
3. **Backend Anomaly Pipeline Integration:** Connect `backend/src/modules/anomalies/mlEngine.ts` and `anomalyService.ts` to consume enriched ML evidence tokens.
4. **Grounded Gemini AI Interpretation:** Ensure Gemini receives structured evidence packages with explicit evidence IDs, strictly enforcing hallucination-free, evidence-grounded root-cause reasoning.

---

## 2. End-to-End Operational Architecture

```
Telemetry Stream (Simulator / External Feed)
                     │
                     ▼
        Node.js Backend Ingest
        (telemetryService.ts)
                     │
                     ▼
          Multi-Engine Detection
   ┌─────────────────┼─────────────────┐
   ▼                 ▼                 ▼
Rule Engine     Stats Engine       ML Engine (mlEngine.ts)
(Physical)      (Rolling 3σ)           │ HTTP POST /api/predict
                                       ▼
                             FastAPI ML Service
                             (Hybrid Detector M4 / D1)
                                       │
                                       ▼
                             Evidence Packaging Engine
                             (evidence.py)
                                       │
                                       ▼
                             Enriched ML Result
                             (score, threshold, residuals, tokens)
                     │
                     ▼
          Anomaly Aggregation
          (anomalyService.ts)
                     │
         Generates IEvidence Records:
         - EV-TEL (Raw Telemetry)
         - EV-STAT (Statistical Baseline)
         - EV-ML (Model Deviation & Residuals)
                     │
                     ▼
          Grounded Gemini Investigation
          (geminiService.ts)
                     │
                     ▼
      Investigation UI & Operator Dashboard
```

---

## 3. Production Model Selection Rationale

Based on the 40 benchmark experiments executed across Phases 3B and 3C:

| Evaluation Metric | M1 (Temporal Stats) | M3 (Feature IF) | M4 (Hybrid) | D1 (LSTM Forecaster) | D2 (LSTM Autoencoder) | Selected Production Architecture |
|---|---|---|---|---|---|---|
| **MSL Event Recall** | 95.7% | 100.0% | **100.0%** | 100.0% | 65.2% | **M4 Hybrid Multi-Scale Engine** |
| **SMAP Event Recall**| 100.0% | 88.2% | **100.0%** | 100.0% | 100.0% | **M4 Hybrid Multi-Scale Engine** |
| **Median Detection Lag**| 1.0 step | 6.0 steps | **1.0 - 5.0 steps**| 0.0 - 10.0 steps| 45.0 steps | **M4 Hybrid Multi-Scale Engine** |
| **Point Precision** | 0.1844 | 0.1412 | **0.2014 - 0.2337**| 0.2001 | 0.2453 | **M4 Hybrid Multi-Scale Engine** |
| **Throughput (samples/s)**| >1,000,000 | >50,000 | **>180,000** | ~2,600 | ~2,100 | **M4 Hybrid Multi-Scale Engine** |
| **Memory Footprint**| <1 MB | ~4.5 MB | **~4.5 MB** | ~350 MB | ~380 MB | **M4 Hybrid Multi-Scale Engine** |
| **Interpretability** | High | Low | **High (Decomposable)**| Medium | Low | **M4 Hybrid Multi-Scale Engine** |

**Selection Decision:**
The **M4 Multi-Scale Hybrid Detector** is selected for real-time production deployment. It combines:
1. Fast temporal feature extraction: first-order delta, rolling mean/std deviation, and exponential moving average (EMA) divergence.
2. Unsupervised Isolation Forest boundary isolation.
3. Transparent linear score fusion with calibrated thresholds.
4. Exceptional operational throughput (>180,000 samples/sec on CPU) with a tiny 4.5 MB footprint.

---

## 4. Evidence Packaging Engine Specification

The ML service and backend will generate evidence packages with the following verifiable structure:

```json
{
  "evidenceId": "EVID-ML-00042",
  "source": "anomaly",
  "sourceId": "SAT-001:thermal:temp_primary:1772658900",
  "timestamp": "2026-10-05T22:30:00Z",
  "parameter": "temperature",
  "value": 58.4,
  "baseline": 46.8,
  "unit": "C",
  "description": "ML Hybrid Detector: anomaly score 0.88 exceeded threshold 0.32. Residual deviation 2.45σ on rolling window W=30.",
  "metadata": {
    "engine": "M4_Hybrid_Temporal",
    "version": "1.0.0",
    "anomalyScore": 0.88,
    "calibratedThreshold": 0.32,
    "statisticalScore": 0.82,
    "isolationForestScore": 0.94,
    "contributingFeatures": ["rolling_std_deviation", "first_order_delta"],
    "detectionLag": "1 step",
    "isCalibrated": true
  }
}
```

---

## 5. Grounded Gemini AI Prompting & Constraint Verification

Gemini receives the evidence package and must generate assessments strictly constrained to:
1. **Evidence-Claim Grounding:** Every claim must reference one or more `evidenceIds`. Any ungrounded claim is rejected.
2. **Semantic Discipline:**
   - `anomalyScore` = Statistical/empirical deviation magnitude.
   - `severity` = Operational mission impact level (`critical`, `high`, `medium`, `low`).
   - `faultProbability` = Likelihood of physical failure (requires confirming telemetry and physical rules).
   - AI uncertainty must be stated explicitly.
3. **Graceful Fallback:** If Gemini API fails or is unconfigured, the deterministic fallback engine produces an evidence-grounded assessment using the structured evidence items.

---

## 6. Implementation Deliverables

1. **ML Service Upgrade (`ml-service/app/`)**:
   - `ml-service/app/evidence.py`: Evidence packaging utilities.
   - `ml-service/app/hybrid_engine.py`: Production-packaged Multi-Scale Hybrid Detector.
   - Update `ml-service/app/main.py`: Enhance `/api/predict` and add `/api/predict/window` with backward compatibility.
2. **Backend ML Engine Upgrade (`backend/src/modules/anomalies/mlEngine.ts`)**:
   - Consume enriched evidence tokens (`evidenceMetadata`).
   - Pass metadata to `anomalyService.ts`.
3. **Backend Anomaly Service Upgrade (`backend/src/modules/anomalies/anomalyService.ts`)**:
   - Store detailed ML evidence records in `EvidenceService`.
4. **Backend Gemini Assessment Grounding (`backend/src/modules/assessments/geminiService.ts`)**:
   - Verify evidence grounding in prompts and fallbacks.
5. **Automated Testing Suite**:
   - Python unit tests (`ml-service/tests/test_operational_integration.py`).
   - Backend integration tests.
6. **Documentation**:
   - `docs/ML_PHASE_4_PLAN.md` (this file)
   - `docs/ML_PHASE_4_INTEGRATION.md`
   - `docs/ML_PHASE_4_COMPLETION.md`

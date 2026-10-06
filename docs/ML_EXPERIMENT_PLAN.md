# SpaceGuard AI — ML Experiment Plan & Benchmarking Methodology

> **Status:** Planning & Methodology Definition  
> **Notice:** **ML MODEL TRAINING HAS NOT STARTED.**  
> This document details the experimental protocols, data partitioning strategies, baseline comparison framework, and validation metrics for upcoming SpaceGuard AI machine learning experiments. No models have been trained or deployed under this plan.

---

## 1. Experimental Objectives

The goal of the SpaceGuard AI ML experimental program is to systematically compare, benchmark, and evaluate four core anomaly detection paradigms on spacecraft telemetry:

```
                            ANOMALY DETECTION PARADIGMS
   ┌───────────────────┬───────────────────┬───────────────────┬───────────────────┐
   ▼                   ▼                   ▼                   ▼
1. Rule-Based       2. Statistical      3. Isolation Forest  4. Hybrid Engine
   (Deterministic      (3-Sigma, EWMA,     (Unsupervised       (Rule + Stat + ML
    Thresholds)         Z-Score)            Subspace Trees)     Ensemble)
```

The experiments will answer four primary research questions:
1. **Value-Add:** Does unsupervised Isolation Forest identify subtle anomalous patterns (e.g. multi-channel correlation breakdown, slow drift) that hard rules and univariate statistical checks miss?
2. **False Alarm Trade-off:** What is the false positive rate (FPR) of Isolation Forest compared to deterministic rules on nominal spacecraft passes?
3. **Detection Latency:** How quickly after fault inception does each method trigger?
4. **Hybrid Efficacy:** Does combining rule, statistical, and ML scores provide superior precision-recall trade-offs compared to any single technique?

---

## 2. Experimental Data Partitioning & Leakage Prevention

### 2.1 Partitioning Strategy
Telemetry is inherently sequential. Random k-fold cross-validation is **strictly prohibited** because it introduces temporal leakage (using future information to predict past states).

Experiments must adhere to:

```
Telemetry Timeline
├─────────────────────────────────────────┼───────────────────┼───────────────────┐
│              Train Set                  │  Validation Set   │     Test Set      │
│         (60% - 70% of timeline)         │ (15% of timeline) │ (15% of timeline) │
│          Strictly Nominal Only          │ Tuning Thresholds │ Final Benchmark   │
└─────────────────────────────────────────┴───────────────────┴───────────────────┘
```

1. **Strictly Sequential Splits:** Train data occurs chronologically before Validation data, which occurs chronologically before Test data.
2. **Spacecraft Separation (Cross-Platform Generalization):** When evaluating cross-spacecraft transferability, satellite datasets (e.g. SAT-A vs SAT-B) will remain completely segregated in Train vs Test splits.
3. **Purging & Embargo Windows:** A buffer window equal to the maximum rolling feature size ($W = 100$ samples) will separate adjacent splits to prevent window overlap contamination.

### 2.2 Contamination Control
- **Training Set Composition:** Must contain $0.0\%$ injected faults and be scrubbed of confirmed anomalies ($contamination \approx 0$).
- **Test Set Composition:** Preserves realistic operational class imbalance (anomalies $\le 2\% - 5\%$ of total test duration) to accurately measure precision and false discovery rate.

---

## 3. Candidate Methods Under Comparison

| Method ID | Detection Approach | Algorithm / Mechanism | Parameters to Tune | Target Anomaly Types |
| :--- | :--- | :--- | :--- | :--- |
| **M1: Rule-Based** | Deterministic Boundaries | Min/Max physical limits & max rate of change | Threshold margins, rate deltas | Extreme spikes, critical out-of-bound errors |
| **M2: Statistical** | Univariate Control Limits | Rolling 3-Sigma z-score & EWMA drift | Window size ($W \in [10, 30, 60]$), $k_\sigma \in [2.5, 3.5]$ | Variance jumps, Gaussian outliers, step changes |
| **M3: Isolation Forest** | Unsupervised ML | Tree-based path length isolation | $n_{estimators} \in [50, 100, 200]$, $contamination \in [0.01, 0.05]$ | Subspace isolation, correlated anomalies, unusual clusters |
| **M4: Hybrid Ensemble** | Weighted Evidence Fusion | Composite score fusion: $S = \max(S_i) \cdot 0.7 + \bar{S} \cdot 0.3$ | Fusion weights, decision threshold | All anomaly types with cross-method confidence |

---

## 4. Evaluation Metrics Framework

Because spacecraft telemetry exhibits extreme class imbalance (nominal points vastly outnumber anomalous points), standard accuracy ($\frac{TP+TN}{total}$) is meaningless.

The evaluation suite will compute:

### 4.1 Primary Metrics
- **Precision:** $\frac{TP}{TP + FP}$ — Ratio of true alerts to total operator alerts.
- **Recall (Detection Rate):** $\frac{TP}{TP + FN}$ — Proportion of true anomalies captured.
- **$F_1$ Score:** Harmonic mean $\frac{2 \cdot P \cdot R}{P + R}$.
- **$F_2$ Score:** $\frac{5 \cdot P \cdot R}{4 \cdot P + R}$ — Weighs recall twice as heavily as precision (safety-critical bias).
- **False Positive Rate (FPR):** $\frac{FP}{FP + TN}$ — Must satisfy $FPR < 0.005$ on continuous telemetry streams.
- **PR-AUC:** Area Under Precision-Recall Curve (the primary metric under class imbalance).
- **ROC-AUC:** Area Under Receiver Operating Characteristic Curve.

### 4.2 Operational Metrics
- **Mean Detection Latency ($\overline{\Delta t}$):** Average time in seconds from ground-truth fault initiation to the first detector alert.
- **Early Warning Ratio:** Percentage of slowly developing drifts detected prior to reaching critical emergency boundaries.
- **Inference Latency:** Computational time per sample (must comfortably meet real-time streaming constraints $< 50\text{ ms}$).

---

## 5. Experiment Execution Protocol

When Phase 6 execution commences, each experiment will follow this repeatable pipeline:

```
                             EXPERIMENT PIPELINE
┌─────────────────────────┐
│ 1. Data Ingestion       │ → Load benchmark / synthetic dataset from data/
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. Feature Extraction   │ → Compute rolling, differential, & quality features
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. Preprocessing        │ → RobustScaler fit on Train split only; transform Val/Test
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. Model Training       │ → Train Isolation Forest on Train split (unsupervised)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 5. Threshold Tuning     │ → Optimize contamination / threshold on Validation split
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 6. Blind Test & Scoring │ → Generate predictions on Test split; evaluate against Ground Truth
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 7. Experiment Logging   │ → Record parameters, metrics, and PR curves to docs/ML_EVALUATION.md
└─────────────────────────┘
```

---

## 6. Reproducibility & Tracking Metadata

Every experimental run must output an un-forgeable JSON execution manifest:

```json
{
  "experimentId": "EXP-2026-IF-001",
  "timestamp": "2026-09-27T16:00:00Z",
  "dataset": "NASA-SMAP",
  "datasetVersion": "telemanom-v1",
  "modelType": "IsolationForest",
  "hyperparameters": {
    "n_estimators": 100,
    "max_samples": 256,
    "contamination": 0.03,
    "random_state": 42
  },
  "featuresUsed": [
    "value",
    "rolling_mean_30",
    "rolling_std_30",
    "rate_of_change",
    "rolling_z_score"
  ],
  "metrics": {
    "precision": null,
    "recall": null,
    "f1": null,
    "f2": null,
    "pr_auc": null,
    "meanDetectionLatencySec": null,
    "inferenceLatencyMs": null
  },
  "gitCommit": "HEAD",
  "status": "PLANNED"
}
```

---

> **Notice:** **ML MODEL TRAINING HAS NOT STARTED.**  
> This experiment plan defines the scientific protocol for future phases without altering any existing codebase components.

# SpaceGuard AI — ML Evaluation

## Overview

This document defines the evaluation framework for SpaceGuard's anomaly detection models. All results reported here must come from actual experiments — never fabricated.

## Evaluation Framework

### Methods Compared

| Method | Type | Description |
|--------|------|-------------|
| Rule-based | Deterministic | Fixed threshold violations |
| Statistical | Statistical | Z-score, EWMA deviation |
| Isolation Forest | ML | Unsupervised anomaly scoring |
| Hybrid | Combined | All methods combined |

### Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| Precision | TP / (TP + FP) | Fraction of detections that are true anomalies |
| Recall | TP / (TP + FN) | Fraction of true anomalies that are detected |
| F1 Score | 2 × (P × R) / (P + R) | Harmonic mean of precision and recall |
| False Positive Rate | FP / (FP + TN) | Fraction of normal data flagged as anomaly |
| False Negative Rate | FN / (FN + TP) | Fraction of anomalies missed |
| Detection Latency | t_detect - t_anomaly_start | Time from anomaly onset to detection |

### Evaluation Datasets

| Dataset | Role | Labels |
|---------|------|--------|
| NASA SMAP | Primary benchmark | Expert-labeled (binary) |
| NASA MSL | Primary benchmark | Expert-labeled (binary) |
| OPS-SAT AD | Validation | Ground-truth annotated |
| Synthetic (normal) | Negative control | No anomalies (ground truth) |
| Synthetic (faults) | Positive control | Injected faults (ground truth) |

## Experiment Metadata

Every experiment must record:

```json
{
  "experimentId": "EXP-001",
  "timestamp": "2026-09-25T00:00:00Z",
  "dataset": "NASA-SMAP",
  "datasetVersion": "telemanom-v1",
  "featureVersion": "v1",
  "model": "IsolationForest",
  "parameters": {
    "n_estimators": 100,
    "max_samples": 256,
    "contamination": 0.1
  },
  "trainingPeriod": "train split",
  "testPeriod": "test split",
  "metrics": {
    "precision": null,
    "recall": null,
    "f1": null,
    "fpr": null,
    "fnr": null,
    "detectionLatency": null
  },
  "status": "PENDING"
}
```

## Results

> **No experiments have been run yet. Results will be populated after Phase 3 implementation.**

Results will be reported per:
- Dataset
- Method
- Parameter type (where applicable)
- Subsystem (where applicable)

## Baseline Comparisons

| Comparison | Purpose |
|-----------|---------|
| Rules vs. Statistical | Does statistical detection add value over fixed thresholds? |
| Rules vs. ML | Does ML catch anomalies that rules miss? |
| Statistical vs. ML | Are the methods complementary? |
| Hybrid vs. Individual | Does combination improve overall performance? |

## Known Evaluation Limitations

1. **Label quality** — NASA SMAP/MSL labels are binary; nuanced anomaly types are not distinguished
2. **Dataset bias** — Benchmark datasets may not represent all spacecraft types
3. **Synthetic data** — Controlled scenarios may be easier than real-world anomalies
4. **Threshold sensitivity** — Results depend on contamination/threshold settings
5. **Temporal evaluation** — Point-wise metrics may not capture detection timeliness well

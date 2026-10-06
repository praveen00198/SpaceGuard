# SpaceGuard AI — ML Architecture

## Overview

The ML layer provides unsupervised anomaly detection as one component of the hybrid anomaly engine. It does NOT replace rule-based or statistical detection — it complements them.

## Architecture

```
Telemetry Data
    ↓
Feature Engineering
    ↓
Statistical Features (rolling mean, std, rate-of-change, etc.)
    ↓
Isolation Forest
    ↓
Anomaly Score (0-1)
```

## Initial Model: Isolation Forest

### Why Isolation Forest

1. **Unsupervised** — Does not require labeled anomaly data for training
2. **Efficient** — Fast training and inference on tabular features
3. **Interpretable** — Anomaly score has intuitive meaning (how isolated a point is)
4. **Robust** — Works well with high-dimensional data
5. **Proven** — Widely used in industrial anomaly detection

### What Anomaly Score Means

An anomaly score of 0.91 means:
> "The observed feature vector is highly isolated in the feature space — this pattern is unusual compared to training data."

An anomaly score of 0.91 does **NOT** mean:
> "There is a 91% probability that a fault occurred."

### Model Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `n_estimators` | 100 | Number of isolation trees |
| `max_samples` | 256 | Subsample size per tree |
| `contamination` | 0.1 | Expected proportion of anomalies |
| `max_features` | 1.0 | Feature fraction per tree |
| `random_state` | 42 | Reproducibility seed |

### Training Protocol

1. Train on "normal" operational data (train split of SMAP/MSL dataset)
2. Features are computed per parameter per satellite
3. Model is trained per subsystem (one model per subsystem type)
4. Evaluation on test split with labeled anomalies

## Feature Engineering

Features are computed per telemetry parameter:

### Temporal Features
| Feature | Window | Description |
|---------|--------|-------------|
| `value` | — | Current raw value |
| `rolling_mean` | 30 | Moving average |
| `rolling_std` | 30 | Moving standard deviation |
| `rolling_min` | 30 | Moving minimum |
| `rolling_max` | 30 | Moving maximum |
| `rate_of_change` | 1 | First difference |
| `acceleration` | 1 | Second difference |

### Statistical Features
| Feature | Window | Description |
|---------|--------|-------------|
| `z_score` | 100 | Standard deviations from rolling mean |
| `deviation_from_baseline` | — | Absolute difference from parameter baseline |
| `percentile` | 100 | Current value's percentile in window |
| `iqr_position` | 100 | Position relative to interquartile range |

### Quality Features
| Feature | Description |
|---------|-------------|
| `missingness_rate` | Fraction of missing values in window |
| `flatline_duration` | Consecutive identical values |
| `variance_ratio` | Current window variance / baseline variance |

Features are parameter-aware — not all features apply to all parameter types.

## Hybrid Anomaly Engine

```
                 TELEMETRY
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      Rules      Statistics       ML
        │            │            │
        └────────────┼────────────┘
                     ▼
             Hybrid Anomaly Engine
                     │
                     ▼
                  Anomaly
```

### Combination Strategy

| Method | Weight | Description |
|--------|--------|-------------|
| Rule | Binary | Hard threshold violations (definitive) |
| Statistical | 0-1 | Z-score / change-point significance |
| ML (IF) | 0-1 | Isolation Forest anomaly score |

### Decision Logic

```
IF rule_triggered:
    severity = based on threshold exceedance
    confidence = HIGH (deterministic)
    
IF statistical_score > threshold:
    severity = based on deviation magnitude
    confidence = MEDIUM (statistical)
    
IF ml_score > threshold:
    severity = based on score
    confidence = MEDIUM (model-based)
    
IF multiple methods agree:
    severity = MAX(individual severities)
    confidence = HIGH (cross-validated)
```

### Important: Method Agreement ≠ Causality

When rules, statistics, and ML all flag an anomaly, this means:
> "Multiple independent methods agree this pattern is abnormal."

It does NOT mean:
> "A specific fault has been identified with high probability."

## Future Models (Not Implemented in MVP)

| Model | Justification Needed | When to Consider |
|-------|---------------------|------------------|
| Autoencoder | Sufficient training data, multivariate patterns | Phase 3+ |
| One-Class SVM | Comparison with Isolation Forest | Phase 3+ |
| LSTM | Strong temporal dependencies in data | Phase 3+ |
| GRU | Lighter alternative to LSTM | Phase 3+ |
| Temporal Fusion Transformer | Large dataset, complex temporal patterns | Research phase |

Model complexity must be justified by evaluation results, not assumed superiority.

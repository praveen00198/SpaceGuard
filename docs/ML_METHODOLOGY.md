# SpaceGuard AI — ML Methodology

## Problem Formulation

**Task**: Unsupervised multivariate time-series anomaly detection for spacecraft telemetry.

**Formulation**: Given a stream of telemetry readings across multiple parameters and subsystems, identify time points or time windows where the observed patterns deviate significantly from normal operational behavior.

**Key distinction**: This is anomaly detection, not fault diagnosis. The ML layer detects unusual patterns — it does not determine the root cause.

## Assumptions

1. **Normal data is abundant** — Most spacecraft operation is nominal, providing sufficient training data for unsupervised methods.
2. **Anomalies are rare** — Anomalous behavior constitutes a small fraction of total telemetry (typically <15%).
3. **Features capture relevant patterns** — Rolling statistics, rate-of-change, and deviation features capture temporal dynamics relevant to anomaly detection.
4. **Independence across trees** — Isolation Forest's ensemble assumption holds for telemetry feature spaces.
5. **Stationarity within training window** — Normal operational patterns don't shift dramatically during the training period.

## Feature Engineering Methodology

### Feature Selection Rationale

| Feature Category | Rationale |
|-----------------|-----------|
| Rolling statistics | Capture stable vs. volatile behavior |
| Rate of change | Detect sudden transitions |
| Deviation from baseline | Identify drift from expected operating point |
| Variance ratio | Detect changes in signal variability |
| Missingness | Detect sensor/communication issues |

### Window Size Selection

Window sizes are chosen based on telemetry sampling characteristics:
- Short windows (5-10 samples): Fast transient detection
- Medium windows (30 samples): Operational trend detection
- Long windows (100 samples): Baseline drift detection

### Feature Normalization

All features are standardized (zero mean, unit variance) before model input to prevent scale dominance.

## Model Selection Rationale

### Why Isolation Forest over Alternatives

| Criterion | Isolation Forest | DBSCAN | LOF | One-Class SVM |
|-----------|-----------------|--------|-----|---------------|
| Unsupervised | ✓ | ✓ | ✓ | ✓ |
| Scalable | ✓ (sublinear) | ✗ (quadratic) | ✗ (quadratic) | ✗ (cubic) |
| No density estimation | ✓ | ✗ | ✗ | ✗ |
| Handles high dimensions | ✓ | ✗ | ✓ | ✓ |
| Interpretable score | ✓ | ✗ | ✓ | ✓ |
| Fast inference | ✓ | ✗ | ✗ | ✓ |

### Known Limitations

1. **Axis-aligned splits** — Isolation Forest uses axis-aligned random splits, which may miss anomalies in correlated feature subspaces.
2. **No temporal modeling** — Individual predictions are independent; temporal dependencies must be captured in features.
3. **Contamination sensitivity** — The `contamination` parameter directly affects the decision threshold.
4. **Global model** — Does not adapt to local density variations (unlike LOF).
5. **Feature quality dependency** — Model performance is bounded by feature engineering quality.

## Training Protocol

1. **Data preparation**: Load training split, compute features, remove NaN/Inf
2. **Normalization**: StandardScaler fit on training data
3. **Model training**: Fit Isolation Forest on normalized features
4. **Threshold calibration**: Set anomaly threshold using contamination parameter
5. **Persistence**: Save model, scaler, and feature configuration

## Evaluation Protocol

See `docs/ML_EVALUATION.md` for detailed evaluation methodology.

## Limitations Statement

This ML system:
- Detects statistical anomalies, not faults
- Provides anomaly scores, not fault probabilities
- Cannot determine root causes
- Cannot predict future failures (without specific temporal models)
- Performance is bounded by feature engineering and training data quality
- May produce false positives during legitimate operational mode changes
- May miss anomalies that fall within the training distribution

# SpaceGuard AI — ML Phase 3A Completion Report
## Preprocessing & Temporal Feature Engineering

> **Phase:** ML Phase 3A  
> **Status:** COMPLETED  
> **Date:** September 2026  
> **Scope:** Research Preprocessing, Feature Engineering, and Sliding Window Construction Only.  
> **ML Training Status:** **NO ML MODEL WAS TRAINED IN PHASE 3A.**

---

## 1. Implementation Summary

ML Phase 3A transformed the raw NASA SMAP/MSL Telemanom benchmark into reproducible, leakage-safe, model-ready research datasets.

Key components implemented:
1. **Research Architecture:** Modular framework under `ml-service/research/` containing dataset loading, integrity validation, training-derived variance filtering, channel classification, continuous scalers, causal temporal feature extraction, command interaction modeling, sliding-window generation, and window ground-truth labeling.
2. **Declarative Configuration:** `ml-service/config/preprocessing.yaml` specifying candidate transformations and window hyperparameter spaces.
3. **Artifact Generation:** Processed 2D feature matrices, 3D window tensors, serialized transformers, and metadata saved to `ml-service/data/processed/` and `ml-service/artifacts/`.
4. **Execution Manifest:** `ml-service/data/processed/PROCESSING_MANIFEST.json` recording end-to-end provenance and parameters.
5. **Research Notebook:** `ml-service/notebooks/04_preprocessing_feature_engineering.ipynb` executed end-to-end cleanly across 24 cells.
6. **Automated Test Suite:** 21 passing unit, integration, and data-leakage tests under `ml-service/tests/`.

---

## 2. Dataset Results

| Metric | MSL (Mars Science Laboratory) | SMAP (Soil Moisture Active Passive) |
|---|---|---|
| **Raw Train Shape** | `(58317, 55)` | `(135183, 25)` |
| **Raw Test Shape** | `(73729, 55)` | `(427617, 25)` |
| **Raw Test Label Shape** | `(73729,)` | `(427617,)` |
| **Zero-Variance Filter Threshold** | $\mathrm{Var} < 10^{-8}$ (fit on train only) | $\mathrm{Var} < 10^{-8}$ (fit on train only) |
| **Removed Constant Channels** | 22 channels (`[7, 9, 12..15, 17..19, 21..23, 25, 27..35]`) | 1 channel (`[16]`) |
| **Retained Channels** | 33 channels | 24 channels |
| **Continuous Channels** | 1 (Channel 0) | 1 (Channel 0) |
| **Discrete / Command Channels** | 32 channels | 23 channels |
| **Mixed Channels** | 0 | 0 |

---

## 3. Feature Results

Incremental feature expansion starting from retained channels:

| Feature Stage | MSL Feature Count | SMAP Feature Count | Description |
|---|---|---|---|
| **Base Continuous** | 1 | 1 | Scaled Channel 0 (RobustScaler) |
| **+ Temporal Delta** | 1 | 1 | First difference: $x_0(t) - x_0(t-1)$ |
| **+ Rolling Statistics** | 12 | 12 | Mean, std, min, max over windows 10, 30, 100 |
| **+ EMA & Divergences** | 5 | 5 | Spans 10, 30, 100 + divergences (10,30) & (30,100) |
| **+ Command Context** | 3 | 3 | Active command count & command-conditioned telemetry |
| **+ Retained Discrete Commands** | 32 | 23 | Native binary command indicators |
| **Final Engineered Dimensionality** | **54** | **45** | Fully causal, `float32` feature representation |

---

## 4. Window Results & Hyperparameter Space

Candidate window lengths ($W \in [50, 100, 128, 256]$) and strides ($S \in [1, 5, 10]$) were evaluated systematically:

### MSL Test Split Evaluations (73,729 Test Samples, 54 Features)

| Window ($W$) | Stride ($S$) | Windows Generated | Any-Anomaly Windows | Any-Anomaly % | Majority-Anomaly % | Estimated Memory |
|---|---|---|---|---|---|---|
| 50 | 1 | 73,680 | 10,031 | 13.6% | 7.9% | 758.8 MB |
| 50 | 5 | 14,736 | 2,007 | 13.6% | 7.9% | 151.8 MB |
| 50 | 10 | 7,368 | 1,004 | 13.6% | 7.9% | 75.9 MB |
| 100 | 1 | 73,630 | 12,279 | 16.7% | 6.2% | 1,516.6 MB |
| 100 | 5 | 14,726 | 2,456 | 16.7% | 6.2% | 303.3 MB |
| 100 | 10 | 7,363 | 1,228 | 16.7% | 6.2% | 151.7 MB |
| **128 (Default)** | **10 (Default)** | **7,361** | **1,349** | **18.3%** | **5.4%** | **194.1 MB** |
| 256 | 10 | 7,348 | 1,849 | 25.2% | 2.5% | 388.2 MB |

### SMAP Test Split Evaluations (427,617 Test Samples, 45 Features)

| Window ($W$) | Stride ($S$) | Windows Generated | Any-Anomaly Windows | Any-Anomaly % | Majority-Anomaly % | Estimated Memory |
|---|---|---|---|---|---|---|
| 50 | 10 | 42,757 | 7,651 | 17.9% | 11.2% | 366.9 MB |
| 100 | 10 | 42,752 | 8,970 | 21.0% | 10.7% | 733.9 MB |
| **128 (Default)** | **10 (Default)** | **42,749** | **9,644** | **22.6%** | **10.3%** | **939.3 MB** |
| 256 | 10 | 42,737 | 12,185 | 28.5% | 8.8% | 1,878.6 MB |

---

## 5. Label Results (Default Candidate: $W=128, S=10$)

- **MSL Test Labels:**
  - Total Windows: 7,361
  - Any-Anomaly Windows: 1,349 (18.33%)
  - Nominal Windows: 6,012 (81.67%)
  - Majority-Anomaly Windows ($\ge 50\%$): 397 (5.39%)
  - Mean Anomaly Fraction: 0.1051
- **SMAP Test Labels:**
  - Total Windows: 42,749
  - Any-Anomaly Windows: 9,644 (22.56%)
  - Nominal Windows: 33,105 (77.44%)
  - Majority-Anomaly Windows ($\ge 50\%$): 4,402 (10.30%)
  - Mean Anomaly Fraction: 0.1278

---

## 6. Memory & Performance Results

- **Feature Precision:** Converted from raw `float64` to `float32`, cutting intermediate memory in half.
- **2D Feature Arrays:**
  - `MSL_train_features.npy`: 12.0 MB
  - `MSL_test_features.npy`: 15.2 MB
  - `SMAP_train_features.npy`: 23.2 MB
  - `SMAP_test_features.npy`: 73.4 MB
- **3D Window Tensors ($W=128, S=10$):**
  - MSL Train Tensor: 153.8 MB `(5819, 128, 54)`
  - MSL Test Tensor: 194.5 MB `(7361, 128, 54)`
  - SMAP Train Tensor: 296.7 MB `(13506, 128, 45)`
  - SMAP Test Tensor: 939.3 MB `(42749, 128, 45)`
- **Prefix Sum Vectorization:** Replaced point-wise label loops with $O(1)$ prefix sum queries, executing label computations in milliseconds.

---

## 7. Data Leakage Verification Results

All 5 automated tests in `tests/test_leakage.py` passed:
1. `test_scaler_no_test_leakage`: Confirmed that modifying test data does not alter fitted scaler center/scale parameters.
2. `test_variance_filter_no_test_leakage`: Confirmed that constant channel mask is determined strictly by training data variance.
3. `test_temporal_features_causality_no_future_leakage`: Confirmed that corrupting samples at $t > 15$ causes 0 change in delta, rolling, or EMA features at $t \le 10$.
4. `test_window_builder_never_crosses_splits`: Confirmed windows never cross train/test boundaries.
5. `test_raw_dataset_immutability`: Confirmed raw dataset byte counts and shapes remain 100% identical.

---

## 8. Test Execution Results

Pytest run completed in 26.29s:
```
tests/test_features.py::test_delta_features PASSED                       [  4%]
tests/test_features.py::test_rolling_features PASSED                     [  9%]
tests/test_features.py::test_ema_features PASSED                         [ 14%]
tests/test_features.py::test_command_interaction_features PASSED         [ 19%]
tests/test_features.py::test_feature_pipeline PASSED                     [ 23%]
tests/test_leakage.py::test_scaler_no_test_leakage PASSED                [ 28%]
tests/test_leakage.py::test_variance_filter_no_test_leakage PASSED       [ 33%]
tests/test_leakage.py::test_temporal_features_causality_no_future_leakage PASSED [ 38%]
tests/test_leakage.py::test_window_builder_never_crosses_splits PASSED   [ 42%]
tests/test_leakage.py::test_raw_dataset_immutability PASSED              [ 47%]
tests/test_main.py::test_health_check PASSED                             [ 52%]
tests/test_main.py::test_list_models PASSED                              [ 57%]
tests/test_main.py::test_predict_nominal PASSED                          [ 61%]
tests/test_main.py::test_legacy_predict_status PASSED                    [ 66%]
tests/test_preprocessing.py::test_dataset_loader_and_validator PASSED    [ 71%]
tests/test_preprocessing.py::test_variance_filter_fit_and_transform PASSED [ 76%]
tests/test_preprocessing.py::test_channel_classifier PASSED              [ 80%]
tests/test_preprocessing.py::test_continuous_scalers_train_fit_only PASSED [ 85%]
tests/test_windowing.py::test_window_builder PASSED                      [ 90%]
tests/test_windowing.py::test_window_builder_memory_threshold PASSED     [ 95%]
tests/test_windowing.py::test_window_labeler PASSED                      [100%]
======================= 21 passed, 1 warning in 26.29s ========================
```

Notebook execution:
`ml-service/notebooks/04_preprocessing_feature_engineering.ipynb` executed end-to-end with exit code 0.

---

## 9. Raw Data Immutability Confirmation

The raw NASA benchmark arrays remain completely untouched:
- `MSL_train.npy`: 25,659,608 bytes (unchanged)
- `MSL_test.npy`: 32,440,888 bytes (unchanged)
- `MSL_test_label.npy`: 73,857 bytes (unchanged)
- `SMAP_train.npy`: 27,036,728 bytes (unchanged)
- `SMAP_test.npy`: 85,523,528 bytes (unchanged)
- `SMAP_test_label.npy`: 427,745 bytes (unchanged)

---

## 10. Production Boundary & System Impact

- **Production Backend:** UNCHANGED.
- **Production Frontend:** UNCHANGED.
- **Production FastAPI ML Inference (`/predict`):** UNCHANGED.
- **Production Isolation Forest:** UNCHANGED.
- **Gemini Reasoning Engine:** UNCHANGED.
- **Database / Persistent Schemas:** UNCHANGED.

All Phase 3A work is strictly partitioned within research directories (`ml-service/research/`, `ml-service/data/processed/`, `ml-service/artifacts/features/`).

---

## 11. ML Training Status

> **NO ML MODEL WAS TRAINED IN PHASE 3A.**  
> No Isolation Forest, One-Class SVM, Autoencoder, LSTM, or classifier was fitted. No accuracy, precision, recall, or F1 scores are claimed.

---

## 12. Research Decisions Deferred to Subsequent Phases

1. **Optimal Window Length:** $W \in [50, 100, 128, 256]$ remains an empirical hypothesis to be tested against detection latency and F1 score.
2. **Optimal Stride:** Tradeoff between training time/memory and boundary temporal resolution ($S \in [1, 5, 10]$).
3. **Optimal Scaler Choice:** Comparative evaluation between `passthrough`, `robust`, and `minmax`.
4. **Feature Selection:** Determining which feature families (e.g. rolling vs EMA vs commands) contribute most to anomaly detection without overfitting.
5. **Model Architecture Selection:** Determining whether tree-based ensembles (Isolation Forest) on flattened window features or sequential models (Autoencoders/LSTMs) perform best.
6. **Point vs Window Evaluation:** Resolving evaluation metrics (point adjustment vs range-based F1).

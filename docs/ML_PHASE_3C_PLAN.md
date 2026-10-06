# SpaceGuard AI — ML Phase 3C: Deep Sequence & Reconstruction Benchmarking Plan

> **Phase:** ML Phase 3C  
> **Status:** Plan & Methodology Definition  
> **Objective:** Evaluate deep temporal sequence models (LSTM Predictor, Autoencoder Reconstructor) against Phase 3B classical baselines on NASA SMAP/MSL benchmarks.  
> **Safety Boundary:** Experimental research only. Zero modifications to production backend, frontend, Gemini, or production FastAPI `/predict` endpoint.

---

## 1. Executive Summary & Scientific Justification

In **Phase 3B**, classical statistical and unsupervised tree methods established the foundational baseline:
- **Strengths:** Model M4 (Hybrid) achieved up to **100% event recall** on MSL and **92.2%** on SMAP, with instantaneous detection latency (median delay 1–5 samples) and high throughput (>180,000 samples/sec).
- **Identified Limitations:**
  1. *Mode Transition False Alarms:* Point-in-time Isolation Forest struggles when binary command indicator channels transition states, triggering transient false spikes.
  2. *Post-Anomaly Recovery Lag:* Rolling statistical windows retain anomalous values for $W$ steps after an anomaly ends, causing false positives during nominal recovery.
  3. *Univariate Correlation Blind Spots:* Simple z-score methods evaluate Channel 0 in isolation without learning the expected conditional relationship between spacecraft operational commands and continuous telemetry response.

**Phase 3C Hypothesis:**
Deep sequence models can learn nominal temporal dynamics conditioned on command indicator channels. By modeling expected state transitions, prediction and reconstruction residuals ($e_t = |x_t - \hat{x}_t|$) will suppress mode-transition false alarms and improve point precision without compromising event recall.

---

## 2. Research Models Hierarchy (Phase 3C)

| Model ID | Architecture | Paradigm | Input Representation | Scoring Metric |
|---|---|---|---|---|
| **D1** | **LSTM Sequence Forecaster** | Autoregressive Next-Step Prediction | Sliding window $[X_{t-W}, \dots, X_{t-1}]$ (continuous + command channels) | Prediction Error: $e_t = \|y_t - \hat{y}_t\|_2$ normalized by validation residual $\sigma_e$ |
| **D2** | **LSTM Sequence Autoencoder** | Full-Window Temporal Reconstruction | Complete window $X_{t-W:t} \in \mathbb{R}^{W \times D}$ | Reconstruction Error: $e_t = \frac{1}{W \cdot D} \sum_{\tau=1}^W \sum_{j=1}^D (X_{\tau,j} - \hat{X}_{\tau,j})^2$ |
| **D3** | **Deep Residual Hybrid** | Multi-Evidence Fusion | Blended Classical M4 + Deep Residual (D1/D2) | Composite Anomaly Score: $S_t = \alpha S_{\text{classical}} + (1 - \alpha) S_{\text{deep}}$ |

---

## 3. Data Flow & Chronological Splitting

Strict adherence to the established **Phase 3B Evaluation Protocol** (`docs/ML_EVALUATION_PROTOCOL.md`):

```
NASA Train Split (100% Nominal)
├─────────────────────────────────────────┼─────────────────────────────────────────┐
│     Chronological Train (70%)           │      Chronological Validation (30%)     │
│   (Gradient Descent / Optimization)     │  (Early Stopping & Residual Statistics) │
└─────────────────────────────────────────┴─────────────────────────────────────────┘

NASA Test Split (Contains Labeled Anomalies)
├─────────────────────────────────────────┼─────────────────────────────────────────┐
│        Validation Split (30%)           │       Final Held-Out Benchmark (70%)    │
│    (Optimal Threshold $\tau$ Tuning)    │ (Untouched Final Evaluation & Reporting)│
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

- **Leakage Prevention:**
  - Scalers (RobustScaler) fit strictly on the 70% nominal train split.
  - Early stopping monitors MSE on the 30% nominal validation split.
  - Anomaly detection thresholds $\tau$ are calibrated on the 30% test validation split to maximize $F_1$.
  - The 70% final test split is evaluated strictly once with fixed weights and thresholds.

---

## 4. Model Architectures & Training Specifications

### 4.1 Model D1 — LSTM Forecaster (`LSTMForecaster`)
- **Encoder:** 1-2 LSTM layers, hidden size $H \in \{32, 64\}$, dropout $p=0.1$.
- **Decoder/Head:** Linear projection $\mathbb{R}^H \to \mathbb{R}^1$ predicting continuous Channel 0 at time $t$.
- **Loss Function:** Smooth L1 (Huber) Loss to prevent gradient explosion on abrupt operational transitions.
- **Optimizer:** Adam with learning rate $\eta = 10^{-3}$, weight decay $10^{-5}$.
- **Batch Size & Epochs:** Batch size 128, max 20 epochs with patience 5 on validation loss.

### 4.2 Model D2 — LSTM Autoencoder (`LSTMAutoencoder`)
- **Encoder:** LSTM compressing $[X_{t-W}, \dots, X_t] \in \mathbb{R}^{W \times D}$ into bottleneck latent vector $z \in \mathbb{R}^{d_{\text{latent}}}$ ($d_{\text{latent}} = 16$).
- **Decoder:** RepeatVector + LSTM unrolling back to $\mathbb{R}^{W \times D}$.
- **Loss Function:** Mean Squared Error (MSE).
- **Anomaly Score:** Window-level reconstruction error attributed to the window center/endpoint.

### 4.3 Model D3 — Deep Residual Hybrid (`DeepResidualHybrid`)
- Fuses the normalized Phase 3B M4 hybrid score with the normalized deep residual score:
  $$S_{\text{hybrid}}(t) = \alpha \cdot S_{\text{M4}}(t) + (1 - \alpha) \cdot S_{\text{deep}}(t)$$
- Evaluates $\alpha \in \{0.3, 0.5, 0.7\}$.

---

## 5. Controlled Experiment Matrix

| Experiment ID | Mission | Model | Architecture | Window ($W$) | Features | Parameters |
|---|---|---|---|---|---|---|
| `EXP_MSL_D001_LSTM_Pred` | MSL | D1 LSTM Forecaster | 1-Layer LSTM (H=32) | 50 | All 54 | lr=1e-3, Huber |
| `EXP_MSL_D002_LSTM_Pred_W100` | MSL | D1 LSTM Forecaster | 1-Layer LSTM (H=32) | 100 | All 54 | lr=1e-3, Huber |
| `EXP_MSL_D003_LSTM_AE` | MSL | D2 LSTM Autoencoder | Latent=16, H=32 | 50 | All 54 | lr=1e-3, MSE |
| `EXP_MSL_D004_DeepHybrid` | MSL | D3 Deep Hybrid | M4 + D1 Forecaster | 50 | All 54 | $\alpha=0.50$ |
| `EXP_SMAP_D001_LSTM_Pred` | SMAP | D1 LSTM Forecaster | 1-Layer LSTM (H=32) | 50 | All 45 | lr=1e-3, Huber |
| `EXP_SMAP_D002_LSTM_Pred_W100`| SMAP | D1 LSTM Forecaster | 1-Layer LSTM (H=32) | 100 | All 45 | lr=1e-3, Huber |
| `EXP_SMAP_D003_LSTM_AE` | SMAP | D2 LSTM Autoencoder | Latent=16, H=32 | 50 | All 45 | lr=1e-3, MSE |
| `EXP_SMAP_D004_DeepHybrid` | SMAP | D3 Deep Hybrid | M4 + D1 Forecaster | 100 | All 45 | $\alpha=0.50$ |

---

## 6. Evaluation Deliverables & Success Criteria

1. **Comparative Benchmarking:** Direct side-by-side comparison with Phase 3B M0–M4 on:
   - Raw Point Precision, Recall, $F_1$
   - Point-Adjusted $F_1$
   - PR-AUC
   - Event Recall (%)
   - Detection Delay (mean and median steps)
   - Inference Latency (samples/sec)
2. **Key Research Questions Answered:**
   - Does predictive sequence modeling reduce false alarms near command mode transitions?
   - Does reconstruction error detect slow sensor drift earlier than rolling z-scores?
   - Is the computational cost of deep sequence models justifiable compared to M1/M4?
3. **Artifacts & Documentation:**
   - Serialized PyTorch models and JSON metadata in `artifacts/models/research/deep/`
   - Experiment results logged to `experiments/experiments.json` and `experiments/results.csv`
   - Unit tests covering dataset tensor creation, forward pass, residual calculation, and evaluation
   - Executed Jupyter notebook: `notebooks/06_deep_sequence_benchmark.ipynb`
   - Final completion report: `docs/ML_PHASE_3C_COMPLETION.md`

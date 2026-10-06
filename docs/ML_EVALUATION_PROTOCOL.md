# SpaceGuard AI — ML Evaluation Protocol Specification

> **SpaceGuard AI — ML Research Specification**  
> **Status:** Active Standard for Model Benchmarking  
> **Applicability:** NASA SMAP/MSL Benchmark and Future Satellite Telemetry Models

---

## 1. Objective & Non-Negotiable Principles

To ensure scientific rigor, comparability with aerospace literature, and total immunity to data leakage, all anomaly detection models in SpaceGuard AI must adhere to this standardized evaluation protocol.

### Fundamental Principles
1. **Strict Temporal Ordering:** Time-series observations are never randomly shuffled. Train, validation, and test partitions are formed chronologically.
2. **Nominal-Only Model Fitting:** Unsupervised / semi-supervised anomaly detectors must be trained exclusively on nominal operational telemetry. Test anomalies must never be seen during model training.
3. **Leakage-Free Threshold Calibration:** Decision thresholds must never be selected by maximizing metrics on the final held-out evaluation set. Thresholds are calibrated on validation splits only.
4. **Multi-Scale Metric Reporting:** Because spacecraft anomalies are continuous operational episodes rather than independent point blips, point-wise metrics, point-adjusted metrics, and event-level metrics must be reported together. Raw point metrics must never be obscured.
5. **Semantic Separation:** Anomaly scores are empirical measures of statistical surprise or isolation depth; they are **never** interchangeable with fault probabilities or causal assertions.

---

## 2. Chronological Data Partitioning Architecture

The NASA SMAP/MSL benchmark provides nominal-only cruise arrays (`*_train.npy`) and incident-rich flight arrays with ground-truth labels (`*_test.npy`, `*_test_label.npy`).

Partitions are established as follows:

```mermaid
graph TD
    subgraph NASA Training Array (Nominal Cruise Telemetry)
        TrNom[Chronological Train: 0%..70%]
        ValNom[Chronological Nominal Validation: 70%..100%]
    end
    subgraph NASA Test Array (Telemetry + Ground Truth Labels)
        ValTest[Chronological Test Validation: 0%..30%]
        FinalTest[Held-Out Final Test: 30%..100%]
    end

    TrNom -->|Fit Model Parameters| Fit[Model Training]
    ValNom -->|Nominal Percentile Threshold| ThreshNom[Threshold Calibration]
    ValTest -->|Validation F1 Optimal Threshold| ThreshVal[Threshold Calibration]
    Fit --> Predict[Inference Engine]
    ThreshNom -.-> Eval[Final Evaluation]
    ThreshVal -.-> Eval
    Predict --> FinalTest
    FinalTest --> Eval
```

### Exact Partition Bounds

#### **MSL (Mars Science Laboratory)**
- **Nominal Train (0% to 70%):** Samples `0` to `40,821` (40,821 samples). Used for model fitting.
- **Nominal Validation (70% to 100%):** Samples `40,821` to `58,317` (17,496 samples). Used for nominal score distribution calibration.
- **Test Validation (0% to 30%):** Samples `0` to `22,118` (22,118 samples; 2,593 anomalous points; 11.72% anomaly ratio). Used for threshold optimization.
- **Final Test Set (30% to 100%):** Samples `22,118` to `73,729` (51,611 samples; 5,173 anomalous points; 10.02% anomaly ratio; 23 distinct anomaly events). Strictly held out for final reporting.

#### **SMAP (Soil Moisture Active Passive)**
- **Nominal Train (0% to 70%):** Samples `0` to `94,628` (94,628 samples). Used for model fitting.
- **Nominal Validation (70% to 100%):** Samples `94,628` to `135,183` (40,555 samples). Used for nominal score distribution calibration.
- **Test Validation (0% to 30%):** Samples `0` to `128,285` (128,285 samples; 16,339 anomalous points; 12.74% anomaly ratio). Used for threshold optimization.
- **Final Test Set (30% to 100%):** Samples `128,285` to `427,617` (299,332 samples; 38,357 anomalous points; 12.81% anomaly ratio; 51 distinct anomaly events). Strictly held out for final reporting.

---

## 3. Evaluation Metrics & Formulations

### 3.1. Standard Point-Wise Metrics
Evaluates each time step $t$ independently:
- **True Positives ($TP$):** $y_t = 1 \land \hat{y}_t = 1$
- **False Positives ($FP$):** $y_t = 0 \land \hat{y}_t = 1$
- **True Negatives ($TN$):** $y_t = 0 \land \hat{y}_t = 0$
- **False Negatives ($FN$):** $y_t = 1 \land \hat{y}_t = 0$

$$\text{Precision} = \frac{TP}{TP + FP}, \quad \text{Recall} = \frac{TP}{TP + FN}, \quad F_1 = \frac{2 \cdot \text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$
$$\text{FPR} = \frac{FP}{FP + TN}, \quad \text{FNR} = \frac{FN}{FN + TP}$$

- **PR-AUC (Precision-Recall Area Under Curve):** Average Precision computed across all decision thresholds. Primary point-wise metric for highly imbalanced anomaly detection.
- **ROC-AUC:** Area under Receiver Operating Characteristic curve. Supplementary metric measuring global score separation.

### 3.2. Point-Adjusted Metrics (Benchmark Standard)
In time-series anomaly detection literature (e.g., Xu et al. 2018, Hundman et al. 2018, Shen et al. 2020), an anomaly is considered successfully detected if the model triggers an alert at any point during the anomalous episode:
1. For each ground-truth anomaly segment $[s_k, e_k)$, if $\exists t \in [s_k, e_k)$ such that $\hat{y}_t = 1$, then $\hat{y}^{\text{adj}}_t = 1$ for all $t \in [s_k, e_k)$.
2. For all nominal points outside ground truth intervals ($y_t = 0$), $\hat{y}^{\text{adj}}_t = \hat{y}_t$.
3. Adjusted Precision, Recall, and $F_1^{\text{adj}}$ are computed on $\hat{y}^{\text{adj}}$.
4. **Mandatory Reporting Rule:** Adjusted metrics must **never** replace raw metrics; they are reported side-by-side.

### 3.3. Event-Level Metrics & Detection Latency
A ground-truth event $E_k = [s_k, e_k)$ is a maximal contiguous interval where $y_t = 1$.
- **Detected Event:** An event $E_k$ is detected if $\sum_{t=s_k}^{e_k-1} \hat{y}_t > 0$.
- **Event Recall:**
  $$\text{Event Recall} = \frac{\text{Number of Detected Ground-Truth Events}}{\text{Total Ground-Truth Events}}$$
- **Detection Delay ($\Delta_k$):** For each detected event $E_k$, the number of time steps between the physical start of the fault and the first model alert:
  $$\Delta_k = \left( \min \{t \in [s_k, e_k) : \hat{y}_t = 1\} \right) - s_k$$
  Reported as **Mean Delay**, **Median Delay**, and **Immediate Detections** ($\Delta_k = 0$).
- **False Alarm Events:** Contiguous predicted anomaly segments that have zero overlap with any ground-truth event.

---

## 4. Threshold Selection Protocol

Two formal strategies are supported:
1. **Validation Optimal $F_1$ (`val_f1_optimal`):**
   - The model generates anomaly scores $S_{\text{val\_test}}$ on the designated 30% test validation split.
   - 100 threshold candidates spanning the 50th to 99.9th percentiles are evaluated.
   - The threshold maximizing validation $F_1$ is selected.
   - This calibrated threshold is frozen and evaluated once on the final 70% test split.
2. **Nominal False Alarm Rate (`nominal_percentile`):**
   - Purely unsupervised calibration using nominal validation data ($S_{\text{val\_nom}}$).
   - The threshold is set at the $(100 - \alpha)$-th percentile (e.g. 98th percentile for 2% target false alarm rate).
   - Requires zero anomaly labels.

---

## 5. Experiment Tracking & Provenance

Every benchmark run logs a structured record containing:
- Unique `experiment_id` (e.g. `EXP_MSL_E004_M3_All`)
- Mission name (`MSL` / `SMAP`)
- Model name and hyperparameters
- Feature group and window parameters
- Random seed
- Calibrated threshold and strategy
- Point, adjusted, and event metrics
- Wall-clock training and inference runtimes
- Appended immutably to `ml-service/experiments/experiments.json` and `ml-service/experiments/results.csv`.

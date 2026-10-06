# NASA SMAP & MSL Exploratory Data Analysis Findings

> **SpaceGuard AI — ML Phase 2B Research Document**  
> **Status:** Completed  
> **Dataset Source:** NASA Soil Moisture Active Passive (SMAP) & Mars Science Laboratory (MSL) Telemanom Benchmark (Hundman et al., 2018)  
> **Location:** `ml-service/data/raw/nasa_smap_msl/`  
> **Scope:** Exploratory Data Analysis ONLY. **NO MACHINE LEARNING MODELS WERE TRAINED.**

---

## 1. Dataset Dimensions & Volume

### Observed Facts
The raw dataset consists of 6 NumPy array files and 1 anomaly metadata catalog:

| Dataset / File | Observations (Time Steps) | Channels (Features) | Size on Disk | Total Elements |
|---|---|---|---|---|
| `MSL_train.npy` | 58,317 | 55 | 24.47 MB | 3,207,435 |
| `MSL_test.npy` | 73,729 | 55 | 30.94 MB | 4,055,095 |
| `MSL_test_label.npy` | 73,729 | 1 (1D array) | 72.07 KB | 73,729 |
| `SMAP_train.npy` | 135,183 | 25 | 25.78 MB | 3,379,575 |
| `SMAP_test.npy` | 427,617 | 25 | 81.56 MB | 10,690,425 |
| `SMAP_test_label.npy` | 427,617 | 1 (1D array) | 417.67 KB | 427,617 |
| `labeled_anomalies.csv` | 82 rows | 9 columns | 9.07 KB | 82 catalog entries |

- **Total Combined Observations:** 694,846 rows across train and test sets.
- **Total In-Memory Array Footprint:** ~163.24 MB across all 6 arrays.
- **Temporal Axis:** Sample index (0 to $N-1$). The benchmark arrays provide sequentially indexed observations without ISO-8601 calendar timestamps.

### Interpretation
The total data volume is compact enough to fit in RAM without requiring complex distributed infrastructure, but large enough that plotting high-frequency sequences without downsampling or windowing can degrade rendering performance.

---

## 2. Channel Counts & Dimensionality

### Observed Facts
- **MSL Dimensionality:** 55 telemetry channels.
- **SMAP Dimensionality:** 25 telemetry channels.
- **Channel Structure in Benchmark Literature (Hundman et al., 2018):**
  - **Channel 0:** Continuous numerical telemetry reading (e.g. sensor output).
  - **Channels 1..N-1:** One-hot encoded spacecraft command streams and operational mode flags sent to the spacecraft.
- In `labeled_anomalies.csv`, 82 distinct channel IDs are cataloged:
  - 55 channel entries belong to SMAP (e.g. `P-1`, `S-1`, `E-1`, `F-1`).
  - 27 channel entries belong to MSL (e.g. `M-1`, `T-1`, `C-1`, `F-7`).

### Interpretation
The dataset is multivariate with a pronounced architectural asymmetry: one continuous primary telemetry stream accompanied by multiple binary/one-hot auxiliary indicators. Preprocessing and feature engineering cannot treat all 55 or 25 channels symmetrically.

---

## 3. Data Types & Storage Precision

### Observed Facts
- `MSL_train.npy`: `float64`
- `MSL_test.npy`: `float64`
- `MSL_test_label.npy`: `bool` (`True` = anomalous, `False` = nominal)
- `SMAP_train.npy`: `float64`
- `SMAP_test.npy`: `float64`
- `SMAP_test_label.npy`: `bool` (`True` = anomalous, `False` = nominal)
- Label arrays match the exact length of the corresponding test telemetry arrays:
  - MSL test length: 73,729 == MSL label length: 73,729.
  - SMAP test length: 427,617 == SMAP label length: 427,617.

### Interpretation
Storage precision is 64-bit floating point. For future deep learning or tree ensembles, `float32` cast would halve memory consumption with negligible precision loss.

---

## 4. Missingness & Data Integrity

### Observed Facts
A comprehensive scan across all 21,332,530 data points was conducted:

| Check | MSL Train | MSL Test | SMAP Train | SMAP Test |
|---|---|---|---|---|
| **NaN Count** | 0 | 0 | 0 | 0 |
| **+Infinity Count** | 0 | 0 | 0 | 0 |
| **-Infinity Count** | 0 | 0 | 0 | 0 |
| **Label NaNs** | N/A | 0 | N/A | 0 |
| **Label Valid Bool** | N/A | 100% | N/A | 100% |
| **Zero-Variance (Constant) Channels** | 22 / 55 (40.0%) | 21 / 55 (38.2%) | 1 / 25 (4.0%) | 0 / 25 (0.0%) |
| **Identical Duplicate Rows** | 1,419 | 1,820 | 28,142 | 89,301 |

- **MSL Constant Channels in Train:** Channels 7, 9, 12, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 27, 28, 29, 30, 31, 32, 33, 34, 35 all exhibit `std = 0.0` and `min == max`.
- **SMAP Constant Channels in Train:** Channel 16 exhibits `std = 0.0`.
- **Duplicate Rows:** These occur when telemetry values remain unchanged over consecutive sampling intervals (e.g. static sensor reading during standby or steady state).

### Interpretation
1. The dataset contains zero missing values or non-finite elements. No imputation or null-handling is required.
2. The presence of zero-variance channels in training data is critical: standard scaling (z-score normalization) will produce division-by-zero (`0/0 = NaN`) if applied without variance filtering.
3. Duplicate rows represent legitimate operational steady states, not synthetic replication or data corruption.

---

## 5. Descriptive Statistics & Channel Distributions

### Observed Facts
- **Channel 0 (Continuous Channel):**
  - **MSL Train Channel 0:** Mean = -0.2974, Std = 0.4491, Min = -1.0000, 25% = -0.6667, Median = -0.2745, 75% = -0.0196, Max = 1.0000.
  - **MSL Test Channel 0:** Mean = -0.2482, Std = 0.4452, Min = -1.0000, 25% = -0.5882, Median = -0.2157, 75% = 0.0196, Max = 1.0000.
  - **SMAP Train Channel 0:** Mean = -0.3705, Std = 0.5050, Min = -1.0000, 25% = -0.7843, Median = -0.4510, 75% = 0.0196, Max = 1.0000.
  - **SMAP Test Channel 0:** Mean = -0.3392, Std = 0.5186, Min = -1.0000, 25% = -0.7843, Median = -0.4118, 75% = 0.0784, Max = 1.0000.
- **Channels 1..N-1 (Auxiliary / Command Channels):**
  - Values are bounded in $[-1.0, 1.0]$ or $\{0.0, 1.0\}$.
  - Most command channels are sparse indicator vectors with median 0.0 and infrequent pulses to 1.0.

### Interpretation
Telemetry has already been pre-scaled to the $[-1, 1]$ interval by NASA JPL authors during benchmark curation. However, the distribution of Channel 0 is multimodal and non-Gaussian, displaying discrete plateau modes.

---

## 6. Ground-Truth Anomaly Statistics

### Observed Facts
Ground truth labels were evaluated by extracting contiguous intervals where `label == True`:

| Metric | MSL Test Set | SMAP Test Set | Combined Benchmark |
|---|---|---|---|
| **Total Test Samples** | 73,729 | 427,617 | 501,346 |
| **Nominal Samples** | 65,963 (89.47%) | 372,921 (87.21%) | 438,884 (87.54%) |
| **Anomalous Samples** | 7,766 (10.53%) | 54,696 (12.79%) | 62,462 (12.46%) |
| **Number of Anomaly Windows** | 36 contiguous windows | 67 contiguous windows | 103 contiguous windows |
| **Minimum Window Duration** | 11 sample steps | 31 sample steps | 11 sample steps |
| **25th Percentile Duration** | 63 sample steps | 85 sample steps | 70 sample steps |
| **Median Window Duration** | 121 sample steps | 131 sample steps | 128 sample steps |
| **Mean Window Duration** | 215.7 sample steps | 816.4 sample steps | 606.4 sample steps |
| **75th Percentile Duration** | 258 sample steps | 933 sample steps | 545 sample steps |
| **Maximum Window Duration** | 1,141 sample steps | 4,218 sample steps | 4,218 sample steps |

### Interpretation
1. Telemetry anomalies in real spacecraft operations are **collective and persistent**, not isolated point spikes. The median duration of over 120 steps proves that anomalies manifest as multi-step degraded operational phases.
2. Anomaly point density (~10.5% in MSL, ~12.8% in SMAP) is higher than in naive synthetic benchmarks (<1%), because test splits were specifically carved out around documented incident intervals by JPL incident response teams.
3. SMAP displays substantially longer maximum anomaly sequences (up to 4,218 consecutive steps) compared to MSL (maximum 1,141 steps).

---

## 7. Anomaly Morphology & Metadata Analysis

### Observed Facts
Analyzing `labeled_anomalies.csv`:
- Total catalog entries: 82.
- **Classes documented by NASA:**
  - `point`: 47 entries (57.3%)
  - `contextual`: 17 entries (20.7%)
  - Multiple anomalies per channel: e.g. `[contextual, contextual]` (6 entries), `[point, point]` (4 entries), `[contextual, point]` (3 entries).
- **Subsystem distribution in catalog:**
  - Radiation / Environment (`E`): 9 channels
  - Power (`P`): 12 channels
  - Soil Moisture Sensor (`S`): 14 channels
  - Thermal / Commands (`T`, `C`, `F`, `M`): 47 channels
- **Channel Mapping Scope:** The benchmark provides anomaly window intervals per channel in `labeled_anomalies.csv`, whereas `*_test_label.npy` compiles these into a global binary sequence corresponding to concatenated test telemetry.

### Interpretation
- "Point" anomalies in NASA's taxonomy refer to rapid departures from nominal command expectations (often sustained for dozens of steps), while "contextual" anomalies represent nominal-looking values occurring in unexpected operational contexts (e.g. incorrect mode for a given subsystem state).
- SpaceGuard AI must NOT claim to know physical subsystem metrics (e.g. battery temperature or solar bus current) from anonymous labels like `P-1` or `M-1`. Labels must be treated strictly as opaque dataset identifiers.

---

## 8. Train vs Test Distribution Comparison

### Observed Facts
- **Channel 0 Difference:**
  - MSL Channel 0: Mean shift $\Delta\mu = 0.0492$, Std shift $\Delta\sigma = -0.0039$.
  - SMAP Channel 0: Mean shift $\Delta\mu = 0.0313$, Std shift $\Delta\sigma = 0.0136$.
- **Command Channels:**
  - Several command channels that were completely idle (`std = 0.0`, all zeros) during nominal training fire during the test phase (e.g. MSL channel 29 exhibits pulses in test despite being zero throughout training).
- **Kolmogorov-Smirnov / Distribution Shifts:**
  - The distributions of nominal train and test splits differ significantly in the tails and command firing frequencies because the test split contains emergency spacecraft command procedures executed to recover from anomalies.

### Interpretation
Distribution drift is present and structurally expected: when an anomaly occurs on orbit, ground controllers and autonomous fault protection routines transmit commands to safemode or isolate subsystems, activating commands never seen in nominal cruise data.

---

## 9. Temporal Observations

### Observed Facts
- Telemetry exhibits sharp transitions corresponding to spacecraft mode switches and discrete command states.
- Autocorrelation in Channel 0 is high for small lags ($\rho_1 > 0.85$), decaying smoothly over lags of 10–50 steps.
- Plateaus of identical values occur regularly, separated by sudden multi-step transients.
- Periodic behavior is observed in subset channels corresponding to orbital day/night cycles or periodic instrument sweeps.

### Interpretation
Markovian independence assumptions ($X_t \perp X_{t-1}$) are strongly violated. Time-series sequence modeling, rolling statistics, and temporal windowing are essential.

---

## 10. Dataset Limitations

1. **No Physical Timestamps:** Data is provided with integer indices ($t = 0, 1, 2, \dots$), with sampling rates estimated at 1 minute per step in the literature, but without real UTC timestamps.
2. **Anonymized Channels:** Except for the broad subsystem letter (`P`, `T`, `C`, `E`, etc.), physical engineering units (e.g. Volts, Amps, Kelvin, Pascals) are undisclosed.
3. **Pre-Concatenated Sequences:** In the public benchmark, multiple telemetry streams are concatenated into continuous arrays `*_train.npy` and `*_test.npy`.
4. **Command Channel Dominated:** Over 80% of channels in MSL and SMAP are discrete binary indicators rather than continuous analog measurements.

---

## 11. Preprocessing Recommendations for ML Phase 3

1. **Zero-Variance Filtering:** In train sets, columns with variance $< 10^{-8}$ must be identified. Scaling algorithms must not divide by zero.
2. **Separate Continuous vs Discrete Pipelines:** Apply continuous scaling (e.g. RobustScaler or MinMaxScaler) exclusively to Channel 0, and keep command indicator channels in their native binary $\{0, 1\}$ format.
3. **Sliding Window Formulation:** Formulate inputs as sequences of length $W$ (e.g. $W \in [50, 100]$ based on the median anomaly duration of ~121–131 points) with stride $S$.
4. **No Shuffling Before Windowing:** The temporal integrity of sequential observations must be preserved during window creation.

---

## 12. Feature Engineering Questions for ML Phase 3

1. **Delta Features:** First-order temporal differences ($\Delta X_t = X_t - X_{t-1}$) to capture sharp commands and abrupt fault spikes.
2. **Rolling Statistics:** Rolling mean, rolling standard deviation, and rolling min/max over sliding windows of size 10, 30, and 100.
3. **Command Interaction Terms:** Interaction terms between primary channel 0 and active command pulses.
4. **Exponential Moving Average (EMA):** Multi-horizon EMA divergences to detect slow drift (contextual anomalies).

---

## 13. Open Questions for Model Design

1. **Unsupervised vs Semi-Supervised:** Training data contains nominal data only; test data contains labels. This naturally supports semi-supervised / unsupervised novelty detection (e.g. Isolation Forest, One-Class SVM, or reconstruction error Autoencoders).
2. **Point vs Window Evaluation:** Because anomalies have median duration ~128 steps, point-wise evaluation without window-overlap correction (point adjustment) may penalize models that detect an anomaly early but not on every single interior point.
3. **Multi-Channel vs Single-Channel Isolation:** Should anomaly scores be computed per channel, or aggregated across the continuous channel and command indicators?

---

## 14. Verification & Scope Confirmation

- **Execution Verified:** Notebook `ml-service/notebooks/03_eda_nasa_smap_msl.ipynb` executed end-to-end cleanly.
- **Production Code Status:** **No production application code was modified.** (Backend, frontend, ML FastAPI inference, anomaly engine, Gemini, and database remain untouched).
- **ML Model Status:** **NO ML MODEL HAS BEEN TRAINED.**

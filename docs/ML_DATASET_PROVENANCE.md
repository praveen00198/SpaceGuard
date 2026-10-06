# SpaceGuard AI — ML Dataset Provenance: NASA SMAP / MSL Telemanom

> **Status:** Research Dataset Acquired & Verified  
> **Notice:** **ML MODEL TRAINING HAS NOT STARTED.**  
> This document records the provenance, licensing, technical specifications, and research boundaries for the NASA SMAP / MSL Telemetry Anomaly Benchmark. This dataset is used strictly for **anomaly-detection methodology validation** and does **NOT** represent actual SpaceGuard spacecraft telemetry.

---

## 1. Provenance Record

| Metadata Attribute | Value |
| :--- | :--- |
| **Dataset Name** | NASA SMAP and MSL Telemetry Anomaly Detection Benchmark |
| **Originating Mission(s)** | Soil Moisture Active Passive (SMAP) satellite & Mars Science Laboratory (MSL / Curiosity rover) |
| **Primary Research Provider** | NASA Jet Propulsion Laboratory (JPL) / California Institute of Technology |
| **Authoritative Research Repository** | [https://github.com/khundman/telemanom](https://github.com/khundman/telemanom) |
| **Canonical Academic Publication** | Kyle Hundman, Valentino Constantinou, Christopher Laporte, Ian Colwell, Tom Soderstrom. *"Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding"*, ACM SIGKDD 2018 (arXiv: [1802.04431](https://arxiv.org/abs/1802.04431)) |
| **Research Mirror Repository** | Tsinghua University Time-Series-Library (`thuml/Time-Series-Library`) & `khundman/telemanom` |
| **Acquisition Date** | 2026-09-27 / 2026-09-28 UTC |
| **License** | Public Domain (US Government / NASA Work) & Apache-2.0 open-source code |
| **Storage Location** | `ml-service/data/raw/nasa_smap_msl/` (immutable, protected by `.gitignore`) |
| **Inventory Manifest** | `ml-service/data/DATASET_MANIFEST.json` |

---

## 2. Acquired Files & Cryptographic Verification

All raw files were retrieved via deterministic HTTP Range streaming and verified for SHA-256 integrity and NumPy array readability:

| File Name | Size (MB) | Format | Shape | Dtype | SHA-256 Checksum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `labeled_anomalies.csv` | 0.004 MB | CSV (UTF-8) | 82 rows × 5 cols | text / json | `057ce2d6c8875982bf4e5404aefea14efdcbce413d80826d2b737c95b59b7539` |
| `MSL_train.npy` | 24.47 MB | NumPy array | `(58317, 55)` | `float64` | `fae3b79df10e35302bf1a21dfb978b6a87a1d9f90ec58ae69f6c3499469cb904` |
| `MSL_test.npy` | 30.94 MB | NumPy array | `(73729, 55)` | `float64` | `dac7a82c2be3393e8df999f59aef0328db6f8d95cb3623cc5781d42f23fc17a1` |
| `MSL_test_label.npy` | 0.07 MB | NumPy array | `(73729,)` | `bool` | `23e120c30a645000f093ff5311de177601b8220ba3ca4281c6376883444f7b97` |
| `SMAP_train.npy` | 25.78 MB | NumPy array | `(135183, 25)` | `float64` | `023552bb9151858434237700b6d8d87697740f480310e2fa934a7056f4dbc194` |
| `SMAP_test.npy` | 81.56 MB | NumPy array | `(427617, 25)` | `float64` | `6fdbfbcd6ef06a687b693e332219864e0be23f2228e2cd26dc523ca2110ed13a` |
| `SMAP_test_label.npy` | 0.41 MB | NumPy array | `(427617,)` | `bool` | `4963aa364f331cf11d2bc0094775440d6cbe9265f24fef7d8bcf51dfda68c784` |
| **Total** | **163.24 MB** | — | — | — | **7 files verified** |

---

## 3. Label Architecture & Ground Truth

The authoritative ground-truth label definitions are stored in `labeled_anomalies.csv`:
- **Total Channels Cataloged:** 82 distinct spacecraft channels.
  - **SMAP:** 55 channels (e.g., `P-1`, `S-1`, `E-1` through `E-13`).
  - **MSL:** 27 channels (e.g., `C-1`, `C-2`, `D-14`, `D-15`, `D-16`, `F-1`, `F-2`, `F-3`, `M-1` through `M-7`, `P-10` through `P-15`, `S-2`, `T-4`, `T-5`).
- **Annotation Columns:**
  - `chan_id`: Anonymized channel code.
  - `spacecraft`: Mission indicator (`SMAP` or `MSL`).
  - `anomaly_sequences`: List of `[start_idx, end_idx]` integer index pairs indicating anomaly duration.
  - `class`: Anomaly morphology classification (`point`, `contextual`).
  - `num_values`: Total number of evaluation timesteps for that channel.
- **Binary Test Masks (`*_test_label.npy`):** Boolean mask arrays of length matching the test splits, where `True` indicates a confirmed flight anomaly index.
  - MSL test anomalies: $7,908$ anomalous points out of $73,729$ timesteps ($10.72\%$).
  - SMAP test anomalies: $56,155$ anomalous points out of $427,617$ timesteps ($13.13\%$).

---

## 4. Why This Dataset is Being Used

SpaceGuard AI is developing an unsupervised and hybrid anomaly detection engine. The NASA SMAP / MSL dataset is utilized because:
1. **Established Scientific Baseline:** It is the standard reference benchmark in space telemetry literature. Benchmarking Isolation Forest and statistical detection on this dataset allows direct comparison against published aerospace results.
2. **Real Operational Telemetry:** Contains real sensor telemetry collected during active interplanetary (MSL) and Earth observation (SMAP) missions.
3. **Verified Expert Labels:** Ground truth anomalies were identified and recorded by actual NASA spacecraft flight operators and incident review boards.
4. **Clean Train Split:** Training sets represent nominal operations, establishing a natural unsupervised learning target.

---

## 5. Critical Differences from SpaceGuard Telemetry

This dataset is used for **methodology benchmarking only**. It cannot and does not represent actual SpaceGuard spacecraft telemetry:

| Dimension | NASA SMAP / MSL Benchmark | SpaceGuard AI Telemetry Architecture |
| :--- | :--- | :--- |
| **Parameter Identification** | Anonymized tokens (`P-1`, `T-1`, `E-3`) | Explicit engineering keys (`battery_voltage`, `temperature`, `roll`) |
| **Physical Units** | Omitted / dimensionless | Standardized SI engineering units (`V`, `A`, `°C`, `dBm`, `deg`) |
| **Subsystem Hierarchy** | Unmapped single-letter classes | Strict canonical taxonomy (`power`, `thermal`, `communication`, `attitude`) |
| **Absolute Timestamps** | Indexed by step ($0, 1, 2, \dots$) | ISO 8601 UTC timestamps with physical orbit periods |
| **Telemetry Provenance** | Historical archive | Multi-source provenance (`simulator`, `satnogs`, `dataset`, `manual`) |
| **Live Telemetry Pipeline** | Static batch arrays | Real-time streaming over Socket.IO / REST with 1 Hz dispatch |

---

## 6. Preprocessing Requirements (Next Phase)

The raw dataset in `ml-service/data/raw/` remains **completely immutable and untouched**. In subsequent phases, a dedicated pipeline script will:
1. Map channel boundaries and slice contiguous time-series streams.
2. Perform channel-wise feature extraction (rolling mean, rolling variance, rate-of-change).
3. Handle scaling using train-set parameters only (e.g. `RobustScaler` / `StandardScaler`).
4. Output normalized interim/processed arrays to `data/processed/`.

---

> **Notice:** **ML MODEL TRAINING HAS NOT STARTED.**  
> The raw dataset is verified, immutable, and safely cataloged for upcoming feature engineering and evaluation.

# SpaceGuard AI — ML Dataset Requirements & Telemetry Data Audit

> **Status:** Research & Readiness Audit  
> **Notice:** **ML MODEL TRAINING HAS NOT STARTED.**  
> This document specifies the data requirements, telemetry schemas, public dataset evaluations, and synthetic fault models for upcoming SpaceGuard AI machine learning development. No ML models have been trained, modified, or altered in production.

---

## 1. Canonical Telemetry Schema Audit

SpaceGuard AI operates on a standardized, normalized telemetry schema across all data ingress points (simulator, external historical datasets, and observation passes).

### 1.1 Core Telemetry Reading Schema (`ITelemetryReading`)

```typescript
interface ITelemetryReading {
  // Identity
  satelliteId: string;          // Spacecraft identifier (e.g., "SG-1", "SAT-001")
  parameter: string;            // Telemetry parameter key (e.g., "battery_voltage")

  // Measurement
  timestamp: Date;              // ISO 8601 UTC timestamp of reading
  value: number;                // Measured physical scalar value (finite float)
  unit: string;                 // Engineering unit (SI or standard: V, A, C, dBm, etc.)

  // Classification & Hierarchy
  subsystem: TelemetrySubsystem; // 'power' | 'thermal' | 'communication' | 'attitude' | 'payload'

  // Data Provenance & Tracing
  source: TelemetrySource;      // 'simulator' | 'satnogs' | 'dataset' | 'manual'
  sourceRecordId?: string;      // Traceable upstream record ID / frame ID
  sensorId?: string;            // Physical transducer/sensor channel identifier

  // Data Integrity & Quality
  quality: DataQuality;         // 'valid' | 'suspect' | 'interpolated' | 'missing' | 'stale'

  // Ingestion Record
  ingestedAt: Date;             // Pipeline reception timestamp
}
```

### 1.2 Monitored Parameters by Subsystem

The platform currently defines 11 primary telemetry channels across 4 core engineering subsystems plus an extensible payload subsystem:

| Subsystem | Parameter Key | Unit | Baseline | Nominal Range | Critical Threshold | Max Rate of Change | Physical Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Power** | `battery_voltage` | `V` | 3.70 V | [3.30, 4.25] | [3.00, 4.40] | 0.05 V/s | Main electrical bus Li-ion cell terminal voltage |
| **Power** | `battery_current` | `A` | 1.20 A | [0.10, 3.50] | [0.00, 4.80] | 0.20 A/s | Net battery discharge / charge current |
| **Power** | `solar_panel_voltage` | `V` | 14.50 V | [5.00, 28.00] | [0.00, 32.00] | 2.00 V/s | Photovoltaic array generated open-circuit voltage |
| **Power** | `power_consumption` | `W` | 25.00 W | [10.00, 50.00] | [5.00, 80.00] | 5.00 W/s | Total spacecraft instantaneous bus power draw |
| **Thermal** | `temperature` | `C` | 22.00 °C | [-10.00, 45.00] | [-25.00, 60.00] | 0.50 °C/s | Internal avionics / payload bay temperature |
| **Thermal** | `thermal_gradient` | `C/min` | 0.00 °C/min | [-1.50, 1.50] | [-2.50, 2.50] | 1.00 °C/min² | First derivative rate of temperature variation |
| **Communication** | `signal_strength` | `dBm` | -75.00 dBm | [-100.0, -45.0] | [-115.0, -30.0] | 5.00 dBm/s | RF downlink carrier received signal strength (RSSI) |
| **Communication** | `packet_loss_rate` | `%` | 0.50 % | [0.00, 5.00] | [0.00, 20.00] | 2.00 %/s | Frame error rate / unacknowledged downlink packets |
| **Communication** | `link_latency` | `ms` | 250.00 ms | [100.0, 600.0] | [50.0, 1500.0] | 100.00 ms/s | Round-trip ground station network latency |
| **Attitude** | `roll` | `deg` | 0.00° | [-1.00, 1.00] | [-5.00, 5.00] | 0.50 °/s | Body-axis roll deviation from nadir/sun-pointing |
| **Attitude** | `pitch` | `deg` | 0.00° | [-1.00, 1.00] | [-5.00, 5.00] | 0.50 °/s | Body-axis pitch deviation from target vector |
| **Attitude** | `yaw` | `deg` | 0.00° | [-1.00, 1.00] | [-5.00, 5.00] | 0.50 °/s | Body-axis yaw deviation from orbital track |
| **Payload** | Extensible | — | Custom | Custom | Custom | Custom | Instruments, cameras, transponders |

---

## 2. Existing ML Input Contract Audit

The current ML service (`ml-service/app/main.py`) provides a RESTful interface for single-point anomaly scoring.

### 2.1 API Request Contract (`POST /api/predict`)

```json
{
  "satellite_id": "SG-1",
  "subsystem": "thermal",
  "parameter": "temperature",
  "value": 47.5,
  "timestamp": "2026-09-27T16:00:00.000Z"
}
```

### 2.2 Current ML Feature Processing & Model Logic
1. **Features Extracted:** Only the single raw scalar measurement `X = np.array([[req.value]])` is used. No windowing, rolling statistics, multi-parameter vectors, or temporal features are currently utilized during inference.
2. **Current Model Implementation:**
   - At startup, 11 separate synthetic `IsolationForest(n_estimators=100, contamination=0.03, random_state=42)` instances are trained on 500 generated normal Gaussian samples per parameter.
   - An analytical fallback (`z = |x - \mu| / \sigma`) is maintained if scikit-learn is unavailable.
3. **Anomaly Criterion:**
   - Isolation Forest output: `pred = clf.predict(X)[0]`. Flagged as anomaly if `pred == -1`.
   - Score: `decision_function(X)[0]` normalized via `np.clip(0.5 - raw_score, 0.0, 1.0)`.
4. **API Response Contract:**
   ```json
   {
     "is_anomaly": true,
     "anomaly_score": 0.82,
     "model_name": "isolation_forest_temperature",
     "details": "Isolation Forest decision score: -0.320"
   }
   ```
5. **Backend Consumption (`backend/src/modules/anomalies/mlEngine.ts`):**
   - Node.js invokes `/api/predict` via `fetch` with a 1200ms timeout.
   - Converts `anomaly_score` to operational severity (`>0.85` high, `>0.65` medium, else low).
   - Feeds into `AnomalyService.processReading()` to combine with deterministic rules and rolling 3-sigma statistical results.

---

## 3. Data Requirements Matrix for ML Experimentation

To advance from single-scalar scoring to rigorous multivariate anomaly detection, telemetry datasets must satisfy the following parameter specifications:

| Feature Key | Subsystem | Unit | Type | Continuity | Required Sampling | ML Suitability | Scaling Method | Residual Analysis Candidate? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `battery_voltage` | Power | V | Float | Continuous | 0.1 Hz – 1 Hz | High | RobustScaler / MinMax | Yes (vs battery current & SoC) |
| `battery_current` | Power | A | Float | Continuous | 0.1 Hz – 1 Hz | High | StandardScaler | Yes (vs bus consumption) |
| `solar_panel_voltage` | Power | V | Float | Piecewise Continuous | 0.1 Hz – 1 Hz | High | MinMax [0, 30] | Yes (vs orbital solar phase) |
| `power_consumption` | Power | W | Float | Continuous | 0.1 Hz – 1 Hz | High | StandardScaler | Yes (vs thermal dissipation) |
| `temperature` | Thermal | °C | Float | Continuous | 0.05 Hz – 1 Hz | Very High | StandardScaler | Yes (vs power consumption) |
| `thermal_gradient` | Thermal | °C/min | Float | Continuous | 0.05 Hz – 1 Hz | High | RobustScaler | Yes (transient balance) |
| `signal_strength` | Comms | dBm | Float | Continuous (pass) | 0.2 Hz – 1 Hz | Medium | MinMax [-120, -30] | Yes (vs pointing angle & slant range) |
| `packet_loss_rate` | Comms | % | Float | Discrete / Ratio | 0.1 Hz – 1 Hz | High | LogTransform / MinMax | Yes (vs SNR & latency) |
| `link_latency` | Comms | ms | Float | Continuous | 0.1 Hz – 1 Hz | High | RobustScaler | Yes (vs ground station range) |
| `roll` | Attitude | deg | Float | Continuous | 1 Hz – 10 Hz | High | Periodic / SinCos | Yes (vs sun vector & antenna gain) |
| `pitch` | Attitude | deg | Float | Continuous | 1 Hz – 10 Hz | High | Periodic / SinCos | Yes (vs nadir vector) |
| `yaw` | Attitude | deg | Float | Continuous | 1 Hz – 10 Hz | High | Periodic / SinCos | Yes (vs momentum wheel speeds) |

---

## 4. Anomaly Taxonomy & Dataset Needs

Datasets must distinctly support both **uncontaminated normal operational profiles** and a diverse taxonomy of real/injected anomaly morphologies:

```
Telemetry Anomalies
├── Morphological Structure
│   ├── Point Anomalies         (Single-instant spikes, cosmic ray bitflips)
│   ├── Contextual Anomalies    (Nominal value in wrong orbital regime, e.g. 0V solar in eclipse = OK, 0V in sunlight = Fault)
│   └── Collective Anomalies    (Subsequence patterns: oscillations, variance bursts, hunting cycles)
├── Temporal Dynamics
│   ├── Step / Sudden Jump      (Power rail brownout, regulator trip)
│   ├── Trend / Drift           (Slow thermal cooling loss, sensor calibration degradation)
│   ├── Flatline / Dropout      (Sensor freeze, bus communication timeout, sticky bit)
│   └── High-Frequency Noise    (Degrading amplifier, loose connector, plasma interference)
└── Dimensionality
    ├── Univariate Anomalies    (Single sensor exceeds physical or statistical boundaries)
    ├── Multivariate Anomalies  (Individual parameters within bounds, but correlation broken)
    └── Compound Faults         (Cascading failure: solar tracker stall → battery discharge → payload cutoff)
```

---

## 5. Ground Truth & Annotation Requirements

Unsupervised models (such as Isolation Forest) train on normal telemetry, but **evaluation requires strict ground-truth labeling**.

### 5.1 Required Ground Truth Annotation Schema (Research Dataset)

```typescript
interface IAnomalyGroundTruth {
  annotationId: string;         // Unique ground-truth event ID
  satelliteId: string;          // Spacecraft ID
  subsystem: TelemetrySubsystem;// Primary affected subsystem
  parameter: string;            // Affected telemetry channel
  faultType: AnomalyMorphology; // 'spike' | 'drift' | 'step' | 'flatline' | 'oscillation' | 'multivariate'
  startTime: string;            // Anomaly initiation timestamp (ISO 8601 UTC)
  endTime: string;              // Anomaly resolution timestamp (ISO 8601 UTC)
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;           // Expert annotator confidence (0.0 - 1.0)
  sourceType: 'flight_anomaly' | 'injected_synthetic' | 'operator_labeled';
  notes: string;                // Physical root cause or failure mechanism
}
```

### 5.2 Scientific Significance of Ground Truth Labels
Without time-bounded ground truth labels, evaluation metrics cannot be objectively calculated:
- **Precision:** $\frac{TP}{TP + FP}$ — Quantifies false alarm rate. High false alarms cause operator alert fatigue in satellite mission control.
- **Recall:** $\frac{TP}{TP + FN}$ — Quantifies mission safety. Missed anomalies ($FN$) risk catastrophic spacecraft loss.
- **$F_1$ Score & $F_2$ Score:** Harmonic balances. $F_2$ emphasizes recall (space operations prioritize zero missed critical faults over avoiding benign false alarms).
- **False Positive Rate (FPR):** Must remain below $10^{-3}$ on continuous high-rate telemetry.
- **Detection Latency:** $\Delta t = t_{detection} - t_{onset}$. Crucial for operational containment before hardware damage occurs.
- **PR-AUC & ROC-AUC:** Area under precision-recall and ROC curves across varying decision thresholds, independent of arbitrary contamination hyperparameters.

---

## 6. Public Spacecraft Telemetry Datasets Research

The following public spacecraft telemetry datasets were evaluated for relevance, quality, and limitations:

### 6.1 NASA SMAP & MSL Anomaly Dataset (Telemanom)
- **Spacecraft/Mission:** Soil Moisture Active Passive (SMAP) satellite & Mars Science Laboratory (MSL / Curiosity rover).
- **Source & Citation:** NASA JPL / Hundman et al., KDD 2018 (`https://github.com/khundman/telemanom`).
- **Telemetry Channels:** 82 total channels (55 SMAP, 27 MSL).
- **Format & Size:** NumPy `.npy` files, ~70 MB compressed.
- **Sampling:** Uniform regular discrete sampling.
- **Ground Truth:** Expert-labeled binary anomaly ranges in `labeled_anomalies.csv`.
- **Anomaly Proportion:** 13.13% (SMAP), 10.72% (MSL).
- **Licensing:** Public Domain (US Government work).
- **Relevance:** The recognized industry benchmark for spacecraft anomaly detection.
- **Limitations:** Channel labels are anonymized (`P-1`, `T-2`); units, absolute timestamps, and physical equations are omitted.

### 6.2 ESA OPS-SAT Anomaly Detection Dataset (OPSSAT-AD)
- **Spacecraft/Mission:** ESA OPS-SAT (3U CubeSat operational laboratory, 2019–2024).
- **Source & Citation:** KP Labs / European Space Agency (`https://zenodo.org/records/12528696`).
- **Telemetry Channels:** Real bus telemetry (magnetometers, photodiodes, battery temperatures, currents).
- **Format & Size:** CSV segments (`segments.csv`, `dataset.csv`).
- **Sampling:** Segmented telemetry passes.
- **Ground Truth:** Annotated anomaly segments.
- **Licensing:** Open access (MIT / Zenodo).
- **Relevance:** Real on-orbit CubeSat flight data directly matching smallsat subsystems.
- **Limitations:** Segmented rather than continuous multi-month series; CubeSat hardware characteristics differ from deep-space or geostationary buses.

### 6.3 SatNOGS Decoded Telemetry Database
- **Spacecraft/Mission:** Hundreds of active amateur/open-source LEO satellites.
- **Source:** Libre Space Foundation (`https://db.satnogs.org`, `https://network.satnogs.org`).
- **Format:** JSON REST API / Grafana.
- **Licensing:** CC-BY-SA 4.0.
- **Relevance:** Live near-real-time observations and public decoded frames.
- **Limitations:** Opportunistic coverage (gaps between ground station passes); zero ground-truth anomaly annotations.

---

## 7. Dataset Selection Criteria for SpaceGuard AI

When selecting or synthesizing datasets for SpaceGuard ML, the following multi-criteria scorecard must guide decisions:

1. **Spacecraft Operational Relevance (Weight: 20%):** Does the telemetry represent actual satellite bus subsystems (power, thermal, attitude, RF)?
2. **Ground-Truth Label Quality (Weight: 20%):** Are start/end timestamps, anomaly types, and verified nominal periods clearly demarcated?
3. **Temporal Continuity & Resolution (Weight: 15%):** Are sampling frequencies consistent ($0.1\text{ Hz} - 1\text{ Hz}$) without irregular telemetry drops?
4. **Subsystem Diversity (Weight: 15%):** Are cross-subsystem correlations available (e.g. power generation linked to solar angle and temperature)?
5. **Class Imbalance Realism (Weight: 10%):** Does anomaly proportion reflect flight reality ($<1\% - 5\%$ anomalous)?
6. **Open Licensing & Reproducibility (Weight: 10%):** Can results be published, audited, and benchmarked without non-disclosure agreements?
7. **Physical Interpretability (Weight: 10%):** Are engineering units and baseline specifications known so that physical residuals can be computed?

---

## 8. Future Synthetic Simulator Requirements

Because real space flight anomalies are scarce and mission-critical telemetry is often proprietary, SpaceGuard's telemetry generator (`scripts/data/synthetic_telemetry.py` and `backend/src/modules/simulation/`) must support the following fault injections with verified ground truth:

| Scenario ID | Fault Mode | Affected Parameters | Temporal Dynamics | Anomaly Category | Physical Root Cause |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SIM-TH-01` | Thermal Spike | `temperature` | Rise to +35 °C in 60s, exponential decay | Point / Collective | Payload amplifier thermal excursion |
| `SIM-TH-02` | Thermal Drift | `temperature`, `thermal_gradient` | Linear creep +0.005 °C/s over 30 min | Trend / Collective | Heat pipe thermal interface degradation |
| `SIM-PW-01` | Battery Cell Sag | `battery_voltage`, `battery_current` | Drop 0.85 V under load, increased internal resistance | Contextual / Multivariate | Cell short or electrochemical degradation |
| `SIM-PW-02` | Solar Eclipse Drop | `solar_panel_voltage` | Rapid step down to 0V with nominal battery drain | Contextual Nominal | Orbital eclipse pass (NOT a fault) |
| `SIM-CM-01` | Downlink Degradation | `signal_strength`, `packet_loss_rate`, `link_latency` | RSSI drops -25 dBm, packet loss spikes >15% | Collective / Trend | Antenna mispointing or atmospheric attenuation |
| `SIM-SN-01` | Sensor Flatline | `roll` / `pitch` / `temperature` | Exact constant value for $>10$ consecutive ticks | Sensor Fault | Transducer ADC freeze / sticky bus bit |
| `SIM-SN-02` | Sensor Bias / Dropout | Any channel | Step bias +5 $\sigma$ or missing null tokens | Sensor Fault | Grounding shift or telemetry packet drop |
| `SIM-CP-01` | Compound Fault | `temperature`, `battery_voltage`, `power_consumption` | Overheating followed by bus voltage drop | Compound Multivariate | Short circuit causing thermal runaway |

---

## 9. Feature Engineering Roadmap: Current vs. Future

```
Feature Architecture
├── CURRENT (Live ML Service)
│   └── Raw single scalar (X = [value])
│
└── FUTURE CANDIDATES (Experimentation Pipeline)
    ├── Temporal Rolling Windows (W = 10, 30, 100 samples)
    │   ├── Rolling Mean:              μ_W = (1/W) Σ x_t
    │   ├── Rolling Std Deviation:     σ_W = sqrt((1/W) Σ (x_t - μ_W)²)
    │   ├── Rolling Min & Max:         min(X_W), max(X_W)
    │   └── Exponential Moving Avg:    EWMA_t = α x_t + (1-α) EWMA_{t-1}
    │
    ├── Differential & Dynamic Features
    │   ├── First Difference (Rate):   Δx_t = (x_t - x_{t-1}) / Δt
    │   └── Second Difference (Accel): Δ²x_t = (Δx_t - Δx_{t-1}) / Δt
    │
    ├── Statistical & Distributional Features
    │   ├── Rolling Z-Score:           z_t = (x_t - μ_W) / max(σ_W, ε)
    │   ├── Interquartile Position:    IQR_pos = (x_t - Q1) / (Q3 - Q1)
    │   └── Baseline Deviation:        d_t = |x_t - Baseline_param|
    │
    ├── Cross-Channel / Multivariate Coupling Features
    │   ├── Bus Power Dissipation:     P_diss = P_consumed - (V_bat · I_bat)
    │   ├── Thermal Power Ratio:       R_th = ΔT / P_consumed
    │   └── Attitude Rate Magnitude:   |ω| = sqrt(roll_rate² + pitch_rate² + yaw_rate²)
    │
    └── Telemetry Quality Indicators
        ├── Missingness Ratio:         N_missing / W
        └── Consecutive Identical:     Count(x_t == x_{t-1})
```

---

## 10. Analytical Residuals & Physical Redundancy Candidates

For future residual-based fault isolation and causal analysis, the following physical conservation laws provide candidate equations:

1. **Power-Thermal Conservation:**
   $$\Delta T_{avionics} \approx k \cdot P_{consumption} - \dot{Q}_{radiated}$$
   *Residual:* $r_{thermal}(t) = T_{observed}(t) - f_{model}(P_{bus}(t), T_{space})$. A persistent positive residual indicates heat dissipation failure.
2. **Battery Terminal Ohm's Law:**
   $$V_{terminal} = V_{open\_circuit}(SoC) - I_{battery} \cdot R_{internal}$$
   *Residual:* $r_{voltage}(t) = V_{measured} - (V_{OC}(SoC) - I \cdot R_{nominal})$. A negative residual indicates abnormal internal resistance or cell degradation.
3. **RF Propagation Link Geometry:**
   $$RSSI = P_{tx} + G_{tx}(\theta_{pointing}) + G_{rx} - FSPL(d)$$
   *Residual:* $r_{comms}(t) = RSSI_{observed} - RSSI_{modeled}(\theta_{roll}, \theta_{pitch}, d_{orbit})$. Unexplained loss without attitude error isolates RF hardware degradation from orientation errors.

---

## 11. Open Research Questions

1. **Sampling Asynchrony:** Telemetry channels often arrive at differing sample rates (e.g., attitude at 5 Hz, thermal at 0.1 Hz). What interpolation scheme minimizes distortion in sliding window covariance matrices?
2. **Mode-Change Robustness:** Operational mode shifts (e.g. payload transmission ON vs standby) trigger abrupt statistical shifts that are nominal. How can operational mode indicators be integrated to eliminate false alarms?
3. **Model Granularity:** Is an ensemble of subsystem-specific Isolation Forests superior to a single monolithic spacecraft-wide model?

---

> **Notice:** **ML MODEL TRAINING HAS NOT STARTED.**  
> This audit establishes the scientific foundation for dataset ingestion and experimental design.

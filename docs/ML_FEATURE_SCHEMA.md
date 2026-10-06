# SpaceGuard AI — ML Feature Schema Specification

> **SpaceGuard AI — ML Phase 3A Feature Reference**  
> **Status:** Active Research Specification  
> **Source Schemas:**  
> - `ml-service/artifacts/features/MSL/feature_schema.json`  
> - `ml-service/artifacts/features/SMAP/feature_schema.json`

---

## 1. Feature Taxonomy Overview

The Phase 3A feature pipeline transforms raw multivariate telemetry into a standardized, model-ready feature representation.

Features are grouped into 6 distinct families:

1. **`base_continuous`**: Scaled primary sensor reading (Channel 0).
2. **`temporal_delta`**: Discrete first-order differences capturing rapid changes.
3. **`rolling_stat`**: Causal rolling window statistics (mean, standard deviation, min, max).
4. **`ema` / `ema_divergence`**: Exponential moving averages capturing multi-horizon drift and contextual regime shifts.
5. **`command_context`**: Operational indicators summarizing active spacecraft command lines.
6. **`native_discrete`**: Retained binary/command auxiliary channels in their original discrete form.

---

## 2. MSL Feature Dictionary (54 Total Features)

| Feature Index | Feature Name | Family | Source Channel | Transformation | Parameters | Causal |
|---|---|---|---|---|---|---|
| 0 | `channel_0_scaled` | `base_continuous` | Channel 0 | RobustScaler | Fitted on train split | Yes |
| 1 | `delta_1` | `temporal_delta` | Channel 0 | $x_0(t) - x_0(t-1)$ | Order: 1, `fill_first=0.0` | Yes |
| 2 | `rolling_mean_10` | `rolling_stat` | Channel 0 | Rolling Mean | Window: 10, min_periods: 1 | Yes |
| 3 | `rolling_std_10` | `rolling_stat` | Channel 0 | Rolling Standard Deviation | Window: 10, min_periods: 1 | Yes |
| 4 | `rolling_min_10` | `rolling_stat` | Channel 0 | Rolling Minimum | Window: 10, min_periods: 1 | Yes |
| 5 | `rolling_max_10` | `rolling_stat` | Channel 0 | Rolling Maximum | Window: 10, min_periods: 1 | Yes |
| 6 | `rolling_mean_30` | `rolling_stat` | Channel 0 | Rolling Mean | Window: 30, min_periods: 1 | Yes |
| 7 | `rolling_std_30` | `rolling_stat` | Channel 0 | Rolling Standard Deviation | Window: 30, min_periods: 1 | Yes |
| 8 | `rolling_min_30` | `rolling_stat` | Channel 0 | Rolling Minimum | Window: 30, min_periods: 1 | Yes |
| 9 | `rolling_max_30` | `rolling_stat` | Channel 0 | Rolling Maximum | Window: 30, min_periods: 1 | Yes |
| 10 | `rolling_mean_100` | `rolling_stat` | Channel 0 | Rolling Mean | Window: 100, min_periods: 1 | Yes |
| 11 | `rolling_std_100` | `rolling_stat` | Channel 0 | Rolling Standard Deviation | Window: 100, min_periods: 1 | Yes |
| 12 | `rolling_min_100` | `rolling_stat` | Channel 0 | Rolling Minimum | Window: 100, min_periods: 1 | Yes |
| 13 | `rolling_max_100` | `rolling_stat` | Channel 0 | Rolling Maximum | Window: 100, min_periods: 1 | Yes |
| 14 | `ema_10` | `ema` | Channel 0 | Exponential Moving Average | Span: 10, $\alpha \approx 0.1818$ | Yes |
| 15 | `ema_30` | `ema` | Channel 0 | Exponential Moving Average | Span: 30, $\alpha \approx 0.0645$ | Yes |
| 16 | `ema_100` | `ema` | Channel 0 | Exponential Moving Average | Span: 100, $\alpha \approx 0.0198$ | Yes |
| 17 | `ema_divergence_10_30` | `ema_divergence` | Channel 0 | $\mathrm{EMA}_{10} - \mathrm{EMA}_{30}$ | Spans: (10, 30) | Yes |
| 18 | `ema_divergence_30_100` | `ema_divergence` | Channel 0 | $\mathrm{EMA}_{30} - \mathrm{EMA}_{100}$ | Spans: (30, 100) | Yes |
| 19 | `active_command_count` | `command_context` | Channels 1..54 | Active Command Sum | $\sum \mathbb{I}(cmd \neq 0)$ | Yes |
| 20 | `continuous_val_when_command_active` | `command_context` | Ch 0 & Cmds | Conditional Value | $x_0(t) \cdot \mathbb{I}(count > 0)$ | Yes |
| 21 | `continuous_delta_when_command_active` | `command_context` | Ch 0 & Cmds | Conditional Delta | $\Delta_1(t) \cdot \mathbb{I}(count > 0)$ | Yes |
| 22..53 | `aux_discrete_ch_1`..`ch_32` | `native_discrete` | Retained Cmds | Native Passthrough | Retained discrete channels | Yes |

---

## 3. SMAP Feature Dictionary (45 Total Features)

| Feature Index | Feature Name | Family | Source Channel | Transformation | Parameters | Causal |
|---|---|---|---|---|---|---|
| 0 | `channel_0_scaled` | `base_continuous` | Channel 0 | RobustScaler | Fitted on train split | Yes |
| 1 | `delta_1` | `temporal_delta` | Channel 0 | $x_0(t) - x_0(t-1)$ | Order: 1, `fill_first=0.0` | Yes |
| 2..13 | `rolling_mean/std/min/max_{10,30,100}` | `rolling_stat` | Channel 0 | Rolling Windows | Windows: 10, 30, 100 | Yes |
| 14..18 | `ema_{10,30,100}`, divergences | `ema` | Channel 0 | Exponential Moving Average | Spans: 10, 30, 100 | Yes |
| 19..21 | `active_command_count`, context | `command_context` | Ch 0 & Cmds | Operational Context | Bounded interactions | Yes |
| 22..44 | `aux_discrete_ch_1`..`ch_23` | `native_discrete` | Retained Cmds | Native Passthrough | 23 retained discrete channels | Yes |

---

## 4. Physical Rationale for Each Family

### 4.1. Temporal Delta (`delta_1`)
Captures point departures, rapid transient sensor glitches, and high-frequency noise spikes.

### 4.2. Rolling Statistics (Mean, Std, Min, Max)
- **Mean:** Tracks local baseline shifts without lagging behind global regime changes.
- **Std:** Detects variance collapse (flatlined telemetry) or variance explosion (thrashing actuators).
- **Min/Max:** Bounds local operational corridors.

### 4.3. Multi-Span EMA Divergences
- Captures slow drift and contextual anomalies (e.g., gradual thermal dissipation failure or battery charge degradation).
- Divergence $\mathrm{EMA}_{10} - \mathrm{EMA}_{30}$ signals trend velocity; $\mathrm{EMA}_{30} - \mathrm{EMA}_{100}$ signals regime shift.

### 4.4. Command Interaction
- Spacecraft telemetry frequently changes during nominal command execution (e.g. thruster firing or antenna slew).
- Conditioned features allow models to distinguish command-driven nominal changes from uncommanded physical faults.

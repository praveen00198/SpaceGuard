"""Operational Multi-Scale Hybrid Anomaly Detection Engine.

Implements Model M4 Hybrid architecture validated during Phase 3B & 3C benchmarking:
1. Online multi-scale temporal statistics (First-order delta, Rolling bounds W=30, EMA divergence).
2. Unsupervised Isolation Forest subspace tree scoring.
3. Linear fusion with calibrated decision thresholds.
4. Integrated Evidence Packaging.
"""

from collections import deque
from typing import Dict, List, Optional, Tuple, Any
import math
import numpy as np

try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

from app.evidence import EvidencePackager, MLEvidenceToken


# Nominal spacecraft telemetry parameter baselines
PARAM_BASELINES: Dict[str, Dict[str, float]] = {
    "temperature": {"mean": 22.0, "std": 3.0, "min": -10.0, "max": 45.0, "threshold": 0.45},
    "battery_voltage": {"mean": 3.7, "std": 0.15, "min": 3.3, "max": 4.25, "threshold": 0.40},
    "battery_current": {"mean": 1.2, "std": 0.3, "min": 0.2, "max": 3.0, "threshold": 0.42},
    "solar_panel_voltage": {"mean": 14.5, "std": 2.0, "min": 5.0, "max": 25.0, "threshold": 0.45},
    "power_consumption": {"mean": 25.0, "std": 4.0, "min": 10.0, "max": 45.0, "threshold": 0.42},
    "signal_strength": {"mean": -75.0, "std": 8.0, "min": -95.0, "max": -50.0, "threshold": 0.40},
    "packet_loss_rate": {"mean": 0.5, "std": 0.4, "min": 0.0, "max": 3.0, "threshold": 0.38},
    "link_latency": {"mean": 250.0, "std": 40.0, "min": 120.0, "max": 500.0, "threshold": 0.40},
    "roll": {"mean": 0.0, "std": 0.2, "min": -1.0, "max": 1.0, "threshold": 0.35},
    "pitch": {"mean": 0.0, "std": 0.2, "min": -1.0, "max": 1.0, "threshold": 0.35},
    "yaw": {"mean": 0.0, "std": 0.2, "min": -1.0, "max": 1.0, "threshold": 0.35},
}


class OperationalHybridEngine:
    """Production-grade real-time hybrid anomaly detector with online state tracking."""

    def __init__(self, history_len: int = 60, alpha: float = 0.50, random_seed: int = 42) -> None:
        self.history_len = history_len
        self.alpha = alpha
        self.random_seed = random_seed
        self.models: Dict[str, Any] = {}
        # Satellite + parameter history: key = f"{sat_id}:{param}" -> deque of floats
        self.telemetry_history: Dict[str, deque] = {}
        # EMA states: key = f"{sat_id}:{param}" -> {"ema10": float, "ema30": float}
        self.ema_states: Dict[str, Dict[str, float]] = {}

        self._initialize_models()

    def _initialize_models(self) -> None:
        """Pre-fit parameter Isolation Forests on calibrated nominal distributions."""
        for param, cfg in PARAM_BASELINES.items():
            if SKLEARN_AVAILABLE:
                np.random.seed(self.random_seed)
                # Synthetic calibrated nominal distribution matching spacecraft domain physics
                nominal_samples = np.random.normal(cfg["mean"], cfg["std"], size=(600, 1))
                nominal_samples = np.clip(nominal_samples, cfg["min"], cfg["max"])
                clf = IsolationForest(
                    n_estimators=100,
                    contamination=0.03,
                    random_state=self.random_seed,
                )
                clf.fit(nominal_samples)
                self.models[param] = clf
            else:
                self.models[param] = cfg

    def evaluate(
        self,
        satellite_id: str,
        subsystem: str,
        parameter: str,
        value: float,
    ) -> Tuple[bool, float, MLEvidenceToken]:
        """Evaluate incoming telemetry reading through multi-scale hybrid pipeline."""
        cfg = PARAM_BASELINES.get(
            parameter,
            {"mean": 0.0, "std": 1.0, "min": -5.0, "max": 5.0, "threshold": 0.40}
        )
        baseline = cfg["mean"]
        threshold = cfg.get("threshold", 0.40)
        series_key = f"{satellite_id}:{parameter}"

        # 1. Update online history
        if series_key not in self.telemetry_history:
            self.telemetry_history[series_key] = deque(maxlen=self.history_len)
            self.ema_states[series_key] = {"ema10": value, "ema30": value}

        history = self.telemetry_history[series_key]
        history.append(value)

        # Update online EMAs
        ema_state = self.ema_states[series_key]
        k10 = 2.0 / (10.0 + 1.0)
        k30 = 2.0 / (30.0 + 1.0)
        ema_state["ema10"] = value * k10 + ema_state["ema10"] * (1.0 - k10)
        ema_state["ema30"] = value * k30 + ema_state["ema30"] * (1.0 - k30)

        # 2. Compute Multi-Scale Temporal Statistical Signals
        contributing_features: List[str] = []
        
        # A. First-order Delta
        if len(history) >= 2:
            delta = abs(history[-1] - history[-2])
            delta_score = min(1.0, delta / (cfg["std"] * 1.5 + 1e-4))
            if delta_score > 0.6:
                contributing_features.append("rapid_transient_delta")
        else:
            delta_score = 0.0

        # B. Rolling 30-step Mean / Deviation
        hist_arr = np.array(history)
        rolling_mean = float(np.mean(hist_arr))
        rolling_std = float(max(1e-4, np.std(hist_arr)))
        rolling_z = abs(value - rolling_mean) / rolling_std
        stat_score = float(np.clip(rolling_z / 4.0, 0.0, 1.0))
        if rolling_z >= 2.5:
            contributing_features.append("rolling_sigma_breach")

        # C. EMA Divergence
        ema_divergence = abs(ema_state["ema10"] - ema_state["ema30"])
        ema_score = float(np.clip(ema_divergence / (cfg["std"] * 1.2 + 1e-4), 0.0, 1.0))
        if ema_score > 0.5:
            contributing_features.append("sustained_trend_divergence")

        composite_stat_score = 0.40 * stat_score + 0.35 * delta_score + 0.25 * ema_score

        # 3. Compute Isolation Forest Subspace Score
        if SKLEARN_AVAILABLE and parameter in self.models and isinstance(self.models[parameter], IsolationForest):
            clf = self.models[parameter]
            X = np.array([[value]])
            raw_decision = float(clf.decision_function(X)[0])
            # Higher decision_function = more normal; convert to anomaly score (higher = anomalous)
            if_score = float(np.clip(0.5 - raw_decision, 0.0, 1.0))
            if if_score > 0.55:
                contributing_features.append("subspace_isolation_outlier")
        else:
            if_score = composite_stat_score

        # 4. Transparent Linear Fusion (Model M4)
        hybrid_score = self.alpha * composite_stat_score + (1.0 - self.alpha) * if_score
        hybrid_score = float(np.clip(hybrid_score, 0.0, 1.0))

        # Check physical boundary hard rule
        is_hard_limit = value < cfg["min"] or value > cfg["max"]
        if is_hard_limit:
            hybrid_score = max(hybrid_score, 0.90)
            contributing_features.append("hard_physical_envelope_limit")

        is_anomaly = bool(hybrid_score >= threshold or is_hard_limit)

        # 5. Package Evidence
        evidence = EvidencePackager.package_hybrid_evidence(
            parameter=parameter,
            value=value,
            baseline=baseline,
            anomaly_score=hybrid_score,
            threshold=threshold,
            is_anomaly=is_anomaly,
            engine_name="M4_Hybrid_Temporal_v1.0",
            stat_score=composite_stat_score,
            if_score=if_score,
            residual=rolling_z,
            contributing_features=contributing_features,
        )

        return is_anomaly, round(hybrid_score, 3), evidence

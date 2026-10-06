"""Statistical baseline anomaly detectors (M0 and M1)."""

from typing import Any, Dict, List, Optional
import numpy as np

from .base import BaseAnomalyDetector


class SimpleStatisticalDetector(BaseAnomalyDetector):
    """M0: Simple z-score / deviation baseline on continuous telemetry.
    
    Fits baseline nominal mean and standard deviation on training data.
    Score = |x_0(t) - mu| / max(sigma, eps).
    """

    def __init__(
        self,
        continuous_channel_idx: int = 0,
        eps: float = 1e-6,
        model_version: str = "0.1.0",
    ) -> None:
        super().__init__(model_name="M0_SimpleStatistical", model_version=model_version)
        self.continuous_channel_idx = continuous_channel_idx
        self.eps = eps
        self.mean_: float = 0.0
        self.std_: float = 1.0

    def fit(self, X: np.ndarray, split_name: str = "train") -> "SimpleStatisticalDetector":
        """Fit mean and std strictly on training continuous channel."""
        if split_name.lower() != "train":
            raise ValueError(f"Model must be fitted on training data only, got '{split_name}'.")

        c_col = X[:, self.continuous_channel_idx]
        self.mean_ = float(np.mean(c_col))
        self.std_ = float(max(np.std(c_col), self.eps))
        self.is_fitted_ = True
        self.fit_metadata_ = {
            "mean": self.mean_,
            "std": self.std_,
            "continuous_channel_idx": self.continuous_channel_idx,
            "fit_split": split_name,
            "train_samples": len(X),
        }
        return self

    def compute_scores(self, X: np.ndarray) -> np.ndarray:
        """Compute absolute z-score deviation."""
        if not self.is_fitted_:
            raise RuntimeError("Model must be fitted before computing scores.")
        c_col = X[:, self.continuous_channel_idx]
        z_scores = np.abs(c_col - self.mean_) / self.std_
        return np.asarray(z_scores, dtype=np.float32)


class TemporalStatisticalDetector(BaseAnomalyDetector):
    """M1: Multi-scale temporal statistical anomaly detector.
    
    Combines:
    1. First-order delta deviation (|Delta_1| / sigma_delta)
    2. Rolling deviation (|x_0 - rolling_mean_30| / max(rolling_std_30, eps))
    3. EMA divergence (|ema_10 - ema_30| / sigma_div)
    
    Scale parameters are fitted strictly on training nominal data.
    """

    def __init__(
        self,
        weights: Optional[List[float]] = None,
        eps: float = 1e-6,
        model_version: str = "0.1.0",
    ) -> None:
        super().__init__(model_name="M1_TemporalStatistical", model_version=model_version)
        self.weights = weights or [0.35, 0.40, 0.25]
        self.eps = eps
        self.delta_scale_: float = 1.0
        self.rolling_scale_: float = 1.0
        self.ema_scale_: float = 1.0

    def fit(self, X_features: np.ndarray, split_name: str = "train") -> "TemporalStatisticalDetector":
        """Fit scaling denominators for temporal features on training data.
        
        Assumes standard Phase 3A feature layout:
        col 0: channel_0_scaled
        col 1: delta_1
        col 6: rolling_mean_30
        col 7: rolling_std_30
        col 17: ema_divergence_10_30
        """
        if split_name.lower() != "train":
            raise ValueError(f"Model must be fitted on training data only, got '{split_name}'.")

        delta_col = X_features[:, 1]
        c_val = X_features[:, 0]
        roll_mean = X_features[:, 6] if X_features.shape[1] > 6 else c_val
        roll_dev = np.abs(c_val - roll_mean)
        ema_div = X_features[:, 17] if X_features.shape[1] > 17 else np.zeros_like(c_val)

        self.delta_scale_ = float(max(np.std(delta_col), self.eps))
        self.rolling_scale_ = float(max(np.mean(roll_dev) + np.std(roll_dev), self.eps))
        self.ema_scale_ = float(max(np.std(ema_div), self.eps))

        self.is_fitted_ = True
        self.fit_metadata_ = {
            "delta_scale": self.delta_scale_,
            "rolling_scale": self.rolling_scale_,
            "ema_scale": self.ema_scale_,
            "weights": self.weights,
            "fit_split": split_name,
            "train_samples": len(X_features),
        }
        return self

    def compute_scores(self, X_features: np.ndarray) -> np.ndarray:
        """Compute composite statistical temporal anomaly score."""
        if not self.is_fitted_:
            raise RuntimeError("Model must be fitted before computing scores.")

        c_val = X_features[:, 0]
        delta_col = X_features[:, 1]
        roll_mean = X_features[:, 6] if X_features.shape[1] > 6 else c_val
        ema_div = X_features[:, 17] if X_features.shape[1] > 17 else np.zeros_like(c_val)

        s_delta = np.abs(delta_col) / self.delta_scale_
        s_roll = np.abs(c_val - roll_mean) / self.rolling_scale_
        s_ema = np.abs(ema_div) / self.ema_scale_

        w1, w2, w3 = self.weights
        total_w = w1 + w2 + w3
        composite = (w1 * s_delta + w2 * s_roll + w3 * s_ema) / total_w

        return np.asarray(composite, dtype=np.float32)

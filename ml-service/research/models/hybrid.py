"""Hybrid Statistical + Machine Learning Anomaly Detector (M4)."""

from typing import Any, Dict, Optional
import numpy as np

from .base import BaseAnomalyDetector


class HybridAnomalyDetector(BaseAnomalyDetector):
    """M4: Transparent hybrid combining statistical scores and Isolation Forest scores.
    
    Formula:
        hybrid_anomaly_score = alpha * s_stat_norm + (1 - alpha) * s_ml_norm
        
    IMPORTANT SEMANTIC PRINCIPLE:
    This output is strictly an empirical anomaly score, NOT a fault probability,
    NOT a causal probability, and NOT a failure probability.
    """

    def __init__(
        self,
        statistical_detector: BaseAnomalyDetector,
        ml_detector: BaseAnomalyDetector,
        alpha: float = 0.5,
        model_name: str = "M4_HybridDetector",
        model_version: str = "0.1.0",
    ) -> None:
        super().__init__(model_name=model_name, model_version=model_version)
        if not (0.0 <= alpha <= 1.0):
            raise ValueError(f"alpha must be between 0 and 1, got {alpha}")

        self.statistical_detector = statistical_detector
        self.ml_detector = ml_detector
        self.alpha = float(alpha)

        self.stat_min_: float = 0.0
        self.stat_max_: float = 1.0
        self.ml_min_: float = 0.0
        self.ml_max_: float = 1.0

    def fit(self, X: np.ndarray, split_name: str = "train") -> "HybridAnomalyDetector":
        """Fit both constituent models and record nominal score ranges for normalization."""
        if split_name.lower() != "train":
            raise ValueError(f"Model must be fitted on training data only, got '{split_name}'.")

        self.statistical_detector.fit(X, split_name=split_name)
        self.ml_detector.fit(X, split_name=split_name)

        stat_train = self.statistical_detector.compute_scores(X)
        ml_train = self.ml_detector.compute_scores(X)

        self.stat_min_ = float(np.percentile(stat_train, 1))
        self.stat_max_ = float(np.percentile(stat_train, 99))
        self.ml_min_ = float(np.percentile(ml_train, 1))
        self.ml_max_ = float(np.percentile(ml_train, 99))

        self.is_fitted_ = True
        self.fit_metadata_ = {
            "alpha": self.alpha,
            "statistical_model": self.statistical_detector.model_name,
            "ml_model": self.ml_detector.model_name,
            "stat_range": [self.stat_min_, self.stat_max_],
            "ml_range": [self.ml_min_, self.ml_max_],
            "fit_split": split_name,
            "train_samples": len(X),
        }
        return self

    def compute_scores(self, X: np.ndarray) -> np.ndarray:
        """Compute normalized composite hybrid anomaly score."""
        if not self.is_fitted_:
            raise RuntimeError("Model must be fitted before computing scores.")

        stat_raw = self.statistical_detector.compute_scores(X)
        ml_raw = self.ml_detector.compute_scores(X)

        # Robust min-max clipping to [0, 1] range based on training percentiles
        stat_denom = max(self.stat_max_ - self.stat_min_, 1e-6)
        ml_denom = max(self.ml_max_ - self.ml_min_, 1e-6)

        stat_norm = np.clip((stat_raw - self.stat_min_) / stat_denom, 0.0, 5.0)
        ml_norm = np.clip((ml_raw - self.ml_min_) / ml_denom, 0.0, 5.0)

        hybrid_score = self.alpha * stat_norm + (1.0 - self.alpha) * ml_norm
        return np.asarray(hybrid_score, dtype=np.float32)

"""Deep Hybrid Anomaly Detector fusing Classical baseline and Deep Sequence scores."""

from pathlib import Path
from typing import Any, Dict, Optional
import numpy as np

from research.models.base import BaseAnomalyDetector


class DeepResidualHybrid(BaseAnomalyDetector):
    """Hybrid detector fusing Classical Detector and Deep Sequence (LSTM) scores.
    
    Formula:
        score = alpha * norm(classical_score) + (1 - alpha) * norm(deep_score)
    """

    def __init__(
        self,
        classical_model: BaseAnomalyDetector,
        deep_model: BaseAnomalyDetector,
        alpha: float = 0.50,
        model_version: str = "0.1.0",
    ) -> None:
        super().__init__(
            model_name=f"DeepHybrid_{classical_model.model_name}+{deep_model.model_name}_a{int(alpha*100)}",
            model_version=model_version,
        )
        self.classical_model = classical_model
        self.deep_model = deep_model
        self.alpha = float(alpha)
        self.classical_min_ = 0.0
        self.classical_max_ = 1.0
        self.deep_min_ = 0.0
        self.deep_max_ = 1.0

    def fit(self, X: np.ndarray, split_name: str = "train") -> "DeepResidualHybrid":
        """Fit sub-models and calibrate normalization on nominal training data."""
        if split_name != "train":
            raise ValueError(f"Training must strictly use split_name='train', got: {split_name}")

        self.classical_model.fit(X, split_name=split_name)
        self.deep_model.fit(X, split_name=split_name)

        c_scores = self.classical_model.compute_scores(X)
        d_scores = self.deep_model.compute_scores(X)

        self.classical_min_ = float(np.min(c_scores))
        self.classical_max_ = float(np.max(c_scores))
        if self.classical_max_ <= self.classical_min_:
            self.classical_max_ = self.classical_min_ + 1.0

        self.deep_min_ = float(np.min(d_scores))
        self.deep_max_ = float(np.max(d_scores))
        if self.deep_max_ <= self.deep_min_:
            self.deep_max_ = self.deep_min_ + 1.0

        self.is_fitted_ = True
        self.fit_metadata_ = {
            "alpha": self.alpha,
            "classical_model": self.classical_model.model_name,
            "deep_model": self.deep_model.model_name,
            "classical_min": self.classical_min_,
            "classical_max": self.classical_max_,
            "deep_min": self.deep_min_,
            "deep_max": self.deep_max_,
        }
        return self

    def compute_scores(self, X: np.ndarray) -> np.ndarray:
        """Compute blended anomaly scores."""
        if not self.is_fitted_:
            raise RuntimeError("Model must be fitted before computing scores.")

        c_scores = self.classical_model.compute_scores(X)
        d_scores = self.deep_model.compute_scores(X)

        c_norm = (c_scores - self.classical_min_) / (self.classical_max_ - self.classical_min_)
        c_norm = np.clip(c_norm, 0.0, 1.0)

        d_norm = (d_scores - self.deep_min_) / (self.deep_max_ - self.deep_min_)
        d_norm = np.clip(d_norm, 0.0, 1.0)

        blended = self.alpha * c_norm + (1.0 - self.alpha) * d_norm
        return blended

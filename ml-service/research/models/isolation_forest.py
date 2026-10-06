"""Isolation Forest baseline and feature-ablated models (M2 and M3)."""

from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.ensemble import IsolationForest

from .base import BaseAnomalyDetector


class ResearchIsolationForest(BaseAnomalyDetector):
    """Isolation Forest for raw and engineered temporal space telemetry.
    
    Supports:
    - M2: Raw baseline (continuous channel only)
    - M3: Feature ablation groups (raw, +delta, +rolling, +ema, +commands, all)
    - Sequential 2D arrays or pooled 3D window tensors.
    
    Trained strictly on nominal training splits with deterministic random seeds.
    """

    FEATURE_GROUPS = {
        "raw_base": [0],
        "raw_plus_delta": [0, 1],
        "raw_plus_rolling": [0] + list(range(2, 14)),
        "raw_plus_ema": [0] + list(range(14, 19)),
        "all": None,  # All columns
    }

    def __init__(
        self,
        model_name: str = "M2_IsolationForest_Raw",
        n_estimators: int = 100,
        contamination: Any = "auto",
        max_samples: Any = "auto",
        random_state: int = 42,
        feature_group: str = "raw_base",
        feature_indices: Optional[List[int]] = None,
        model_version: str = "0.1.0",
    ) -> None:
        super().__init__(model_name=model_name, model_version=model_version)
        self.n_estimators = n_estimators
        self.contamination = contamination
        self.max_samples = max_samples
        self.random_state = random_state
        self.feature_group = feature_group
        self.feature_indices = feature_indices
        self.model: Optional[IsolationForest] = None
        self.score_min_: float = 0.0
        self.score_max_: float = 1.0

    def _select_features(self, X: np.ndarray) -> np.ndarray:
        """Select feature columns according to feature group configuration."""
        if X.ndim == 3:
            # For 3D window tensor (N_win, W, C), summarize temporal window via mean pooling
            X_2d = np.mean(X, axis=1)
        elif X.ndim == 2:
            X_2d = X
        else:
            raise ValueError(f"Expected 2D or 3D array, got shape {X.shape}")

        if self.feature_indices is not None:
            valid_indices = [i for i in self.feature_indices if i < X_2d.shape[1]]
            return X_2d[:, valid_indices]

        if self.feature_group == "all" or self.feature_group not in self.FEATURE_GROUPS:
            return X_2d

        group_indices = self.FEATURE_GROUPS[self.feature_group]
        if group_indices is None:
            return X_2d

        valid_indices = [i for i in group_indices if i < X_2d.shape[1]]
        return X_2d[:, valid_indices]

    def fit(self, X: np.ndarray, split_name: str = "train") -> "ResearchIsolationForest":
        """Fit Isolation Forest strictly on training data."""
        if split_name.lower() != "train":
            raise ValueError(f"Model must be fitted on training data only, got '{split_name}'.")

        X_sel = self._select_features(X)

        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            max_samples=self.max_samples,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self.model.fit(X_sel)

        # Record training score range for normalization
        train_raw_scores = - self.model.decision_function(X_sel)
        self.score_min_ = float(np.min(train_raw_scores))
        self.score_max_ = float(np.max(train_raw_scores))

        self.is_fitted_ = True
        self.fit_metadata_ = {
            "n_estimators": self.n_estimators,
            "contamination": self.contamination,
            "max_samples": self.max_samples,
            "random_state": self.random_state,
            "feature_group": self.feature_group,
            "selected_features_count": X_sel.shape[1],
            "fit_split": split_name,
            "train_samples": len(X_sel),
            "score_min": self.score_min_,
            "score_max": self.score_max_,
        }
        return self

    def compute_scores(self, X: np.ndarray) -> np.ndarray:
        """Compute anomaly scores where higher score = more anomalous.
        
        Uses inverted decision function: higher means further into anomalous regions.
        """
        if not self.is_fitted_ or self.model is None:
            raise RuntimeError("Model must be fitted before computing scores.")

        X_sel = self._select_features(X)
        raw_scores = - self.model.decision_function(X_sel)
        return np.asarray(raw_scores, dtype=np.float32)

    def compute_normalized_scores(self, X: np.ndarray) -> np.ndarray:
        """Compute min-max normalized scores scaled relative to training bounds."""
        scores = self.compute_scores(X)
        range_val = max(self.score_max_ - self.score_min_, 1e-6)
        normalized = (scores - self.score_min_) / range_val
        return np.asarray(normalized, dtype=np.float32)

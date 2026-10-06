"""Training-derived zero-variance channel filtering."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List
import numpy as np


@dataclass
class VarianceMetadata:
    """Metadata recorded during variance filtering fit."""
    variance_threshold: float
    original_channel_count: int
    retained_channels: List[int]
    removed_channels: List[int]
    train_variances: List[float]
    fit_split: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "variance_threshold": self.variance_threshold,
            "original_channel_count": self.original_channel_count,
            "retained_channels": [int(x) for x in self.retained_channels],
            "removed_channels": [int(x) for x in self.removed_channels],
            "train_variances": [float(x) for x in self.train_variances],
            "fit_split": self.fit_split,
        }


class VarianceFilter:
    """Filters channels having near-zero or zero variance, fitted on training data ONLY."""

    def __init__(self, threshold: float = 1e-8) -> None:
        self.threshold = float(threshold)
        self.retained_indices_: List[int] = []
        self.removed_indices_: List[int] = []
        self.variances_: np.ndarray = np.array([])
        self.is_fitted_: bool = False

    def fit(self, X_train: np.ndarray, split_name: str = "train") -> "VarianceFilter":
        """Fit filter on training split only. Fails if called on test split."""
        if split_name.lower() != "train":
            raise ValueError(f"VarianceFilter MUST be fitted on training data only, received: '{split_name}'.")

        variances = np.var(X_train, axis=0)
        self.variances_ = variances
        self.retained_indices_ = [int(i) for i, v in enumerate(variances) if v >= self.threshold]
        self.removed_indices_ = [int(i) for i, v in enumerate(variances) if v < self.threshold]
        self.is_fitted_ = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Apply variance mask to array."""
        if not self.is_fitted_:
            raise RuntimeError("VarianceFilter must be fitted before transform.")
        return X[:, self.retained_indices_]

    def fit_transform(self, X_train: np.ndarray, split_name: str = "train") -> np.ndarray:
        """Fit on train and transform."""
        self.fit(X_train, split_name=split_name)
        return self.transform(X_train)

    def get_metadata(self) -> VarianceMetadata:
        """Return structured metadata."""
        if not self.is_fitted_:
            raise RuntimeError("VarianceFilter is not fitted.")
        return VarianceMetadata(
            variance_threshold=self.threshold,
            original_channel_count=len(self.variances_),
            retained_channels=self.retained_indices_,
            removed_channels=self.removed_indices_,
            train_variances=self.variances_.tolist(),
            fit_split="train",
        )

    def save_metadata(self, filepath: Path | str) -> None:
        """Serialize filter metadata to JSON."""
        meta = self.get_metadata()
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(meta.to_dict(), f, indent=2)

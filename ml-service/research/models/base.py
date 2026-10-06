"""Base class and interface for research anomaly detection models."""

from abc import ABC, abstractmethod
import json
from pathlib import Path
from typing import Any, Dict, Optional
import joblib
import numpy as np


class BaseAnomalyDetector(ABC):
    """Abstract base class for research anomaly detectors."""

    def __init__(self, model_name: str, model_version: str = "0.1.0") -> None:
        self.model_name = model_name
        self.model_version = model_version
        self.is_fitted_ = False
        self.fit_metadata_: Dict[str, Any] = {}

    @abstractmethod
    def fit(self, X: np.ndarray, split_name: str = "train") -> "BaseAnomalyDetector":
        """Fit model strictly on training data."""
        pass

    @abstractmethod
    def compute_scores(self, X: np.ndarray) -> np.ndarray:
        """Compute continuous anomaly scores where higher score = more anomalous."""
        pass

    def predict(self, X: np.ndarray, threshold: float) -> np.ndarray:
        """Predict binary anomalies given a calibrated threshold."""
        scores = self.compute_scores(X)
        return scores >= threshold

    def to_metadata(self) -> Dict[str, Any]:
        """Return model architecture and fitting metadata."""
        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "is_fitted": self.is_fitted_,
            "fit_metadata": self.fit_metadata_,
        }

    def save(self, filepath: Path | str) -> None:
        """Serialize model artifact and metadata."""
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)

        meta_path = path.with_suffix(".json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(self.to_metadata(), f, indent=2)

    @classmethod
    def load(cls, filepath: Path | str) -> "BaseAnomalyDetector":
        """Load serialized model."""
        return joblib.load(filepath)

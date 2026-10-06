"""Configurable scalers for continuous telemetry channels."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional
import joblib
import numpy as np
from sklearn.preprocessing import MinMaxScaler, RobustScaler


@dataclass
class ScalerMetadata:
    """Metadata recorded when fitting continuous scaler."""
    mission: str
    scaler_type: str
    continuous_channels: List[int]
    fit_split: str
    params: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mission": self.mission,
            "scaler_type": self.scaler_type,
            "continuous_channels": self.continuous_channels,
            "fit_split": self.fit_split,
            "params": self.params,
        }


class ContinuousTransformer:
    """Configurable scaler for continuous channels fitted strictly on training data."""

    SUPPORTED_SCALERS = ["passthrough", "robust", "minmax"]

    def __init__(self, scaler_type: str = "robust", mission: str = "GENERIC") -> None:
        scaler_type = scaler_type.lower()
        if scaler_type not in self.SUPPORTED_SCALERS:
            raise ValueError(
                f"Unsupported scaler '{scaler_type}'. Supported: {self.SUPPORTED_SCALERS}"
            )
        self.scaler_type = scaler_type
        self.mission = mission
        self.scaler_instance: Optional[Any] = None
        self.is_fitted_: bool = False
        self.continuous_channels_: List[int] = [0]

    def fit(
        self,
        X_train: np.ndarray,
        continuous_channels: List[int] | None = None,
        split_name: str = "train",
    ) -> "ContinuousTransformer":
        """Fit scaler on training continuous channels only."""
        if split_name.lower() != "train":
            raise ValueError(
                f"ContinuousTransformer MUST be fitted on training data only. Received split: '{split_name}'."
            )

        if continuous_channels is None:
            continuous_channels = [0]
        self.continuous_channels_ = list(continuous_channels)

        cont_data = X_train[:, self.continuous_channels_]

        if self.scaler_type == "passthrough":
            self.scaler_instance = None
        elif self.scaler_type == "robust":
            self.scaler_instance = RobustScaler()
            self.scaler_instance.fit(cont_data)
        elif self.scaler_type == "minmax":
            self.scaler_instance = MinMaxScaler(feature_range=(-1.0, 1.0))
            self.scaler_instance.fit(cont_data)

        self.is_fitted_ = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Transform continuous channels in array, leaving other channels untouched."""
        if not self.is_fitted_:
            raise RuntimeError("ContinuousTransformer must be fitted before transform.")

        X_out = X.copy()
        if self.scaler_type == "passthrough" or self.scaler_instance is None:
            return X_out

        cont_transformed = self.scaler_instance.transform(X[:, self.continuous_channels_])
        X_out[:, self.continuous_channels_] = cont_transformed
        return X_out

    def fit_transform(
        self,
        X_train: np.ndarray,
        continuous_channels: List[int] | None = None,
        split_name: str = "train",
    ) -> np.ndarray:
        """Fit on train and transform."""
        self.fit(X_train, continuous_channels=continuous_channels, split_name=split_name)
        return self.transform(X_train)

    def get_metadata(self) -> ScalerMetadata:
        """Return structured scaler metadata."""
        if not self.is_fitted_:
            raise RuntimeError("ContinuousTransformer is not fitted.")

        params: Dict[str, Any] = {}
        if isinstance(self.scaler_instance, RobustScaler):
            params["center"] = [float(x) for x in self.scaler_instance.center_]
            params["scale"] = [float(x) for x in self.scaler_instance.scale_]
        elif isinstance(self.scaler_instance, MinMaxScaler):
            params["data_min"] = [float(x) for x in self.scaler_instance.data_min_]
            params["data_max"] = [float(x) for x in self.scaler_instance.data_max_]
            params["scale"] = [float(x) for x in self.scaler_instance.scale_]

        return ScalerMetadata(
            mission=self.mission,
            scaler_type=self.scaler_type,
            continuous_channels=self.continuous_channels_,
            fit_split="train",
            params=params,
        )

    def save(self, filepath: Path | str) -> None:
        """Persist fitted scaler and metadata."""
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)

        # Also write readable JSON metadata alongside
        json_path = path.with_suffix(".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(self.get_metadata().to_dict(), f, indent=2)

    @classmethod
    def load(cls, filepath: Path | str) -> "ContinuousTransformer":
        """Load fitted scaler instance."""
        return joblib.load(filepath)

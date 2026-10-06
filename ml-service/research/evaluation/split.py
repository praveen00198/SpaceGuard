"""Chronological dataset splitting without shuffling for time-series evaluation."""

from dataclasses import dataclass
from typing import Any, Dict, Tuple
import numpy as np


@dataclass(frozen=True)
class SplitIndices:
    """Exact sample indices for a chronological data split."""
    start_idx: int
    end_idx: int
    num_samples: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_idx": self.start_idx,
            "end_idx": self.end_idx,
            "num_samples": self.num_samples,
        }


@dataclass
class DatasetSplits:
    """Container for chronologically partitioned research splits."""
    mission: str
    nominal_train: np.ndarray
    nominal_val: np.ndarray
    val_test_data: np.ndarray
    val_test_labels: np.ndarray
    final_test_data: np.ndarray
    final_test_labels: np.ndarray
    train_indices: SplitIndices
    nominal_val_indices: SplitIndices
    val_test_indices: SplitIndices
    final_test_indices: SplitIndices

    def get_summary(self) -> Dict[str, Any]:
        return {
            "mission": self.mission,
            "nominal_train": self.train_indices.to_dict(),
            "nominal_val": self.nominal_val_indices.to_dict(),
            "val_test": {
                **self.val_test_indices.to_dict(),
                "anomalous_samples": int(np.sum(self.val_test_labels)),
                "anomaly_ratio": float(np.mean(self.val_test_labels)),
            },
            "final_test": {
                **self.final_test_indices.to_dict(),
                "anomalous_samples": int(np.sum(self.final_test_labels)),
                "anomaly_ratio": float(np.mean(self.final_test_labels)),
            },
        }


class ChronologicalSplitter:
    """Partitions time series strictly chronologically without random shuffling."""

    @classmethod
    def split_nominal(
        cls,
        X_train: np.ndarray,
        train_ratio: float = 0.7,
    ) -> Tuple[np.ndarray, np.ndarray, SplitIndices, SplitIndices]:
        """Split nominal training series into chronological train and validation portions."""
        if not (0.0 < train_ratio < 1.0):
            raise ValueError(f"train_ratio must be between 0 and 1, got {train_ratio}")

        n = len(X_train)
        split_point = int(n * train_ratio)

        train_data = X_train[:split_point]
        val_data = X_train[split_point:]

        train_idx = SplitIndices(0, split_point, len(train_data))
        val_idx = SplitIndices(split_point, n, len(val_data))

        return train_data, val_data, train_idx, val_idx

    @classmethod
    def split_test(
        cls,
        X_test: np.ndarray,
        y_test: np.ndarray,
        val_ratio: float = 0.3,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, SplitIndices, SplitIndices]:
        """Split test series into threshold-calibration validation and final untouched test set."""
        if not (0.0 < val_ratio < 1.0):
            raise ValueError(f"val_ratio must be between 0 and 1, got {val_ratio}")

        n = len(X_test)
        split_point = int(n * val_ratio)

        val_data = X_test[:split_point]
        val_labels = y_test[:split_point]

        final_data = X_test[split_point:]
        final_labels = y_test[split_point:]

        val_idx = SplitIndices(0, split_point, len(val_data))
        final_idx = SplitIndices(split_point, n, len(final_data))

        return val_data, val_labels, final_data, final_labels, val_idx, final_idx

    @classmethod
    def create_research_splits(
        cls,
        mission: str,
        X_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
        train_ratio: float = 0.7,
        val_test_ratio: float = 0.3,
    ) -> DatasetSplits:
        """Create complete set of chronologically isolated research splits."""
        train_sub, val_sub, tr_idx, val_idx = cls.split_nominal(X_train, train_ratio=train_ratio)
        vt_data, vt_labels, ft_data, ft_labels, vt_idx, ft_idx = cls.split_test(
            X_test, y_test, val_ratio=val_test_ratio
        )

        return DatasetSplits(
            mission=mission,
            nominal_train=train_sub,
            nominal_val=val_sub,
            val_test_data=vt_data,
            val_test_labels=vt_labels,
            final_test_data=ft_data,
            final_test_labels=ft_labels,
            train_indices=tr_idx,
            nominal_val_indices=val_idx,
            val_test_indices=vt_idx,
            final_test_indices=ft_idx,
        )

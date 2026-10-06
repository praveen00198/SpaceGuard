"""Window-level ground-truth labeling strategies for research evaluation."""

from dataclasses import dataclass
from typing import Any, Dict
import numpy as np


@dataclass
class WindowLabels:
    """Ground-truth labels aggregated over sliding windows."""
    contains_anomaly: np.ndarray
    majority_anomaly: np.ndarray
    anomaly_fraction: np.ndarray
    window_bounds: np.ndarray
    total_windows: int
    anomalous_windows: int
    nominal_windows: int
    majority_anomalous_windows: int
    majority_threshold: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_windows": self.total_windows,
            "anomalous_windows_any": self.anomalous_windows,
            "nominal_windows_any": self.nominal_windows,
            "any_anomaly_percentage": round(100.0 * self.anomalous_windows / max(1, self.total_windows), 2),
            "majority_anomalous_windows": self.majority_anomalous_windows,
            "majority_anomaly_percentage": round(100.0 * self.majority_anomalous_windows / max(1, self.total_windows), 2),
            "majority_threshold": self.majority_threshold,
            "mean_anomaly_fraction": round(float(np.mean(self.anomaly_fraction)) if self.total_windows > 0 else 0.0, 4),
        }


class WindowLabeler:
    """Aggregates point-wise ground-truth labels across sliding window intervals."""

    @classmethod
    def label_windows(
        cls,
        point_labels: np.ndarray,
        window_bounds: np.ndarray,
        majority_threshold: float = 0.5,
    ) -> WindowLabels:
        """Derive window-level anomaly metrics using vectorized prefix sums.
        
        Args:
            point_labels: 1D boolean array of point-wise ground-truth
            window_bounds: 2D array of shape (W, 2) containing [start, end]
            majority_threshold: Threshold proportion to qualify as majority anomaly
        """
        num_windows = len(window_bounds)
        if num_windows == 0:
            return WindowLabels(
                contains_anomaly=np.empty(0, dtype=bool),
                majority_anomaly=np.empty(0, dtype=bool),
                anomaly_fraction=np.empty(0, dtype=np.float32),
                window_bounds=window_bounds,
                total_windows=0,
                anomalous_windows=0,
                nominal_windows=0,
                majority_anomalous_windows=0,
                majority_threshold=majority_threshold,
            )

        # Vectorized prefix-sum calculation for O(1) interval sum queries
        cs = np.pad(np.cumsum(point_labels.astype(np.int64)), (1, 0))
        starts = window_bounds[:, 0]
        ends = window_bounds[:, 1]
        lengths = ends - starts

        pos_counts = cs[ends] - cs[starts]
        anomaly_fraction = (pos_counts / np.maximum(1, lengths)).astype(np.float32)
        contains_anomaly = pos_counts > 0
        majority_anomaly = anomaly_fraction >= majority_threshold

        anom_count = int(np.sum(contains_anomaly))
        maj_count = int(np.sum(majority_anomaly))

        return WindowLabels(
            contains_anomaly=contains_anomaly,
            majority_anomaly=majority_anomaly,
            anomaly_fraction=anomaly_fraction,
            window_bounds=window_bounds,
            total_windows=num_windows,
            anomalous_windows=anom_count,
            nominal_windows=num_windows - anom_count,
            majority_anomalous_windows=maj_count,
            majority_threshold=majority_threshold,
        )

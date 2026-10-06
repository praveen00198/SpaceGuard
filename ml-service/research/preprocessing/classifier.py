"""Channel classification into continuous, discrete, and mixed types."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List
import numpy as np


@dataclass
class ChannelClassificationResult:
    """Channel categorization result."""
    continuous_channels: List[int]
    discrete_channels: List[int]
    mixed_channels: List[int]
    channel_profiles: Dict[int, Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "continuous_channels": self.continuous_channels,
            "discrete_channels": self.discrete_channels,
            "mixed_channels": self.mixed_channels,
            "channel_profiles": {str(k): v for k, v in self.channel_profiles.items()},
        }


class ChannelClassifier:
    """Classifies channels deterministically into continuous, discrete/binary, or mixed."""

    @classmethod
    def classify(cls, X: np.ndarray, continuous_indices: List[int] | None = None) -> ChannelClassificationResult:
        """Classify channels of an array.
        
        Args:
            X: Array of shape (N, C)
            continuous_indices: Known continuous channels (defaults to [0])
        """
        if continuous_indices is None:
            continuous_indices = [0]

        continuous: List[int] = list(continuous_indices)
        discrete: List[int] = []
        mixed: List[int] = []
        profiles: Dict[int, Dict[str, Any]] = {}

        num_samples, num_channels = X.shape

        for ch in range(num_channels):
            col = X[:, ch]
            # Take a sample if array is large to inspect unique values efficiently
            sample_vals = np.unique(col[:50000]) if num_samples > 50000 else np.unique(col)
            num_unique = len(sample_vals)
            min_val = float(col.min())
            max_val = float(col.max())
            active_count = int((col != 0.0).sum())
            activation_rate = float(active_count / num_samples)

            # Count transitions
            diffs = np.diff(col[:10000])
            transition_count = int((diffs != 0.0).sum())

            profile = {
                "num_unique_sample": int(num_unique),
                "min": min_val,
                "max": max_val,
                "activation_rate": activation_rate,
                "transition_count_first_10k": transition_count,
            }

            if ch in continuous_indices:
                profile["assigned_type"] = "continuous"
                profiles[ch] = profile
                continue

            unique_set = set(sample_vals.tolist())
            # Check for binary or discrete indicator
            if num_unique <= 2 and (unique_set.issubset({0.0, 1.0}) or unique_set.issubset({-1.0, 1.0}) or unique_set.issubset({0.0})):
                profile["assigned_type"] = "discrete"
                discrete.append(ch)
            elif num_unique <= 5 and all(float(v).is_integer() for v in sample_vals):
                profile["assigned_type"] = "discrete"
                discrete.append(ch)
            elif num_unique > 50:
                profile["assigned_type"] = "continuous"
                continuous.append(ch)
            else:
                profile["assigned_type"] = "mixed"
                mixed.append(ch)

            profiles[ch] = profile

        return ChannelClassificationResult(
            continuous_channels=sorted(continuous),
            discrete_channels=sorted(discrete),
            mixed_channels=sorted(mixed),
            channel_profiles=profiles,
        )

    @classmethod
    def save_classification(cls, result: ChannelClassificationResult, filepath: Path | str) -> None:
        """Persist classification result to JSON."""
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, indent=2)

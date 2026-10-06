"""Research Configuration Loader.

Loads configurable parameters for preprocessing, temporal features, and windowing.
"""

from pathlib import Path
from typing import Any, Dict
import yaml

DEFAULT_CONFIG: Dict[str, Any] = {
    "variance_filter": {
        "threshold": 1e-8,
        "fit_split": "train",
    },
    "scalers": {
        "default_continuous": "robust",
        "candidates": ["passthrough", "robust", "minmax"],
        "fit_split": "train",
    },
    "temporal_features": {
        "deltas": {
            "orders": [1],
            "fill_first": 0.0,
        },
        "rolling": {
            "windows": [10, 30, 100],
            "metrics": ["mean", "std", "min", "max"],
            "causal": True,
        },
        "ema": {
            "spans": [10, 30, 100],
            "divergences": [[10, 30], [30, 100]],
            "causal": True,
        },
    },
    "command_interactions": {
        "aggregate_count": True,
        "continuous_interaction": True,
        "delta_interaction": True,
    },
    "windowing": {
        "candidate_window_sizes": [50, 100, 128, 256],
        "candidate_strides": [1, 5, 10],
        "default_window_size": 128,
        "default_stride": 10,
        "labeling": {
            "majority_threshold": 0.5,
        },
    },
}


def load_research_config(config_path: Path | str | None = None) -> Dict[str, Any]:
    """Load research configuration from YAML with fallback to defaults."""
    if config_path is None:
        # Search relative to module location
        candidates = [
            Path(__file__).parents[1] / "config" / "preprocessing.yaml",
            Path("config/preprocessing.yaml"),
            Path("ml-service/config/preprocessing.yaml"),
        ]
        for c in candidates:
            if c.exists():
                config_path = c
                break

    if config_path is not None and Path(config_path).exists():
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
            if isinstance(cfg, dict):
                return cfg

    return DEFAULT_CONFIG.copy()

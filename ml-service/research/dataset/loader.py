"""Dataset loader for NASA SMAP and MSL benchmarks."""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import numpy as np


@dataclass(frozen=True)
class DatasetSplit:
    """Immutable representation of a dataset split."""
    mission: str
    split: str
    data: np.ndarray
    labels: Optional[np.ndarray]
    num_samples: int
    num_channels: int
    dtype: np.dtype
    source_file: str

    def to_metadata(self) -> Dict[str, Any]:
        """Convert split properties to structured metadata dictionary."""
        return {
            "mission": self.mission,
            "split": self.split,
            "number_of_samples": self.num_samples,
            "number_of_channels": self.num_channels,
            "dtype": str(self.dtype),
            "shape": list(self.data.shape),
            "label_availability": self.labels is not None,
            "label_shape": list(self.labels.shape) if self.labels is not None else None,
            "source_file": self.source_file,
            "dataset_source": "NASA SMAP/MSL Telemanom Benchmark (Hundman et al., 2018)",
        }


class DatasetLoader:
    """Loads NASA SMAP and MSL benchmark arrays safely and immutably."""

    def __init__(self, raw_dir: Path | str | None = None) -> None:
        if raw_dir is None:
            # Default search paths
            candidates = [
                Path(__file__).parents[2] / "data" / "raw" / "nasa_smap_msl",
                Path("data/raw/nasa_smap_msl"),
                Path("ml-service/data/raw/nasa_smap_msl"),
            ]
            for c in candidates:
                if c.exists():
                    raw_dir = c
                    break
        if raw_dir is None or not Path(raw_dir).exists():
            raise FileNotFoundError(f"Raw dataset directory not found: {raw_dir}")

        self.raw_dir = Path(raw_dir)

    def load_split(self, mission: str, split: str) -> DatasetSplit:
        """Load a specific mission ('MSL' or 'SMAP') and split ('train' or 'test')."""
        mission = mission.upper()
        split = split.lower()

        if mission not in ("MSL", "SMAP"):
            raise ValueError(f"Unknown mission '{mission}'. Must be 'MSL' or 'SMAP'.")
        if split not in ("train", "test"):
            raise ValueError(f"Unknown split '{split}'. Must be 'train' or 'test'.")

        data_filename = f"{mission}_{split}.npy"
        data_path = self.raw_dir / data_filename
        if not data_path.exists():
            raise FileNotFoundError(f"File not found: {data_path}")

        # Load array immutably (read-only flag set)
        data = np.load(data_path)
        data.flags.writeable = False

        labels: Optional[np.ndarray] = None
        if split == "test":
            label_filename = f"{mission}_test_label.npy"
            label_path = self.raw_dir / label_filename
            if not label_path.exists():
                raise FileNotFoundError(f"Label file not found: {label_path}")
            labels = np.load(label_path)
            labels.flags.writeable = False

        return DatasetSplit(
            mission=mission,
            split=split,
            data=data,
            labels=labels,
            num_samples=data.shape[0],
            num_channels=data.shape[1],
            dtype=data.dtype,
            source_file=str(data_path),
        )

    def load_mission(self, mission: str) -> Tuple[DatasetSplit, DatasetSplit]:
        """Load both train and test splits for a mission."""
        train_split = self.load_split(mission, "train")
        test_split = self.load_split(mission, "test")
        return train_split, test_split

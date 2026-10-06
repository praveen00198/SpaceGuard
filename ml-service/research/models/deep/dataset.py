"""PyTorch Dataset utilities for sequence-based anomaly detection."""

from typing import Tuple, Optional
import numpy as np

try:
    import torch
    from torch.utils.data import Dataset
    _BaseDataset = Dataset
except ImportError:
    _BaseDataset = object


class TimeSeriesSequenceDataset(_BaseDataset):
    """Lightweight zero-copy sequence dataset for windowed forecasting and autoencoding.
    
    Constructs window slices on-the-fly without allocating multi-gigabyte 3D arrays.
    """

    def __init__(
        self,
        features: np.ndarray,
        window_size: int = 50,
        target_idx: int = 0,
        is_autoencoder: bool = False,
    ) -> None:
        """Initialize dataset.
        
        Args:
            features: 2D array of shape (N, D).
            window_size: Length of past sequence window.
            target_idx: Index of feature to predict (for forecaster, default 0).
            is_autoencoder: If True, target is the full window (W, D).
        """
        self.features = features.astype(np.float32)
        self.window_size = window_size
        self.target_idx = target_idx
        self.is_autoencoder = is_autoencoder
        if self.is_autoencoder:
            self.num_samples = max(0, len(features) - window_size + 1)
        else:
            self.num_samples = max(0, len(features) - window_size)

    def __len__(self) -> int:
        return self.num_samples

    def __getitem__(self, idx: int):
        """Return (window, target) as tensors if torch is available, else numpy."""
        window = self.features[idx : idx + self.window_size]
        if self.is_autoencoder:
            target = window
        else:
            target = self.features[idx + self.window_size, self.target_idx : self.target_idx + 1]

        try:
            import torch
            return torch.from_numpy(window), torch.from_numpy(target)
        except ImportError:
            return window, target

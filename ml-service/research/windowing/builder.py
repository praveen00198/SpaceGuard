"""Sequential sliding window constructor with memory estimation."""

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple
import numpy as np


@dataclass
class WindowMetadata:
    """Metadata describing constructed window tensor."""
    num_samples: int
    num_features: int
    window_size: int
    stride: int
    num_windows: int
    tensor_shape: Tuple[int, int, int]
    estimated_memory_mb: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "num_samples": self.num_samples,
            "num_features": self.num_features,
            "window_size": self.window_size,
            "stride": self.stride,
            "num_windows": self.num_windows,
            "tensor_shape": list(self.tensor_shape),
            "estimated_memory_mb": round(self.estimated_memory_mb, 2),
        }


class WindowBuilder:
    """Constructs temporal sliding windows deterministically and causality-safe.
    
    Preserves sequential order without shuffling. Windows are formed strictly within
    a single dataset split.
    """

    def __init__(self, window_size: int = 128, stride: int = 10) -> None:
        if window_size < 1:
            raise ValueError(f"window_size must be >= 1, got {window_size}")
        if stride < 1:
            raise ValueError(f"stride must be >= 1, got {stride}")

        self.window_size = int(window_size)
        self.stride = int(stride)

    def estimate_memory_mb(self, num_samples: int, num_features: int, dtype: np.dtype = np.float32) -> float:
        """Estimate in-memory size in MB of the materialized 3D window tensor."""
        if num_samples < self.window_size:
            return 0.0
        num_windows = (num_samples - self.window_size) // self.stride + 1
        item_size = np.dtype(dtype).itemsize
        total_bytes = num_windows * self.window_size * num_features * item_size
        return total_bytes / (1024 * 1024)

    def build_windows(
        self,
        X: np.ndarray,
        max_memory_mb: float = 2048.0,
    ) -> Tuple[np.ndarray, np.ndarray, WindowMetadata]:
        """Construct sliding windows from 2D array.
        
        Args:
            X: Array of shape (N, C)
            max_memory_mb: Maximum allowed allocation threshold
            
        Returns:
            windows: 3D tensor of shape (num_windows, window_size, num_features)
            bounds: 2D array of shape (num_windows, 2) containing [start_idx, end_idx]
            metadata: WindowMetadata describing construction
        """
        n, c = X.shape
        if n < self.window_size:
            raise ValueError(
                f"Array length {n} is smaller than window_size {self.window_size}."
            )

        num_windows = (n - self.window_size) // self.stride + 1
        est_mb = self.estimate_memory_mb(n, c, X.dtype)
        if est_mb > max_memory_mb:
            raise MemoryError(
                f"Window tensor size ({est_mb:.1f} MB) exceeds maximum allowed memory ({max_memory_mb:.1f} MB). "
                f"Consider increasing stride or reducing window size."
            )

        starts = np.arange(0, n - self.window_size + 1, self.stride)
        bounds = np.column_stack([starts, starts + self.window_size])

        # High-performance C-level strided sliding window construction
        view = np.lib.stride_tricks.sliding_window_view(X, window_shape=self.window_size, axis=0)[::self.stride]
        # view has shape (num_windows, c, window_size) -> swap axes to (num_windows, window_size, c)
        windows = np.ascontiguousarray(np.swapaxes(view, 1, 2))

        meta = WindowMetadata(
            num_samples=n,
            num_features=c,
            window_size=self.window_size,
            stride=self.stride,
            num_windows=num_windows,
            tensor_shape=windows.shape,
            estimated_memory_mb=est_mb,
        )

        return windows, bounds, meta

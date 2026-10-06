"""Causal temporal feature extractors for continuous telemetry."""

from typing import Dict, List, Tuple
import numpy as np
import pandas as pd


class DeltaFeatures:
    """Computes causal first-order and higher-order discrete differences."""

    def __init__(self, orders: List[int] | None = None, fill_first: float = 0.0) -> None:
        self.orders = orders or [1]
        self.fill_first = float(fill_first)

    def transform(self, x: np.ndarray) -> Tuple[np.ndarray, List[str]]:
        """Compute delta features for 1D or 2D continuous array.
        
        Args:
            x: 1D array of shape (N,) or 2D of shape (N, 1)
        Returns:
            deltas: 2D array of shape (N, len(orders))
            feature_names: List of generated feature names
        """
        x_flat = np.asarray(x).ravel()
        n = len(x_flat)
        cols: List[np.ndarray] = []
        names: List[str] = []

        for order in self.orders:
            diff = np.empty(n, dtype=np.float32)
            if n > order:
                diff[:order] = self.fill_first
                diff[order:] = x_flat[order:] - x_flat[:-order]
            else:
                diff[:] = self.fill_first
            cols.append(diff)
            names.append(f"delta_{order}")

        res = np.column_stack(cols) if cols else np.empty((n, 0), dtype=np.float32)
        return res, names


class RollingFeatures:
    """Computes strictly causal rolling statistics over sliding history windows."""

    def __init__(
        self,
        windows: List[int] | None = None,
        metrics: List[str] | None = None,
    ) -> None:
        self.windows = windows or [10, 30, 100]
        self.metrics = metrics or ["mean", "std", "min", "max"]

    def transform(self, x: np.ndarray) -> Tuple[np.ndarray, List[str]]:
        """Compute causal rolling statistics.
        
        At index t, features depend exclusively on indices <= t (no future leakage).
        """
        x_flat = np.asarray(x).ravel()
        s = pd.Series(x_flat)
        cols: List[np.ndarray] = []
        names: List[str] = []

        for w in self.windows:
            r = s.rolling(window=w, min_periods=1)
            for m in self.metrics:
                if m == "mean":
                    arr = r.mean().to_numpy(dtype=np.float32)
                elif m == "std":
                    # min_periods=1 produces NaN at index 0 for std; fill with 0.0
                    arr = r.std().fillna(0.0).to_numpy(dtype=np.float32)
                elif m == "min":
                    arr = r.min().to_numpy(dtype=np.float32)
                elif m == "max":
                    arr = r.max().to_numpy(dtype=np.float32)
                else:
                    raise ValueError(f"Unsupported rolling metric: {m}")

                cols.append(arr)
                names.append(f"rolling_{m}_{w}")

        res = np.column_stack(cols) if cols else np.empty((len(x_flat), 0), dtype=np.float32)
        return res, names


class EMAFeatures:
    """Computes strictly causal Exponential Moving Averages and multi-span divergences."""

    def __init__(
        self,
        spans: List[int] | None = None,
        divergences: List[Tuple[int, int]] | None = None,
    ) -> None:
        self.spans = spans or [10, 30, 100]
        self.divergences = divergences or [(10, 30), (30, 100)]

    def transform(self, x: np.ndarray) -> Tuple[np.ndarray, List[str]]:
        """Compute causal EMAs and divergences."""
        x_flat = np.asarray(x).ravel()
        s = pd.Series(x_flat)
        cols: List[np.ndarray] = []
        names: List[str] = []

        ema_dict: Dict[int, np.ndarray] = {}
        for span in self.spans:
            # adjust=False gives recursive causal filter: y_t = (1-a)*y_{t-1} + a*x_t
            ema_arr = s.ewm(span=span, adjust=False).mean().to_numpy(dtype=np.float32)
            ema_dict[span] = ema_arr
            cols.append(ema_arr)
            names.append(f"ema_{span}")

        for fast, slow in self.divergences:
            if fast in ema_dict and slow in ema_dict:
                divergence = ema_dict[fast] - ema_dict[slow]
                cols.append(divergence.astype(np.float32))
                names.append(f"ema_divergence_{fast}_{slow}")

        res = np.column_stack(cols) if cols else np.empty((len(x_flat), 0), dtype=np.float32)
        return res, names

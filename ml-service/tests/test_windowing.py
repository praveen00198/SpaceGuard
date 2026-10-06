"""Unit tests for temporal windowing and window-level ground-truth labeling."""

import numpy as np
import pytest

from research.windowing.builder import WindowBuilder
from research.windowing.labeling import WindowLabeler


def test_window_builder():
    """Verify window tensor shape, strides, and temporal ordering."""
    # 100 samples, 3 features
    X = np.arange(300, dtype=np.float32).reshape(100, 3)

    wb = WindowBuilder(window_size=10, stride=5)
    windows, bounds, meta = wb.build_windows(X)

    # (100 - 10) // 5 + 1 = 19 windows
    assert windows.shape == (19, 10, 3)
    assert bounds.shape == (19, 2)
    assert meta.num_windows == 19
    assert meta.window_size == 10
    assert meta.stride == 5

    # Check temporal ordering: first window is X[0:10], second is X[5:15]
    np.testing.assert_array_equal(windows[0], X[0:10])
    np.testing.assert_array_equal(windows[1], X[5:15])
    np.testing.assert_array_equal(bounds[0], [0, 10])
    np.testing.assert_array_equal(bounds[1], [5, 15])


def test_window_builder_memory_threshold():
    """Verify memory estimation and threshold enforcement."""
    wb = WindowBuilder(window_size=100, stride=1)
    est_mb = wb.estimate_memory_mb(num_samples=100000, num_features=50, dtype=np.float32)
    assert est_mb > 0.0

    # If threshold is too low, raises MemoryError
    X = np.zeros((1000, 10), dtype=np.float32)
    with pytest.raises(MemoryError, match="exceeds maximum allowed memory"):
        wb.build_windows(X, max_memory_mb=0.001)


def test_window_labeler():
    """Verify window-level any-anomaly, majority-anomaly, and anomaly-fraction calculation."""
    # 20 samples, anomaly between index 5 and 9 (inclusive, 5 anomalous points)
    labels = np.zeros(20, dtype=bool)
    labels[5:10] = True

    bounds = np.array([
        [0, 5],    # 0 anomalies (fraction: 0.0)
        [2, 7],    # 2 anomalies at idx 5, 6 (fraction: 2/5 = 0.4)
        [5, 10],   # 5 anomalies (fraction: 5/5 = 1.0)
        [10, 15],  # 0 anomalies (fraction: 0.0)
    ])

    wl = WindowLabeler.label_windows(labels, bounds, majority_threshold=0.5)

    assert wl.total_windows == 4
    np.testing.assert_array_equal(wl.contains_anomaly, [False, True, True, False])
    np.testing.assert_array_equal(wl.majority_anomaly, [False, False, True, False])
    np.testing.assert_allclose(wl.anomaly_fraction, [0.0, 0.4, 1.0, 0.0])
    assert wl.anomalous_windows == 2
    assert wl.majority_anomalous_windows == 1
    assert wl.nominal_windows == 2

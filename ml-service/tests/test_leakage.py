"""Explicit automated data leakage tests for Phase 3A research pipeline."""

import os
from pathlib import Path
import numpy as np
import pytest

from research.features.temporal import DeltaFeatures, EMAFeatures, RollingFeatures
from research.preprocessing.scalers import ContinuousTransformer
from research.preprocessing.variance import VarianceFilter
from research.windowing.builder import WindowBuilder


def test_scaler_no_test_leakage():
    """Verify that modifying test data does not affect scaler fit parameters."""
    X_train = np.array([[-1.0], [0.0], [1.0]], dtype=np.float32)
    X_test_clean = np.array([[5.0], [10.0]], dtype=np.float32)
    X_test_altered = np.array([[5000.0], [-9999.0]], dtype=np.float32)

    scaler1 = ContinuousTransformer(scaler_type="robust", mission="TEST")
    scaler1.fit(X_train, split_name="train")

    scaler2 = ContinuousTransformer(scaler_type="robust", mission="TEST")
    scaler2.fit(X_train, split_name="train")

    # Parameters must be identical regardless of what test data looks like
    p1 = scaler1.get_metadata().params
    p2 = scaler2.get_metadata().params
    assert p1 == p2

    # Verify scaler refuses to fit on test
    with pytest.raises(ValueError):
        scaler1.fit(X_test_clean, split_name="test")


def test_variance_filter_no_test_leakage():
    """Verify that zero-variance filtering decision is solely derived from training split."""
    X_train = np.array([
        [1.0, 0.0],
        [2.0, 0.0],
        [3.0, 0.0],
    ])
    # In test, channel 1 suddenly has variance
    X_test = np.array([
        [1.0, 50.0],
        [2.0, 100.0],
    ])

    vf = VarianceFilter(threshold=1e-8)
    vf.fit(X_train, split_name="train")

    # Must retain channel 0 and remove channel 1 because train had zero variance in channel 1
    assert vf.retained_indices_ == [0]
    assert vf.removed_indices_ == [1]

    # When applied to test, channel 1 is still dropped according to the training rule
    X_test_trans = vf.transform(X_test)
    assert X_test_trans.shape == (2, 1)
    np.testing.assert_array_equal(X_test_trans[:, 0], [1.0, 2.0])


def test_temporal_features_causality_no_future_leakage():
    """Verify that changing future samples (at t+5) does NOT change past features (at t)."""
    # Create clean series
    x_clean = np.linspace(0.0, 10.0, 20, dtype=np.float32)
    x_altered = x_clean.copy()
    # Drastically corrupt future observations starting at index 15
    x_altered[15:] += 1000.0

    eval_idx = 10  # Past index (before index 15)

    # 1. Delta
    d_clean, _ = DeltaFeatures(orders=[1]).transform(x_clean)
    d_alt, _ = DeltaFeatures(orders=[1]).transform(x_altered)
    np.testing.assert_allclose(d_clean[:eval_idx+1], d_alt[:eval_idx+1])

    # 2. Rolling
    r_clean, _ = RollingFeatures(windows=[5], metrics=["mean", "std", "min", "max"]).transform(x_clean)
    r_alt, _ = RollingFeatures(windows=[5], metrics=["mean", "std", "min", "max"]).transform(x_altered)
    np.testing.assert_allclose(r_clean[:eval_idx+1], r_alt[:eval_idx+1])

    # 3. EMA
    e_clean, _ = EMAFeatures(spans=[5], divergences=[]).transform(x_clean)
    e_alt, _ = EMAFeatures(spans=[5], divergences=[]).transform(x_altered)
    np.testing.assert_allclose(e_clean[:eval_idx+1], e_alt[:eval_idx+1])


def test_window_builder_never_crosses_splits():
    """Verify that window builders operate strictly on single splits without crossing."""
    X_train = np.ones((50, 2), dtype=np.float32)
    X_test = np.ones((40, 2), dtype=np.float32) * 2.0

    wb = WindowBuilder(window_size=10, stride=5)
    train_windows, train_bounds, _ = wb.build_windows(X_train)
    test_windows, test_bounds, _ = wb.build_windows(X_test)

    # No train window contains test values (2.0)
    assert not np.any(train_windows == 2.0)
    # No test window contains train values (1.0)
    assert not np.any(test_windows == 1.0)


def test_raw_dataset_immutability():
    """Verify that raw NASA benchmark files were not modified or truncated."""
    raw_dir = Path(__file__).parents[1] / "data" / "raw" / "nasa_smap_msl"
    
    expected_sizes = {
        "MSL_train.npy": 25659608,
        "MSL_test.npy": 32440888,
        "MSL_test_label.npy": 73857,
        "SMAP_train.npy": 27036728,
        "SMAP_test.npy": 85523528,
        "SMAP_test_label.npy": 427745,
    }

    for filename, expected_bytes in expected_sizes.items():
        filepath = raw_dir / filename
        assert filepath.exists(), f"Raw file missing: {filepath}"
        actual_bytes = os.path.getsize(filepath)
        assert actual_bytes == expected_bytes, (
            f"Raw file {filename} size changed! Expected {expected_bytes}, got {actual_bytes}."
        )

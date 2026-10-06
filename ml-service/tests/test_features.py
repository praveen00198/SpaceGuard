"""Unit tests for temporal delta, rolling, EMA, and command features."""

import numpy as np
import pytest

from research.features.command import CommandInteractionFeatures
from research.features.pipeline import FeaturePipeline
from research.features.temporal import DeltaFeatures, EMAFeatures, RollingFeatures


def test_delta_features():
    """Verify first-order delta calculation and fill value."""
    x = np.array([10.0, 15.0, 12.0, 20.0], dtype=np.float32)
    extractor = DeltaFeatures(orders=[1], fill_first=0.0)
    deltas, names = extractor.transform(x)

    assert names == ["delta_1"]
    assert deltas.shape == (4, 1)
    np.testing.assert_allclose(deltas[:, 0], [0.0, 5.0, -3.0, 8.0])


def test_rolling_features():
    """Verify rolling statistics calculation and causality."""
    x = np.array([1.0, 2.0, 3.0, 4.0, 5.0], dtype=np.float32)
    extractor = RollingFeatures(windows=[3], metrics=["mean", "min", "max"])
    rollings, names = extractor.transform(x)

    assert "rolling_mean_3" in names
    assert "rolling_min_3" in names
    assert "rolling_max_3" in names

    # Window size 3:
    # idx 0: [1.0] -> mean 1.0
    # idx 1: [1.0, 2.0] -> mean 1.5
    # idx 2: [1.0, 2.0, 3.0] -> mean 2.0
    # idx 3: [2.0, 3.0, 4.0] -> mean 3.0
    # idx 4: [3.0, 4.0, 5.0] -> mean 4.0
    mean_col = rollings[:, names.index("rolling_mean_3")]
    np.testing.assert_allclose(mean_col, [1.0, 1.5, 2.0, 3.0, 4.0])


def test_ema_features():
    """Verify EMA and divergence features."""
    x = np.array([0.0, 1.0, 2.0, 3.0, 4.0, 5.0], dtype=np.float32)
    extractor = EMAFeatures(spans=[2, 4], divergences=[(2, 4)])
    emas, names = extractor.transform(x)

    assert "ema_2" in names
    assert "ema_4" in names
    assert "ema_divergence_2_4" in names
    assert emas.shape == (6, 3)
    assert not np.isnan(emas).any()


def test_command_interaction_features():
    """Verify command interaction features."""
    continuous = np.array([1.5, 2.0, -0.5, 3.0], dtype=np.float32)
    commands = np.array([
        [0.0, 0.0],
        [1.0, 0.0],
        [0.0, 0.0],
        [1.0, 1.0],
    ], dtype=np.float32)

    extractor = CommandInteractionFeatures()
    cmds, names = extractor.transform(continuous, commands)

    assert "active_command_count" in names
    assert "continuous_val_when_command_active" in names
    assert "continuous_delta_when_command_active" in names

    # At row 0: commands=[0,0] -> count=0, val=0.0
    # At row 1: commands=[1,0] -> count=1, val=2.0
    # At row 2: commands=[0,0] -> count=0, val=0.0
    # At row 3: commands=[1,1] -> count=2, val=3.0
    count_col = cmds[:, names.index("active_command_count")]
    np.testing.assert_allclose(count_col, [0.0, 1.0, 0.0, 2.0])

    val_col = cmds[:, names.index("continuous_val_when_command_active")]
    np.testing.assert_allclose(val_col, [0.0, 2.0, 0.0, 3.0])


def test_feature_pipeline():
    """Verify feature pipeline end-to-end integration and schema generation."""
    X = np.zeros((50, 4), dtype=np.float32)
    X[:, 0] = np.sin(np.linspace(0, 3.14, 50))
    X[10:20, 1] = 1.0
    X[30:40, 2] = 1.0

    pipeline = FeaturePipeline(
        mission="TEST_MISSION",
        delta_orders=[1],
        rolling_windows=[5],
        rolling_metrics=["mean", "std"],
        ema_spans=[5],
        ema_divergences=[],
        include_commands=True,
    )

    X_feats, schema = pipeline.transform(X, continuous_channel_idx=0, discrete_channel_indices=[1, 2, 3])

    assert schema.mission == "TEST_MISSION"
    assert X_feats.dtype == np.float32
    assert not np.isnan(X_feats).any()
    assert not np.isinf(X_feats).any()
    assert len(schema.feature_names) == X_feats.shape[1]

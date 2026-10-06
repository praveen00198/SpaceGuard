"""Unit tests for dataset loading, validation, variance filtering, classification, and scalers."""

import numpy as np
import pytest

from research.dataset.loader import DatasetLoader
from research.dataset.validator import DatasetValidator
from research.preprocessing.classifier import ChannelClassifier
from research.preprocessing.scalers import ContinuousTransformer
from research.preprocessing.variance import VarianceFilter


def test_dataset_loader_and_validator():
    """Verify loader loads expected arrays and validator verifies integrity."""
    loader = DatasetLoader()
    
    # MSL
    msl_report = DatasetValidator.validate_mission(loader, "MSL")
    assert msl_report.is_valid is True
    assert msl_report.train_shape == (58317, 55)
    assert msl_report.test_shape == (73729, 55)
    assert msl_report.test_label_shape == (73729,)
    assert msl_report.train_nans == 0
    assert msl_report.test_nans == 0
    assert msl_report.train_infs == 0
    assert msl_report.test_infs == 0
    assert msl_report.label_length_matches is True
    assert msl_report.label_dtype_is_bool is True

    # SMAP
    smap_report = DatasetValidator.validate_mission(loader, "SMAP")
    assert smap_report.is_valid is True
    assert smap_report.train_shape == (135183, 25)
    assert smap_report.test_shape == (427617, 25)
    assert smap_report.test_label_shape == (427617,)


def test_variance_filter_fit_and_transform():
    """Test variance filtering logic, fit-split enforcement, and thresholding."""
    X_train = np.array([
        [1.0, 0.0, 5.0],
        [2.0, 0.0, 5.0],
        [3.0, 0.0, 5.0],
        [4.0, 0.0, 5.000000001],
    ])
    
    vf = VarianceFilter(threshold=1e-8)
    
    # Fails if fit on non-train split
    with pytest.raises(ValueError, match="VarianceFilter MUST be fitted on training data only"):
        vf.fit(X_train, split_name="test")
        
    vf.fit(X_train, split_name="train")
    assert vf.is_fitted_ is True
    assert vf.retained_indices_ == [0]
    assert vf.removed_indices_ == [1, 2]
    
    transformed = vf.transform(X_train)
    assert transformed.shape == (4, 1)
    np.testing.assert_array_equal(transformed[:, 0], [1.0, 2.0, 3.0, 4.0])


def test_channel_classifier():
    """Verify channel classifier categorizes continuous and discrete/binary channels."""
    X = np.zeros((100, 3), dtype=np.float64)
    # Channel 0: continuous float range
    X[:, 0] = np.linspace(-1.0, 1.0, 100)
    # Channel 1: binary indicator (0 and 1)
    X[::2, 1] = 1.0
    # Channel 2: discrete integer levels (0, 1, 2)
    X[:33, 2] = 0.0
    X[33:66, 2] = 1.0
    X[66:, 2] = 2.0

    res = ChannelClassifier.classify(X, continuous_indices=[0])
    assert res.continuous_channels == [0]
    assert 1 in res.discrete_channels
    assert 2 in res.discrete_channels
    assert len(res.mixed_channels) == 0


def test_continuous_scalers_train_fit_only():
    """Verify scalers fit only on train and transform cleanly without NaNs."""
    X_train = np.array([[-1.0, 0.0], [0.0, 1.0], [1.0, 0.0]])
    X_test = np.array([[2.0, 1.0], [-2.0, 0.0]])

    transformer = ContinuousTransformer(scaler_type="robust", mission="TEST")
    
    with pytest.raises(ValueError, match="ContinuousTransformer MUST be fitted on training data only"):
        transformer.fit(X_test, continuous_channels=[0], split_name="test")

    transformer.fit(X_train, continuous_channels=[0], split_name="train")
    assert transformer.is_fitted_ is True

    X_train_trans = transformer.transform(X_train)
    X_test_trans = transformer.transform(X_test)

    # Auxiliary channel 1 remains untouched
    np.testing.assert_array_equal(X_train_trans[:, 1], X_train[:, 1])
    np.testing.assert_array_equal(X_test_trans[:, 1], X_test[:, 1])
    assert np.isnan(X_train_trans).sum() == 0
    assert np.isnan(X_test_trans).sum() == 0

"""Unit tests for ML Phase 3C deep sequence and reconstruction models."""

from pathlib import Path
import numpy as np
import pytest

from research.models.deep.dataset import TimeSeriesSequenceDataset
from research.models.deep.lstm_forecaster import LSTMForecaster
from research.models.deep.lstm_autoencoder import LSTMAutoencoder
from research.models.deep.deep_hybrid import DeepResidualHybrid
from research.models.statistical import SimpleStatisticalDetector, TemporalStatisticalDetector


def test_time_series_sequence_dataset():
    """Verify sliding window dataset shapes."""
    X = np.random.randn(100, 5).astype(np.float32)
    ds_forecaster = TimeSeriesSequenceDataset(X, window_size=20, is_autoencoder=False)
    assert len(ds_forecaster) == 80
    w, y = ds_forecaster[0]
    assert w.shape == (20, 5)
    assert y.shape == (1,)

    ds_ae = TimeSeriesSequenceDataset(X, window_size=20, is_autoencoder=True)
    assert len(ds_ae) == 81
    w_ae, y_ae = ds_ae[0]
    assert w_ae.shape == (20, 5)
    assert y_ae.shape == (20, 5)


def test_lstm_forecaster_fit_and_scores():
    """Verify LSTMForecaster fitting, score shape, and leak-free split validation."""
    np.random.seed(42)
    X = np.random.randn(150, 4).astype(np.float32)

    forecaster = LSTMForecaster(window_size=15, hidden_dim=8, epochs=2, batch_size=32)

    # Must reject non-train splits
    with pytest.raises(ValueError, match="split_name='train'"):
        forecaster.fit(X, split_name="test")

    forecaster.fit(X, split_name="train")
    assert forecaster.is_fitted_

    scores = forecaster.compute_scores(X)
    assert scores.shape == (150,)
    assert not np.isnan(scores).any()
    assert not np.isinf(scores).any()
    assert (scores >= 0.0).all()


def test_lstm_autoencoder_fit_and_scores():
    """Verify LSTMAutoencoder reconstruction score computation."""
    np.random.seed(42)
    X = np.random.randn(150, 4).astype(np.float32)

    ae = LSTMAutoencoder(window_size=15, hidden_dim=8, latent_dim=4, epochs=2, batch_size=32)

    with pytest.raises(ValueError, match="split_name='train'"):
        ae.fit(X, split_name="val")

    ae.fit(X, split_name="train")
    assert ae.is_fitted_

    scores = ae.compute_scores(X)
    assert scores.shape == (150,)
    assert not np.isnan(scores).any()
    assert not np.isinf(scores).any()
    assert (scores >= 0.0).all()


def test_deep_residual_hybrid():
    """Verify deep hybrid combines classical and deep scores within [0, 1]."""
    np.random.seed(42)
    X = np.random.randn(150, 4).astype(np.float32)

    classical = SimpleStatisticalDetector()
    deep = LSTMForecaster(window_size=15, hidden_dim=8, epochs=2, batch_size=32)

    hybrid = DeepResidualHybrid(classical_model=classical, deep_model=deep, alpha=0.5)
    hybrid.fit(X, split_name="train")

    scores = hybrid.compute_scores(X)
    assert scores.shape == (150,)
    assert not np.isnan(scores).any()
    assert (scores >= 0.0).all()
    assert (scores <= 1.0).all()


def test_deep_models_serialization(tmp_path: Path):
    """Verify deep model persistence and reloading."""
    X = np.random.randn(100, 3).astype(np.float32)
    model = LSTMForecaster(window_size=10, hidden_dim=8, epochs=1, batch_size=32)
    model.fit(X, split_name="train")

    save_path = tmp_path / "lstm_forecaster.joblib"
    model.save(save_path)

    assert save_path.exists()
    assert save_path.with_suffix(".json").exists()

    loaded = LSTMForecaster.load(save_path)
    assert loaded.is_fitted_
    orig_scores = model.compute_scores(X)
    loaded_scores = loaded.compute_scores(X)
    np.testing.assert_allclose(orig_scores, loaded_scores, rtol=1e-5)

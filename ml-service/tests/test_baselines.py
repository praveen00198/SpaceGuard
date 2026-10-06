"""Unit tests for baseline anomaly detection models (M0..M4) using synthetic fixtures."""

from pathlib import Path
import numpy as np
import pytest

from research.models.hybrid import HybridAnomalyDetector
from research.models.isolation_forest import ResearchIsolationForest
from research.models.statistical import SimpleStatisticalDetector, TemporalStatisticalDetector


@pytest.fixture
def synthetic_train_data():
    """Nominal sinusoidal training data with noise (N=200, C=20)."""
    np.random.seed(42)
    t = np.linspace(0, 10, 200)
    data = np.zeros((200, 20), dtype=np.float32)
    data[:, 0] = np.sin(t) + np.random.normal(0, 0.05, 200)  # Continuous channel
    data[:, 1] = np.diff(np.pad(data[:, 0], (1, 0), mode="edge"))  # Delta
    data[:, 6] = data[:, 0]  # Rolling mean proxy
    data[:, 17] = np.random.normal(0, 0.02, 200)  # EMA divergence proxy
    return data


@pytest.fixture
def synthetic_test_data(synthetic_train_data):
    """Test data containing an injected anomaly spike."""
    test_data = synthetic_train_data.copy()
    # Inject large deviation at indices 100..120
    test_data[100:120, 0] += 5.0
    test_data[100:120, 1] += 5.0
    return test_data


def test_simple_statistical_detector(synthetic_train_data, synthetic_test_data):
    """M0: Verify fit strictly on train, score output, and refusal of test split fit."""
    m0 = SimpleStatisticalDetector(continuous_channel_idx=0)
    
    with pytest.raises(ValueError, match="Model must be fitted on training data only"):
        m0.fit(synthetic_test_data, split_name="test")
        
    m0.fit(synthetic_train_data, split_name="train")
    assert m0.is_fitted_ is True
    assert m0.mean_ is not None

    scores = m0.compute_scores(synthetic_test_data)
    assert len(scores) == len(synthetic_test_data)
    assert not np.isnan(scores).any()
    assert not np.isinf(scores).any()

    # Injected anomaly region should have noticeably higher score
    assert np.mean(scores[100:120]) > np.mean(scores[:50])


def test_temporal_statistical_detector(synthetic_train_data, synthetic_test_data):
    """M1: Verify temporal statistical detector combining delta, rolling, and EMA."""
    m1 = TemporalStatisticalDetector()
    m1.fit(synthetic_train_data, split_name="train")

    scores = m1.compute_scores(synthetic_test_data)
    assert len(scores) == len(synthetic_test_data)
    assert np.mean(scores[100:120]) > np.mean(scores[:50])


def test_isolation_forest_deterministic_seed(synthetic_train_data):
    """M2/M3: Verify deterministic scoring given random_state."""
    if1 = ResearchIsolationForest(n_estimators=50, random_state=42, feature_group="raw_base")
    if1.fit(synthetic_train_data, split_name="train")
    s1 = if1.compute_scores(synthetic_train_data)

    if2 = ResearchIsolationForest(n_estimators=50, random_state=42, feature_group="raw_base")
    if2.fit(synthetic_train_data, split_name="train")
    s2 = if2.compute_scores(synthetic_train_data)

    np.testing.assert_allclose(s1, s2)


def test_isolation_forest_rejects_test_fit(synthetic_test_data):
    """M2/M3: Ensure Isolation Forest refuses to fit on test data."""
    if_model = ResearchIsolationForest(n_estimators=20, random_state=42)
    with pytest.raises(ValueError, match="Model must be fitted on training data only"):
        if_model.fit(synthetic_test_data, split_name="test")


def test_isolation_forest_feature_groups(synthetic_train_data):
    """M3: Verify feature selection mechanism for ablation studies."""
    if_all = ResearchIsolationForest(feature_group="all", n_estimators=10)
    if_all.fit(synthetic_train_data, split_name="train")
    assert if_all.fit_metadata_["selected_features_count"] == synthetic_train_data.shape[1]

    if_raw = ResearchIsolationForest(feature_group="raw_base", n_estimators=10)
    if_raw.fit(synthetic_train_data, split_name="train")
    assert if_raw.fit_metadata_["selected_features_count"] == 1


def test_hybrid_detector(synthetic_train_data, synthetic_test_data):
    """M4: Verify hybrid statistical + ML detector combination."""
    stat = TemporalStatisticalDetector()
    ml = ResearchIsolationForest(n_estimators=20, random_state=42, feature_group="all")
    
    hybrid = HybridAnomalyDetector(
        statistical_detector=stat,
        ml_detector=ml,
        alpha=0.5,
        model_name="M4_TestHybrid",
    )
    
    with pytest.raises(ValueError, match="Model must be fitted on training data only"):
        hybrid.fit(synthetic_test_data, split_name="test")
        
    hybrid.fit(synthetic_train_data, split_name="train")
    assert hybrid.is_fitted_ is True

    scores = hybrid.compute_scores(synthetic_test_data)
    assert len(scores) == len(synthetic_test_data)
    assert not np.isnan(scores).any()
    assert np.mean(scores[100:120]) > np.mean(scores[:50])


def test_model_serialization(tmp_path, synthetic_train_data):
    """Verify model save and load roundtrip with metadata."""
    model = ResearchIsolationForest(n_estimators=10, random_state=42)
    model.fit(synthetic_train_data, split_name="train")

    save_path = tmp_path / "test_model.joblib"
    model.save(save_path)

    assert save_path.exists()
    assert save_path.with_suffix(".json").exists()

    loaded = ResearchIsolationForest.load(save_path)
    assert loaded.is_fitted_ is True
    assert loaded.model_name == model.model_name
    np.testing.assert_allclose(
        model.compute_scores(synthetic_train_data[:10]),
        loaded.compute_scores(synthetic_train_data[:10]),
    )

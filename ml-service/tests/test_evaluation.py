"""Unit tests for evaluation metrics, event analysis, thresholding, and registry."""

from pathlib import Path
import numpy as np
import pytest

from research.evaluation.events import EventAnalyzer
from research.evaluation.metrics import MetricsCalculator
from research.evaluation.split import ChronologicalSplitter
from research.evaluation.threshold import ThresholdSelector
from research.experiments.registry import ExperimentRecord, ExperimentRegistry


def test_chronological_split():
    """Verify strict temporal ordering without shuffling in splits."""
    series = np.arange(100)
    train, val, tr_idx, val_idx = ChronologicalSplitter.split_nominal(series, train_ratio=0.7)

    assert len(train) == 70
    assert len(val) == 30
    assert np.all(train == np.arange(70))
    assert np.all(val == np.arange(70, 100))
    assert tr_idx.start_idx == 0 and tr_idx.end_idx == 70
    assert val_idx.start_idx == 70 and val_idx.end_idx == 100


def test_event_analyzer():
    """Verify contiguous event extraction, event recall, and detection delay."""
    # 2 ground truth events: [10..15) and [30..35)
    y_true = np.zeros(50, dtype=bool)
    y_true[10:15] = True
    y_true[30:35] = True

    events = EventAnalyzer.extract_events(y_true)
    assert len(events) == 2
    assert events[0].bounds == (10, 15)
    assert events[1].bounds == (30, 35)

    # Predictions:
    # Event 1 hit at index 12 (delay = 2)
    # Event 2 missed entirely
    # Extra false alarm event at [40..42)
    y_pred = np.zeros(50, dtype=bool)
    y_pred[12] = True
    y_pred[40:42] = True

    metrics = EventAnalyzer.evaluate_events(y_true, y_pred)
    assert metrics.total_events == 2
    assert metrics.detected_events == 1
    assert metrics.missed_events == 1
    assert metrics.event_recall == 0.5
    assert metrics.false_alarm_events == 1
    assert metrics.delays == [2]
    assert metrics.mean_delay == 2.0
    assert metrics.median_delay == 2.0


def test_metrics_calculator():
    """Verify point-level and point-adjusted metrics and AUC calculations."""
    y_true = np.zeros(20, dtype=bool)
    y_true[5:10] = True  # 5 anomalous points

    y_pred = np.zeros(20, dtype=bool)
    y_pred[7] = True   # Hits inside event (1 TP, 4 FN)
    y_pred[15] = True  # Outside event (1 FP, 13 TN)

    scores = np.linspace(0.1, 0.9, 20)

    report = MetricsCalculator.evaluate(y_true, y_pred, y_scores=scores)
    pt = report.point_metrics
    assert pt.true_positives == 1
    assert pt.false_positives == 1
    assert pt.precision == 0.5
    assert pt.recall == 0.2
    assert pt.roc_auc is not None
    assert pt.pr_auc is not None

    # Point adjustment: since idx 7 was hit, entire [5:10] event is counted as detected
    adj = report.adjusted_metrics
    assert adj.recall == 1.0  # All 5 points in event marked as detected
    assert adj.precision == 5.0 / (5.0 + 1.0)  # 5 adj TP, 1 FP


def test_threshold_selector():
    """Verify nominal percentile and validation F1 threshold selection."""
    # 1. Nominal percentile
    nom_scores = np.arange(100, dtype=np.float32)
    res_nom = ThresholdSelector.from_nominal_percentile(nom_scores, false_alarm_rate=0.05)
    assert res_nom.strategy == "nominal_percentile"
    # 95th percentile of 0..99
    assert res_nom.threshold >= 94.0

    # 2. Validation F1
    val_scores = np.array([0.1, 0.2, 0.8, 0.9, 0.95], dtype=np.float32)
    val_labels = np.array([False, False, True, True, True], dtype=bool)
    res_f1 = ThresholdSelector.from_validation_f1(val_scores, val_labels)
    assert res_f1.strategy == "validation_f1_optimal"
    assert res_f1.best_metric_value == 1.0  # Perfect separation possible at th ~ 0.5..0.8


def test_experiment_registry(tmp_path):
    """Verify logging and dataframe loading in experiment registry."""
    registry = ExperimentRegistry(registry_dir=tmp_path)
    
    rec = ExperimentRecord(
        experiment_id="TEST_001",
        mission="TEST",
        model_name="TestModel",
        feature_group="all",
        window_size=128,
        stride=10,
        hyperparameters={"param": 1},
        threshold_strategy="val_f1",
        threshold=0.5,
        random_seed=42,
        precision=0.8,
        recall=0.7,
        f1_score=0.75,
        pr_auc=0.78,
        roc_auc=0.85,
        adjusted_f1=0.88,
        event_recall=0.9,
        mean_delay=3.0,
        median_delay=2.0,
        false_alarm_events=2,
        training_time_s=1.2,
        inference_time_s=0.3,
        samples_per_sec=1000.0,
        timestamp_utc="2026-10-05T00:00:00Z",
        metadata={"note": "test"},
    )

    registry.record_experiment(rec)
    df = registry.load_summary_dataframe()
    assert len(df) == 1
    assert df.iloc[0]["experiment_id"] == "TEST_001"
    assert df.iloc[0]["f1_score"] == 0.75

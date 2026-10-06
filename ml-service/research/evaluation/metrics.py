"""Comprehensive point-level, point-adjusted, and event-level evaluation metrics."""

from dataclasses import dataclass
from typing import Any, Dict, Optional
import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score

from .events import EventAnalyzer, EventMetrics


@dataclass
class PointMetrics:
    """Standard point-wise evaluation metrics."""
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float
    false_negative_rate: float
    roc_auc: Optional[float]
    pr_auc: Optional[float]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tp": self.true_positives,
            "fp": self.false_positives,
            "tn": self.true_negatives,
            "fn": self.false_negatives,
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1_score": round(self.f1_score, 4),
            "false_positive_rate": round(self.false_positive_rate, 4),
            "false_negative_rate": round(self.false_negative_rate, 4),
            "roc_auc": round(self.roc_auc, 4) if self.roc_auc is not None else None,
            "pr_auc": round(self.pr_auc, 4) if self.pr_auc is not None else None,
        }


@dataclass
class PointAdjustedMetrics:
    """Point-adjusted metrics widely used in time-series anomaly benchmarks."""
    precision: float
    recall: float
    f1_score: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "adjusted_precision": round(self.precision, 4),
            "adjusted_recall": round(self.recall, 4),
            "adjusted_f1_score": round(self.f1_score, 4),
        }


@dataclass
class EvaluationReport:
    """Complete evaluation report combining point, adjusted, and event metrics."""
    model_name: str
    dataset_name: str
    split_name: str
    num_samples: int
    anomaly_samples: int
    anomaly_ratio: float
    point_metrics: PointMetrics
    adjusted_metrics: PointAdjustedMetrics
    event_metrics: EventMetrics

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "dataset_name": self.dataset_name,
            "split_name": self.split_name,
            "num_samples": self.num_samples,
            "anomaly_samples": self.anomaly_samples,
            "anomaly_ratio": round(self.anomaly_ratio, 4),
            "point": self.point_metrics.to_dict(),
            "point_adjusted": self.adjusted_metrics.to_dict(),
            "event": self.event_metrics.to_dict(),
        }


class MetricsCalculator:
    """Calculates rigorous, leakage-safe anomaly detection metrics."""

    @classmethod
    def apply_point_adjustment(cls, y_true: np.ndarray, y_pred: np.ndarray) -> np.ndarray:
        """Apply point-adjustment strategy to predictions.
        
        If any point in a ground-truth anomaly segment is detected, all points in that
        segment are marked as detected. Outside ground-truth segments, predictions remain
        unchanged.
        """
        y_true_bool = np.asarray(y_true, dtype=bool)
        y_pred_adj = np.asarray(y_pred, dtype=bool).copy()

        events = EventAnalyzer.extract_events(y_true_bool)
        for ev in events:
            if np.any(y_pred_adj[ev.start_idx:ev.end_idx]):
                y_pred_adj[ev.start_idx:ev.end_idx] = True

        return y_pred_adj

    @classmethod
    def calculate_point_metrics(
        cls,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_scores: Optional[np.ndarray] = None,
    ) -> PointMetrics:
        """Calculate standard point-level confusion and classification metrics."""
        y_true_bool = np.asarray(y_true, dtype=bool)
        y_pred_bool = np.asarray(y_pred, dtype=bool)

        tp = int(np.sum(y_true_bool & y_pred_bool))
        fp = int(np.sum((~y_true_bool) & y_pred_bool))
        tn = int(np.sum((~y_true_bool) & (~y_pred_bool)))
        fn = int(np.sum(y_true_bool & (~y_pred_bool)))

        precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

        fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
        fnr = float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0

        roc_auc = None
        pr_auc = None
        if y_scores is not None and len(np.unique(y_true_bool)) > 1:
            try:
                roc_auc = float(roc_auc_score(y_true_bool, y_scores))
            except Exception:
                roc_auc = None
            try:
                pr_auc = float(average_precision_score(y_true_bool, y_scores))
            except Exception:
                pr_auc = None

        return PointMetrics(
            true_positives=tp,
            false_positives=fp,
            true_negatives=tn,
            false_negatives=fn,
            precision=precision,
            recall=recall,
            f1_score=f1,
            false_positive_rate=fpr,
            false_negative_rate=fnr,
            roc_auc=roc_auc,
            pr_auc=pr_auc,
        )

    @classmethod
    def evaluate(
        cls,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_scores: Optional[np.ndarray] = None,
        model_name: str = "Unknown",
        dataset_name: str = "Unknown",
        split_name: str = "test",
    ) -> EvaluationReport:
        """Run complete evaluation encompassing point, point-adjusted, and event metrics."""
        y_true_bool = np.asarray(y_true, dtype=bool)
        y_pred_bool = np.asarray(y_pred, dtype=bool)

        point_m = cls.calculate_point_metrics(y_true_bool, y_pred_bool, y_scores=y_scores)

        # Point-adjusted calculation
        y_pred_adj = cls.apply_point_adjustment(y_true_bool, y_pred_bool)
        adj_tp = int(np.sum(y_true_bool & y_pred_adj))
        adj_fp = int(np.sum((~y_true_bool) & y_pred_adj))
        adj_fn = int(np.sum(y_true_bool & (~y_pred_adj)))

        adj_p = float(adj_tp / (adj_tp + adj_fp)) if (adj_tp + adj_fp) > 0 else 0.0
        adj_r = float(adj_tp / (adj_tp + adj_fn)) if (adj_tp + adj_fn) > 0 else 0.0
        adj_f1 = float(2 * adj_p * adj_r / (adj_p + adj_r)) if (adj_p + adj_r) > 0 else 0.0

        adj_m = PointAdjustedMetrics(precision=adj_p, recall=adj_r, f1_score=adj_f1)
        event_m = EventAnalyzer.evaluate_events(y_true_bool, y_pred_bool)

        n_samples = len(y_true_bool)
        n_anom = int(np.sum(y_true_bool))

        return EvaluationReport(
            model_name=model_name,
            dataset_name=dataset_name,
            split_name=split_name,
            num_samples=n_samples,
            anomaly_samples=n_anom,
            anomaly_ratio=float(n_anom / max(1, n_samples)),
            point_metrics=point_m,
            adjusted_metrics=adj_m,
            event_metrics=event_m,
        )

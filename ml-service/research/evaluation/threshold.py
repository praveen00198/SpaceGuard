"""Threshold selection strategies ensuring zero test leakage."""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import numpy as np


@dataclass
class ThresholdCalibrationResult:
    """Metadata recorded during threshold selection."""
    strategy: str
    threshold: float
    fit_split: str
    target_param: Optional[float]
    best_metric_value: Optional[float]
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "strategy": self.strategy,
            "threshold": round(self.threshold, 6),
            "fit_split": self.fit_split,
            "target_param": self.target_param,
            "best_metric_value": round(self.best_metric_value, 4) if self.best_metric_value is not None else None,
            "metadata": self.metadata,
        }


class ThresholdSelector:
    """Calibrates detection thresholds strictly on validation data."""

    @classmethod
    def from_nominal_percentile(
        cls,
        nominal_val_scores: np.ndarray,
        false_alarm_rate: float = 0.02,
    ) -> ThresholdCalibrationResult:
        """Select threshold corresponding to target false alarm rate on nominal data.
        
        Args:
            nominal_val_scores: Anomaly scores on nominal-only validation data.
            false_alarm_rate: Expected nominal false alarm rate (e.g., 0.02 for 98th percentile).
        """
        percentile = 100.0 * (1.0 - false_alarm_rate)
        thresh = float(np.percentile(nominal_val_scores, percentile))

        return ThresholdCalibrationResult(
            strategy="nominal_percentile",
            threshold=thresh,
            fit_split="nominal_val",
            target_param=false_alarm_rate,
            best_metric_value=None,
            metadata={
                "percentile": percentile,
                "nominal_samples": len(nominal_val_scores),
                "score_min": float(np.min(nominal_val_scores)),
                "score_max": float(np.max(nominal_val_scores)),
            },
        )

    @classmethod
    def from_validation_f1(
        cls,
        val_scores: np.ndarray,
        val_labels: np.ndarray,
        num_candidates: int = 100,
    ) -> ThresholdCalibrationResult:
        """Find threshold maximizing F1 on the designated validation test subset."""
        if len(val_scores) != len(val_labels):
            raise ValueError("Scores and labels must match in length.")

        # Candidate thresholds sampled over quantiles
        quantiles = np.linspace(50, 99.9, num_candidates)
        candidates = np.percentile(val_scores, quantiles)

        best_f1 = -1.0
        best_thresh = float(candidates[0])
        best_p = 0.0
        best_r = 0.0

        y_bool = val_labels.astype(bool)

        for th in candidates:
            pred = val_scores >= th
            tp = int(np.sum(y_bool & pred))
            fp = int(np.sum((~y_bool) & pred))
            fn = int(np.sum(y_bool & (~pred)))

            p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = (2 * p * r / (p + r)) if (p + r) > 0 else 0.0

            if f1 > best_f1:
                best_f1 = f1
                best_thresh = float(th)
                best_p = p
                best_r = r

        return ThresholdCalibrationResult(
            strategy="validation_f1_optimal",
            threshold=best_thresh,
            fit_split="val_test",
            target_param=None,
            best_metric_value=best_f1,
            metadata={
                "validation_precision": round(best_p, 4),
                "validation_recall": round(best_r, 4),
                "validation_f1": round(best_f1, 4),
                "num_candidates_tested": num_candidates,
            },
        )

"""Event-level anomaly detection metrics and detection delay analysis."""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


@dataclass
class AnomalyEvent:
    """A contiguous anomalous interval in a time series."""
    event_id: int
    start_idx: int
    end_idx: int
    duration: int

    @property
    def bounds(self) -> Tuple[int, int]:
        return self.start_idx, self.end_idx


@dataclass
class EventMetrics:
    """Summary of event-level anomaly detection performance."""
    total_events: int
    detected_events: int
    missed_events: int
    event_recall: float
    false_alarm_events: int
    delays: List[int]
    mean_delay: Optional[float]
    median_delay: Optional[float]
    max_delay: Optional[int]
    immediate_detections: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_events": self.total_events,
            "detected_events": self.detected_events,
            "missed_events": self.missed_events,
            "event_recall": round(self.event_recall, 4),
            "false_alarm_events": self.false_alarm_events,
            "mean_delay": round(self.mean_delay, 2) if self.mean_delay is not None else None,
            "median_delay": round(self.median_delay, 2) if self.median_delay is not None else None,
            "max_delay": self.max_delay,
            "immediate_detections": self.immediate_detections,
        }


class EventAnalyzer:
    """Extracts contiguous anomaly segments and calculates event-level metrics."""

    @classmethod
    def extract_events(cls, binary_series: np.ndarray) -> List[AnomalyEvent]:
        """Extract contiguous segments where binary_series is True."""
        arr = np.asarray(binary_series, dtype=bool)
        n = len(arr)
        if n == 0 or not np.any(arr):
            return []

        diff = np.diff(np.pad(arr.astype(np.int8), (1, 1), mode="constant"))
        starts = np.where(diff == 1)[0]
        ends = np.where(diff == -1)[0]

        events = []
        for i, (s, e) in enumerate(zip(starts, ends)):
            events.append(AnomalyEvent(event_id=i, start_idx=int(s), end_idx=int(e), duration=int(e - s)))
        return events

    @classmethod
    def evaluate_events(
        cls,
        y_true: np.ndarray,
        y_pred: np.ndarray,
    ) -> EventMetrics:
        """Evaluate event recall, false alarms, and detection delays.
        
        Args:
            y_true: Ground truth binary array (N,)
            y_pred: Predicted binary array (N,)
        """
        gt_events = cls.extract_events(y_true)
        pred_events = cls.extract_events(y_pred)

        total_gt = len(gt_events)
        if total_gt == 0:
            return EventMetrics(
                total_events=0,
                detected_events=0,
                missed_events=0,
                event_recall=1.0 if len(pred_events) == 0 else 0.0,
                false_alarm_events=len(pred_events),
                delays=[],
                mean_delay=None,
                median_delay=None,
                max_delay=None,
                immediate_detections=0,
            )

        detected_count = 0
        delays: List[int] = []
        immediate_count = 0

        # Evaluate each ground truth event
        for ev in gt_events:
            # Slices predictions across event duration
            pred_slice = y_pred[ev.start_idx:ev.end_idx]
            hit_indices = np.where(pred_slice)[0]
            if len(hit_indices) > 0:
                detected_count += 1
                first_hit_offset = int(hit_indices[0])
                delays.append(first_hit_offset)
                if first_hit_offset == 0:
                    immediate_count += 1

        missed_count = total_gt - detected_count
        event_recall = float(detected_count / total_gt)

        # Count false alarm events (predicted events with 0 overlap with any true anomaly point)
        false_alarms = 0
        for pe in pred_events:
            if not np.any(y_true[pe.start_idx:pe.end_idx]):
                false_alarms += 1

        mean_d = float(np.mean(delays)) if delays else None
        med_d = float(np.median(delays)) if delays else None
        max_d = int(np.max(delays)) if delays else None

        return EventMetrics(
            total_events=total_gt,
            detected_events=detected_count,
            missed_events=missed_count,
            event_recall=event_recall,
            false_alarm_events=false_alarms,
            delays=delays,
            mean_delay=mean_d,
            median_delay=med_d,
            max_delay=max_d,
            immediate_detections=immediate_count,
        )

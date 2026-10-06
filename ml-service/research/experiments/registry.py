"""Experiment registry and metrics persistence for Phase 3B benchmarking."""

import csv
from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd


@dataclass
class ExperimentRecord:
    """Documented record of a single benchmark experiment."""
    experiment_id: str
    mission: str
    model_name: str
    feature_group: str
    window_size: Optional[int]
    stride: Optional[int]
    hyperparameters: Dict[str, Any]
    threshold_strategy: str
    threshold: float
    random_seed: int
    precision: float
    recall: float
    f1_score: float
    pr_auc: Optional[float]
    roc_auc: Optional[float]
    adjusted_f1: float
    event_recall: float
    mean_delay: Optional[float]
    median_delay: Optional[float]
    false_alarm_events: int
    training_time_s: float
    inference_time_s: float
    samples_per_sec: float
    timestamp_utc: str
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "experiment_id": self.experiment_id,
            "mission": self.mission,
            "model_name": self.model_name,
            "feature_group": self.feature_group,
            "window_size": self.window_size,
            "stride": self.stride,
            "hyperparameters": self.hyperparameters,
            "threshold_strategy": self.threshold_strategy,
            "threshold": self.threshold,
            "random_seed": self.random_seed,
            "precision": self.precision,
            "recall": self.recall,
            "f1_score": self.f1_score,
            "pr_auc": self.pr_auc,
            "roc_auc": self.roc_auc,
            "adjusted_f1": self.adjusted_f1,
            "event_recall": self.event_recall,
            "mean_delay": self.mean_delay,
            "median_delay": self.median_delay,
            "false_alarm_events": self.false_alarm_events,
            "training_time_s": round(self.training_time_s, 4),
            "inference_time_s": round(self.inference_time_s, 4),
            "samples_per_sec": round(self.samples_per_sec, 2),
            "timestamp_utc": self.timestamp_utc,
            "metadata": self.metadata,
        }

    def to_csv_row(self) -> Dict[str, Any]:
        d = self.to_dict()
        del d["hyperparameters"]
        del d["metadata"]
        return d


class ExperimentRegistry:
    """Manages appending and querying benchmark experiment records."""

    def __init__(self, registry_dir: Path | str | None = None) -> None:
        if registry_dir is None:
            # Default to ml-service/experiments
            candidates = [
                Path(__file__).parents[2] / "experiments",
                Path("experiments"),
                Path("ml-service/experiments"),
            ]
            for c in candidates:
                if c.exists() or c.parent.exists():
                    registry_dir = c
                    break

        self.registry_dir = Path(registry_dir) if registry_dir else Path("experiments")
        self.registry_dir.mkdir(parents=True, exist_ok=True)
        self.json_path = self.registry_dir / "experiments.json"
        self.csv_path = self.registry_dir / "results.csv"

    def record_experiment(self, record: ExperimentRecord) -> None:
        """Append an experiment run to JSON registry and CSV summary table."""
        # 1. Update JSON list
        records: List[Dict[str, Any]] = []
        if self.json_path.exists():
            try:
                with open(self.json_path, "r", encoding="utf-8") as f:
                    records = json.load(f)
            except Exception:
                records = []

        records.append(record.to_dict())
        with open(self.json_path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2)

        # 2. Update CSV summary
        row = record.to_csv_row()
        write_header = not self.csv_path.exists() or self.csv_path.stat().st_size == 0

        with open(self.csv_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(row.keys()))
            if write_header:
                writer.writeheader()
            writer.writerow(row)

    def load_summary_dataframe(self) -> pd.DataFrame:
        """Load experiment results into a Pandas DataFrame."""
        if not self.csv_path.exists():
            return pd.DataFrame()
        return pd.read_csv(self.csv_path)

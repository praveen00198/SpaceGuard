"""Benchmark runner executing ML Phase 3C deep sequence and reconstruction experiments."""

from datetime import datetime, timezone
from pathlib import Path
import time
from typing import Any, Dict, List, Optional
import numpy as np

from research.dataset.loader import DatasetLoader
from research.evaluation.events import EventAnalyzer
from research.evaluation.metrics import MetricsCalculator
from research.evaluation.split import ChronologicalSplitter, DatasetSplits
from research.evaluation.threshold import ThresholdSelector
from research.models.base import BaseAnomalyDetector
from research.models.deep.lstm_forecaster import LSTMForecaster
from research.models.deep.lstm_autoencoder import LSTMAutoencoder
from research.models.deep.deep_hybrid import DeepResidualHybrid
from research.models.hybrid import HybridAnomalyDetector
from research.models.isolation_forest import ResearchIsolationForest
from research.models.statistical import TemporalStatisticalDetector
from .registry import ExperimentRecord, ExperimentRegistry


class DeepBenchmarkRunner:
    """Orchestrates Phase 3C deep sequence experiments, evaluations, and logging."""

    def __init__(
        self,
        processed_dir: Path | str | None = None,
        models_dir: Path | str | None = None,
        registry: Optional[ExperimentRegistry] = None,
    ) -> None:
        if processed_dir is None:
            processed_dir = Path(__file__).parents[2] / "data" / "processed"
        if models_dir is None:
            models_dir = Path(__file__).parents[2] / "artifacts" / "models" / "research" / "deep"

        self.processed_dir = Path(processed_dir)
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.registry = registry or ExperimentRegistry()

    def run_single_experiment(
        self,
        experiment_id: str,
        mission: str,
        model: BaseAnomalyDetector,
        X_train_nom: np.ndarray,
        X_val_nom: np.ndarray,
        X_val_test: np.ndarray,
        y_val_test: np.ndarray,
        X_final_test: np.ndarray,
        y_final_test: np.ndarray,
        feature_group: str = "all",
        window_size: Optional[int] = None,
        random_seed: int = 42,
        save_model: bool = True,
    ) -> ExperimentRecord:
        """Run training, threshold calibration on test validation, and evaluation on held-out test."""
        print(f"\n--- Running {experiment_id} ({mission} / {model.model_name}) ---")

        # 1. Fit on nominal training split only
        t0_train = time.perf_counter()
        model.fit(X_train_nom, split_name="train")
        train_time = time.perf_counter() - t0_train
        print(f"  Training completed in {train_time:.2f}s")

        # 2. Score on validation test split for threshold calibration
        val_scores = model.compute_scores(X_val_test)
        th_res = ThresholdSelector.from_validation_f1(val_scores, y_val_test)
        calibrated_th = th_res.threshold
        best_val_f1 = th_res.best_metric_value if th_res.best_metric_value is not None else 0.0
        print(f"  Calibrated threshold on validation split: {calibrated_th:.4f} (Val F1: {best_val_f1:.4f})")

        # 3. Score and evaluate on final held-out test split
        t0_inf = time.perf_counter()
        test_scores = model.compute_scores(X_final_test)
        inf_time = time.perf_counter() - t0_inf
        samples_sec = len(X_final_test) / max(inf_time, 1e-6)

        test_preds = test_scores >= calibrated_th
        eval_report = MetricsCalculator.evaluate(
            y_true=y_final_test,
            y_pred=test_preds,
            y_scores=test_scores,
            model_name=model.model_name,
            dataset_name=mission,
            split_name="final_test",
        )

        pt = eval_report.point_metrics
        adj = eval_report.adjusted_metrics
        ev = eval_report.event_metrics

        print(
            f"  Final Test Metrics: F1={pt.f1_score:.4f} (adj={adj.f1_score:.4f}) | "
            f"PR-AUC={pt.pr_auc:.4f} | Event Recall={ev.event_recall*100:.1f}% | "
            f"Median Delay={ev.median_delay} steps"
        )

        # 4. Save model artifact if requested
        if save_model:
            model_path = self.models_dir / f"{mission}_{experiment_id}_{model.model_name}.joblib"
            model.save(model_path)
            print(f"  Saved model artifact to {model_path.name}")

        rec = ExperimentRecord(
            experiment_id=experiment_id,
            mission=mission,
            model_name=model.model_name,
            feature_group=feature_group,
            window_size=window_size or getattr(model, "window_size", None),
            stride=None,
            hyperparameters=model.fit_metadata_,
            threshold_strategy=th_res.strategy,
            threshold=calibrated_th,
            random_seed=random_seed,
            precision=pt.precision,
            recall=pt.recall,
            f1_score=pt.f1_score,
            pr_auc=pt.pr_auc,
            roc_auc=pt.roc_auc,
            adjusted_f1=adj.f1_score,
            event_recall=ev.event_recall,
            mean_delay=ev.mean_delay,
            median_delay=ev.median_delay,
            false_alarm_events=ev.false_alarm_events,
            training_time_s=train_time,
            inference_time_s=inf_time,
            samples_per_sec=samples_sec,
            timestamp_utc=datetime.now(timezone.utc).isoformat(),
            metadata={
                "threshold_calibration": th_res.to_dict(),
                "test_samples": len(X_final_test),
                "anomaly_samples": int(np.sum(y_final_test)),
            },
        )

        self.registry.record_experiment(rec)
        return rec

    def run_suite_for_mission(self, mission: str) -> List[ExperimentRecord]:
        """Run Phase 3C deep benchmark experiments for a given mission."""
        records: List[ExperimentRecord] = []

        feat_base = self.processed_dir / mission / "features"
        train_feat_path = feat_base / f"{mission}_train_features.npy"
        test_feat_path = feat_base / f"{mission}_test_features.npy"

        if not train_feat_path.exists() or not test_feat_path.exists():
            raise FileNotFoundError(f"Processed features for {mission} not found under {feat_base}.")

        X_train_full = np.load(train_feat_path)
        X_test_full = np.load(test_feat_path)

        loader = DatasetLoader()
        _, test_split = loader.load_mission(mission)
        y_test_full = test_split.labels

        splits: DatasetSplits = ChronologicalSplitter.create_research_splits(
            mission=mission,
            X_train=X_train_full,
            X_test=X_test_full,
            y_test=y_test_full,
            train_ratio=0.7,
            val_test_ratio=0.3,
        )

        # Baseline Classical Model for Hybrid blending (Phase 3B M4)
        classical_stat = TemporalStatisticalDetector()
        classical_if = ResearchIsolationForest(n_estimators=100, random_state=42)
        classical_m4 = HybridAnomalyDetector(
            statistical_detector=classical_stat,
            ml_detector=classical_if,
            alpha=0.50,
        )

        existing_ids = set()
        if self.registry.csv_path.exists():
            import csv
            with open(self.registry.csv_path, mode="r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    if "experiment_id" in row:
                        existing_ids.add(row["experiment_id"])

        # Experiment D001: LSTM Forecaster W=50
        exp_id = f"EXP_{mission}_D001_LSTM_Pred"
        if exp_id in existing_ids:
            print(f"Skipping {exp_id} (already executed)")
        else:
            m_d1 = LSTMForecaster(window_size=50, hidden_dim=32, epochs=3, batch_size=512, lr=1e-3, random_seed=42)
            r_d1 = self.run_single_experiment(
                experiment_id=exp_id,
                mission=mission,
                model=m_d1,
                X_train_nom=splits.nominal_train,
                X_val_nom=splits.nominal_val,
                X_val_test=splits.val_test_data,
                y_val_test=splits.val_test_labels,
                X_final_test=splits.final_test_data,
                y_final_test=splits.final_test_labels,
                feature_group="all",
                window_size=50,
            )
            records.append(r_d1)

        # Experiment D002: LSTM Forecaster W=100
        exp_id_d2 = f"EXP_{mission}_D002_LSTM_Pred_W100"
        if exp_id_d2 in existing_ids:
            print(f"Skipping {exp_id_d2} (already executed)")
        else:
            m_d2 = LSTMForecaster(window_size=100, hidden_dim=32, epochs=3, batch_size=512, lr=1e-3, random_seed=42)
            r_d2 = self.run_single_experiment(
                experiment_id=exp_id_d2,
                mission=mission,
                model=m_d2,
                X_train_nom=splits.nominal_train,
                X_val_nom=splits.nominal_val,
                X_val_test=splits.val_test_data,
                y_val_test=splits.val_test_labels,
                X_final_test=splits.final_test_data,
                y_final_test=splits.final_test_labels,
                feature_group="all",
                window_size=100,
            )
            records.append(r_d2)

        # Experiment D003: LSTM Autoencoder W=50
        exp_id_d3 = f"EXP_{mission}_D003_LSTM_AE"
        if exp_id_d3 in existing_ids:
            print(f"Skipping {exp_id_d3} (already executed)")
        else:
            m_d3 = LSTMAutoencoder(window_size=50, hidden_dim=32, latent_dim=16, epochs=3, batch_size=512, lr=1e-3, random_seed=42)
            r_d3 = self.run_single_experiment(
                experiment_id=exp_id_d3,
                mission=mission,
                model=m_d3,
                X_train_nom=splits.nominal_train,
                X_val_nom=splits.nominal_val,
                X_val_test=splits.val_test_data,
                y_val_test=splits.val_test_labels,
                X_final_test=splits.final_test_data,
                y_final_test=splits.final_test_labels,
                feature_group="all",
                window_size=50,
            )
            records.append(r_d3)

        # Experiment D004: Deep Residual Hybrid (Classical M4 + LSTM Forecaster W=50)
        exp_id_d4 = f"EXP_{mission}_D004_DeepHybrid"
        if exp_id_d4 in existing_ids:
            print(f"Skipping {exp_id_d4} (already executed)")
        else:
            d1_for_hybrid = LSTMForecaster(window_size=50, hidden_dim=32, epochs=3, batch_size=512, lr=1e-3, random_seed=42)
            m_d4 = DeepResidualHybrid(
                classical_model=classical_m4,
                deep_model=d1_for_hybrid,
                alpha=0.50,
            )
            r_d4 = self.run_single_experiment(
                experiment_id=exp_id_d4,
                mission=mission,
                model=m_d4,
                X_train_nom=splits.nominal_train,
                X_val_nom=splits.nominal_val,
                X_val_test=splits.val_test_data,
                y_val_test=splits.val_test_labels,
                X_final_test=splits.final_test_data,
                y_final_test=splits.final_test_labels,
                feature_group="all",
                window_size=50,
            )
            records.append(r_d4)

        return records

    def run_all(self) -> Dict[str, List[ExperimentRecord]]:
        """Run full Phase 3C benchmark for MSL and SMAP."""
        return {
            "MSL": self.run_suite_for_mission("MSL"),
            "SMAP": self.run_suite_for_mission("SMAP"),
        }


if __name__ == "__main__":
    runner = DeepBenchmarkRunner()
    results = runner.run_all()
    print("\nPhase 3C Deep Benchmark Suite Complete!")

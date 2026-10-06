"""Benchmark runner executing controlled experiments for M0..M4 baselines."""

from datetime import datetime, timezone
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from research.dataset.loader import DatasetLoader
from research.evaluation.events import EventAnalyzer
from research.evaluation.metrics import MetricsCalculator
from research.evaluation.split import ChronologicalSplitter, DatasetSplits
from research.evaluation.threshold import ThresholdSelector
from research.models.base import BaseAnomalyDetector
from research.models.hybrid import HybridAnomalyDetector
from research.models.isolation_forest import ResearchIsolationForest
from research.models.statistical import SimpleStatisticalDetector, TemporalStatisticalDetector
from research.windowing.builder import WindowBuilder
from research.windowing.labeling import WindowLabeler
from .registry import ExperimentRecord, ExperimentRegistry


class BenchmarkRunner:
    """Orchestrates Phase 3B baseline experiments, ablations, and registry logging."""

    def __init__(
        self,
        processed_dir: Path | str | None = None,
        models_dir: Path | str | None = None,
        registry: Optional[ExperimentRegistry] = None,
    ) -> None:
        if processed_dir is None:
            processed_dir = Path(__file__).parents[2] / "data" / "processed"
        if models_dir is None:
            models_dir = Path(__file__).parents[2] / "artifacts" / "models" / "research"

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
        stride: Optional[int] = None,
        random_seed: int = 42,
        threshold_mode: str = "val_f1",  # "val_f1" or "nominal_percentile"
        save_model: bool = False,
    ) -> ExperimentRecord:
        """Run an end-to-end experiment: fit, calibrate threshold, evaluate, and record."""
        # 1. Fit on nominal training split only
        t0_train = time.perf_counter()
        model.fit(X_train_nom, split_name="train")
        train_time = time.perf_counter() - t0_train

        # 2. Score on validation data for threshold calibration
        if threshold_mode == "val_f1":
            val_scores = model.compute_scores(X_val_test)
            th_res = ThresholdSelector.from_validation_f1(val_scores, y_val_test)
            calibrated_th = th_res.threshold
        else:
            val_nom_scores = model.compute_scores(X_val_nom)
            th_res = ThresholdSelector.from_nominal_percentile(val_nom_scores, false_alarm_rate=0.02)
            calibrated_th = th_res.threshold

        # 3. Score and evaluate on final held-out test data
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

        # 4. Save model artifact if requested
        if save_model:
            model_path = self.models_dir / f"{mission}_{experiment_id}_{model.model_name}.joblib"
            model.save(model_path)

        rec = ExperimentRecord(
            experiment_id=experiment_id,
            mission=mission,
            model_name=model.model_name,
            feature_group=feature_group,
            window_size=window_size,
            stride=stride,
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

    def run_mission_benchmark(
        self,
        mission: str,
        random_seeds: List[int] | None = None,
    ) -> List[ExperimentRecord]:
        """Execute complete Phase 3B baseline benchmark matrix for a mission."""
        seeds = random_seeds or [42]
        records: List[ExperimentRecord] = []

        # Load Phase 3A preprocessed feature arrays
        feat_base = self.processed_dir / mission / "features"
        train_feat_path = feat_base / f"{mission}_train_features.npy"
        test_feat_path = feat_base / f"{mission}_test_features.npy"

        if not train_feat_path.exists() or not test_feat_path.exists():
            raise FileNotFoundError(
                f"Processed features for {mission} not found under {feat_base}. Run Phase 3A runner first."
            )

        X_train_full = np.load(train_feat_path)
        X_test_full = np.load(test_feat_path)

        # Load raw test labels
        loader = DatasetLoader()
        _, test_split = loader.load_mission(mission)
        y_test_full = test_split.labels

        # Chronological Splitting: 70% nominal train, 30% nominal val; 30% val test, 70% final test
        splits = ChronologicalSplitter.create_research_splits(
            mission=mission,
            X_train=X_train_full,
            X_test=X_test_full,
            y_test=y_test_full,
            train_ratio=0.7,
            val_test_ratio=0.3,
        )

        # -------------------------------------------------------------
        # E001 — M0: Simple Statistical Baseline (Z-score on continuous channel)
        # -------------------------------------------------------------
        m0 = SimpleStatisticalDetector(continuous_channel_idx=0)
        rec_m0 = self.run_single_experiment(
            experiment_id=f"EXP_{mission}_E001_M0",
            mission=mission,
            model=m0,
            X_train_nom=splits.nominal_train,
            X_val_nom=splits.nominal_val,
            X_val_test=splits.val_test_data,
            y_val_test=splits.val_test_labels,
            X_final_test=splits.final_test_data,
            y_final_test=splits.final_test_labels,
            feature_group="raw_base",
            threshold_mode="val_f1",
        )
        records.append(rec_m0)

        # -------------------------------------------------------------
        # E002 — M1: Temporal Statistical Detector
        # -------------------------------------------------------------
        m1 = TemporalStatisticalDetector()
        rec_m1 = self.run_single_experiment(
            experiment_id=f"EXP_{mission}_E002_M1",
            mission=mission,
            model=m1,
            X_train_nom=splits.nominal_train,
            X_val_nom=splits.nominal_val,
            X_val_test=splits.val_test_data,
            y_val_test=splits.val_test_labels,
            X_final_test=splits.final_test_data,
            y_final_test=splits.final_test_labels,
            feature_group="temporal_stat",
            threshold_mode="val_f1",
        )
        records.append(rec_m1)

        # -------------------------------------------------------------
        # E003 — M2: Baseline Isolation Forest (Raw continuous channel)
        # -------------------------------------------------------------
        m2 = ResearchIsolationForest(
            model_name="M2_IsolationForest_Raw",
            n_estimators=100,
            feature_group="raw_base",
            random_state=42,
        )
        rec_m2 = self.run_single_experiment(
            experiment_id=f"EXP_{mission}_E003_M2",
            mission=mission,
            model=m2,
            X_train_nom=splits.nominal_train,
            X_val_nom=splits.nominal_val,
            X_val_test=splits.val_test_data,
            y_val_test=splits.val_test_labels,
            X_final_test=splits.final_test_data,
            y_final_test=splits.final_test_labels,
            feature_group="raw_base",
            random_seed=42,
            threshold_mode="val_f1",
        )
        records.append(rec_m2)

        # -------------------------------------------------------------
        # E004 — M3: Feature Isolation Forest (All Features)
        # -------------------------------------------------------------
        m3_all = ResearchIsolationForest(
            model_name="M3_IsolationForest_AllFeatures",
            n_estimators=100,
            feature_group="all",
            random_state=42,
        )
        rec_m3 = self.run_single_experiment(
            experiment_id=f"EXP_{mission}_E004_M3_All",
            mission=mission,
            model=m3_all,
            X_train_nom=splits.nominal_train,
            X_val_nom=splits.nominal_val,
            X_val_test=splits.val_test_data,
            y_val_test=splits.val_test_labels,
            X_final_test=splits.final_test_data,
            y_final_test=splits.final_test_labels,
            feature_group="all",
            random_seed=42,
            threshold_mode="val_f1",
            save_model=True,
        )
        records.append(rec_m3)

        # -------------------------------------------------------------
        # Feature Ablation Studies (M3): Delta, Rolling, EMA
        # -------------------------------------------------------------
        ablations = [
            ("E005_M3_Delta", "raw_plus_delta"),
            ("E006_M3_Rolling", "raw_plus_rolling"),
            ("E007_M3_EMA", "raw_plus_ema"),
        ]
        for exp_tag, f_group in ablations:
            m_abl = ResearchIsolationForest(
                model_name=f"M3_IsolationForest_{f_group}",
                n_estimators=100,
                feature_group=f_group,
                random_state=42,
            )
            rec_abl = self.run_single_experiment(
                experiment_id=f"EXP_{mission}_{exp_tag}",
                mission=mission,
                model=m_abl,
                X_train_nom=splits.nominal_train,
                X_val_nom=splits.nominal_val,
                X_val_test=splits.val_test_data,
                y_val_test=splits.val_test_labels,
                X_final_test=splits.final_test_data,
                y_final_test=splits.final_test_labels,
                feature_group=f_group,
                random_seed=42,
                threshold_mode="val_f1",
            )
            records.append(rec_abl)

        # -------------------------------------------------------------
        # M4: Hybrid Detectors (alpha = 0.25, 0.50, 0.75)
        # -------------------------------------------------------------
        for alpha in [0.25, 0.50, 0.75]:
            stat_base = TemporalStatisticalDetector()
            ml_base = ResearchIsolationForest(
                model_name=f"M3_IF_sub_alpha_{alpha}",
                n_estimators=100,
                feature_group="all",
                random_state=42,
            )
            m4 = HybridAnomalyDetector(
                statistical_detector=stat_base,
                ml_detector=ml_base,
                alpha=alpha,
                model_name=f"M4_Hybrid_a{int(alpha*100)}",
            )
            rec_m4 = self.run_single_experiment(
                experiment_id=f"EXP_{mission}_E008_M4_a{int(alpha*100)}",
                mission=mission,
                model=m4,
                X_train_nom=splits.nominal_train,
                X_val_nom=splits.nominal_val,
                X_val_test=splits.val_test_data,
                y_val_test=splits.val_test_labels,
                X_final_test=splits.final_test_data,
                y_final_test=splits.final_test_labels,
                feature_group="hybrid_all",
                random_seed=42,
                threshold_mode="val_f1",
                save_model=(alpha == 0.50),
            )
            records.append(rec_m4)

        # -------------------------------------------------------------
        # Window Ablation Study (W in [50, 100, 128, 256], Stride=10)
        # -------------------------------------------------------------
        for w_len in [50, 100, 128, 256]:
            wb = WindowBuilder(window_size=w_len, stride=10)
            X_tr_w, _, _ = wb.build_windows(splits.nominal_train)
            X_vn_w, _, _ = wb.build_windows(splits.nominal_val)
            X_vt_w, b_vt, _ = wb.build_windows(splits.val_test_data)
            X_ft_w, b_ft, _ = wb.build_windows(splits.final_test_data)

            lbl_vt = WindowLabeler.label_windows(splits.val_test_labels, b_vt)
            lbl_ft = WindowLabeler.label_windows(splits.final_test_labels, b_ft)

            m_win = ResearchIsolationForest(
                model_name=f"M3_Window_W{w_len}",
                n_estimators=100,
                feature_group="all",
                random_state=42,
            )
            rec_win = self.run_single_experiment(
                experiment_id=f"EXP_{mission}_WIN_W{w_len}",
                mission=mission,
                model=m_win,
                X_train_nom=X_tr_w,
                X_val_nom=X_vn_w,
                X_val_test=X_vt_w,
                y_val_test=lbl_vt.contains_anomaly,
                X_final_test=X_ft_w,
                y_final_test=lbl_ft.contains_anomaly,
                feature_group="window_pooled",
                window_size=w_len,
                stride=10,
                random_seed=42,
                threshold_mode="val_f1",
            )
            records.append(rec_win)

        # -------------------------------------------------------------
        # Seed Stability Testing for Top Candidate (seeds 42, 123, 456)
        # -------------------------------------------------------------
        for s in [123, 456]:
            m3_seed = ResearchIsolationForest(
                model_name="M3_IsolationForest_AllFeatures",
                n_estimators=100,
                feature_group="all",
                random_state=s,
            )
            rec_seed = self.run_single_experiment(
                experiment_id=f"EXP_{mission}_SEED_s{s}",
                mission=mission,
                model=m3_seed,
                X_train_nom=splits.nominal_train,
                X_val_nom=splits.nominal_val,
                X_val_test=splits.val_test_data,
                y_val_test=splits.val_test_labels,
                X_final_test=splits.final_test_data,
                y_final_test=splits.final_test_labels,
                feature_group="all",
                random_seed=s,
                threshold_mode="val_f1",
            )
            records.append(rec_seed)

        return records

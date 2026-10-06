"""End-to-end preprocessing, feature extraction, and artifact generator."""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict
import numpy as np

from .config import load_research_config
from .dataset.loader import DatasetLoader
from .dataset.validator import DatasetValidator
from .features.pipeline import FeaturePipeline
from .preprocessing.classifier import ChannelClassifier
from .preprocessing.scalers import ContinuousTransformer
from .preprocessing.variance import VarianceFilter
from .windowing.builder import WindowBuilder
from .windowing.labeling import WindowLabeler


def run_pipeline_for_mission(
    mission: str,
    raw_dir: Path | str | None = None,
    output_dir: Path | str | None = None,
    artifacts_dir: Path | str | None = None,
    config: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Execute complete Phase 3A research pipeline for a single mission."""
    if config is None:
        config = load_research_config()

    loader = DatasetLoader(raw_dir)
    val_report = DatasetValidator.validate_mission(loader, mission)
    if not val_report.is_valid:
        raise ValueError(f"Integrity validation failed for {mission}: {val_report.details}")

    train_split, test_split = loader.load_mission(mission)

    # 1. Variance Filter (Train only)
    var_thresh = config.get("variance_filter", {}).get("threshold", 1e-8)
    var_filter = VarianceFilter(threshold=var_thresh)
    var_filter.fit(train_split.data, split_name="train")

    X_train_filtered = var_filter.transform(train_split.data)
    X_test_filtered = var_filter.transform(test_split.data)
    var_meta = var_filter.get_metadata()

    # 2. Channel Classification
    class_res = ChannelClassifier.classify(X_train_filtered, continuous_indices=[0])

    # 3. Continuous Scaler (Train only)
    scaler_type = config.get("scalers", {}).get("default_continuous", "robust")
    transformer = ContinuousTransformer(scaler_type=scaler_type, mission=mission)
    transformer.fit(X_train_filtered, continuous_channels=[0], split_name="train")

    X_train_scaled = transformer.transform(X_train_filtered)
    X_test_scaled = transformer.transform(X_test_filtered)

    # 4. Feature Engineering
    tf_cfg = config.get("temporal_features", {})
    delta_orders = tf_cfg.get("deltas", {}).get("orders", [1])
    rolling_windows = tf_cfg.get("rolling", {}).get("windows", [10, 30, 100])
    rolling_metrics = tf_cfg.get("rolling", {}).get("metrics", ["mean", "std", "min", "max"])
    ema_spans = tf_cfg.get("ema", {}).get("spans", [10, 30, 100])
    ema_divs = tf_cfg.get("ema", {}).get("divergences", [(10, 30), (30, 100)])

    discrete_indices = [i for i in range(X_train_scaled.shape[1]) if i != 0]

    pipeline = FeaturePipeline(
        mission=mission,
        delta_orders=delta_orders,
        rolling_windows=rolling_windows,
        rolling_metrics=rolling_metrics,
        ema_spans=ema_spans,
        ema_divergences=[tuple(d) for d in ema_divs],
        include_commands=True,
    )

    X_train_feat, train_schema = pipeline.transform(
        X_train_scaled, continuous_channel_idx=0, discrete_channel_indices=discrete_indices
    )
    X_test_feat, test_schema = pipeline.transform(
        X_test_scaled, continuous_channel_idx=0, discrete_channel_indices=discrete_indices
    )

    # 5. Windowing & Labeling for Candidate Sizes
    win_cfg = config.get("windowing", {})
    candidate_sizes = win_cfg.get("candidate_window_sizes", [50, 100, 128, 256])
    candidate_strides = win_cfg.get("candidate_strides", [1, 5, 10])
    default_w = win_cfg.get("default_window_size", 128)
    default_s = win_cfg.get("default_stride", 10)
    maj_thresh = win_cfg.get("labeling", {}).get("majority_threshold", 0.5)

    window_eval_results: Dict[str, Any] = {}

    for w_size in candidate_sizes:
        for stride in candidate_strides:
            wb = WindowBuilder(window_size=w_size, stride=stride)
            est_train_mb = wb.estimate_memory_mb(len(X_train_feat), X_train_feat.shape[1])
            est_test_mb = wb.estimate_memory_mb(len(X_test_feat), X_test_feat.shape[1])

            key = f"W{w_size}_S{stride}"
            # For large evaluations, calculate bounds and label stats without keeping massive 3D arrays
            starts = np.arange(0, len(X_test_feat) - w_size + 1, stride)
            bounds = np.column_stack([starts, starts + w_size])
            w_labels = WindowLabeler.label_windows(test_split.labels, bounds, majority_threshold=maj_thresh)

            window_eval_results[key] = {
                "window_size": w_size,
                "stride": stride,
                "train_windows": (len(X_train_feat) - w_size) // stride + 1,
                "test_windows": len(bounds),
                "est_train_mb": round(est_train_mb, 2),
                "est_test_mb": round(est_test_mb, 2),
                "label_stats": w_labels.to_dict(),
            }

    # 6. Build Default Research Window Arrays
    def_wb = WindowBuilder(window_size=default_w, stride=default_s)
    X_train_windows, train_bounds, train_w_meta = def_wb.build_windows(X_train_feat)
    X_test_windows, test_bounds, test_w_meta = def_wb.build_windows(X_test_feat)
    default_labels = WindowLabeler.label_windows(test_split.labels, test_bounds, majority_threshold=maj_thresh)

    # 7. Persist Research Artifacts
    if output_dir is None:
        output_dir = Path(__file__).parents[1] / "data" / "processed"
    if artifacts_dir is None:
        artifacts_dir = Path(__file__).parents[1] / "artifacts"

    proc_base = Path(output_dir) / mission
    art_base = Path(artifacts_dir) / "features" / mission

    (proc_base / "preprocessing").mkdir(parents=True, exist_ok=True)
    (proc_base / "features").mkdir(parents=True, exist_ok=True)
    (proc_base / "windows").mkdir(parents=True, exist_ok=True)
    art_base.mkdir(parents=True, exist_ok=True)

    # Save preprocessing metadata
    var_filter.save_metadata(proc_base / "preprocessing" / "variance_filter.json")
    ChannelClassifier.save_classification(class_res, proc_base / "preprocessing" / "channel_classification.json")
    transformer.save(proc_base / "preprocessing" / "continuous_scaler.joblib")

    # Save feature schema
    train_schema.save(art_base / "feature_schema.json")

    # Save processed features (2D arrays)
    np.save(proc_base / "features" / f"{mission}_train_features.npy", X_train_feat)
    np.save(proc_base / "features" / f"{mission}_test_features.npy", X_test_feat)

    # Save default 3D window tensors and labels
    np.save(proc_base / "windows" / f"{mission}_train_windows_w{default_w}_s{default_s}.npy", X_train_windows)
    np.save(proc_base / "windows" / f"{mission}_test_windows_w{default_w}_s{default_s}.npy", X_test_windows)
    np.save(proc_base / "windows" / f"{mission}_test_window_labels_w{default_w}_s{default_s}.npy", default_labels.contains_anomaly)
    np.save(proc_base / "windows" / f"{mission}_test_window_bounds_w{default_w}_s{default_s}.npy", test_bounds)

    result_summary = {
        "mission": mission,
        "raw_train_shape": list(train_split.data.shape),
        "raw_test_shape": list(test_split.data.shape),
        "retained_channels": len(var_meta.retained_channels),
        "removed_channels": len(var_meta.removed_channels),
        "continuous_channels": len(class_res.continuous_channels),
        "discrete_channels": len(class_res.discrete_channels),
        "mixed_channels": len(class_res.mixed_channels),
        "engineered_feature_count": X_train_feat.shape[1],
        "feature_names": train_schema.feature_names,
        "default_window": {
            "window_size": default_w,
            "stride": default_s,
            "train_tensor_shape": list(X_train_windows.shape),
            "test_tensor_shape": list(X_test_windows.shape),
            "test_label_stats": default_labels.to_dict(),
        },
        "candidate_evaluations": window_eval_results,
    }

    return result_summary


def run_all_pipeline(
    raw_dir: Path | str | None = None,
    output_dir: Path | str | None = None,
    artifacts_dir: Path | str | None = None,
) -> Dict[str, Any]:
    """Execute pipeline for MSL and SMAP and generate PROCESSING_MANIFEST.json."""
    if output_dir is None:
        output_dir = Path(__file__).parents[1] / "data" / "processed"
    if artifacts_dir is None:
        artifacts_dir = Path(__file__).parents[1] / "artifacts"

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    msl_results = run_pipeline_for_mission("MSL", raw_dir=raw_dir, output_dir=output_dir, artifacts_dir=artifacts_dir)
    smap_results = run_pipeline_for_mission("SMAP", raw_dir=raw_dir, output_dir=output_dir, artifacts_dir=artifacts_dir)

    manifest = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "phase": "ML Phase 3A — Preprocessing & Temporal Feature Engineering",
        "description": "Reproducible, leakage-safe preprocessed datasets and window tensors for NASA SMAP/MSL benchmark.",
        "ml_model_trained": False,
        "missions": {
            "MSL": msl_results,
            "SMAP": smap_results,
        },
    }

    manifest_path = output_path / "PROCESSING_MANIFEST.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return manifest

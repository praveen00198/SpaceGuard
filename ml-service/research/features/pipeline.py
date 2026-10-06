"""Coordinated feature pipeline and schema generator."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from .command import CommandInteractionFeatures
from .temporal import DeltaFeatures, EMAFeatures, RollingFeatures


@dataclass
class FeatureSchema:
    """Documented schema of engineered features."""
    mission: str
    feature_count: int
    feature_names: List[str]
    features: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mission": self.mission,
            "feature_count": self.feature_count,
            "feature_names": self.feature_names,
            "features": self.features,
        }

    def save(self, filepath: Path | str) -> None:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)


class FeaturePipeline:
    """Combines base telemetry channels with causal temporal and operational features."""

    def __init__(
        self,
        mission: str = "GENERIC",
        delta_orders: List[int] | None = None,
        rolling_windows: List[int] | None = None,
        rolling_metrics: List[str] | None = None,
        ema_spans: List[int] | None = None,
        ema_divergences: List[Tuple[int, int]] | None = None,
        include_commands: bool = True,
    ) -> None:
        self.mission = mission
        self.delta_extractor = DeltaFeatures(orders=delta_orders)
        self.rolling_extractor = RollingFeatures(windows=rolling_windows, metrics=rolling_metrics)
        self.ema_extractor = EMAFeatures(spans=ema_spans, divergences=ema_divergences)
        self.command_extractor = CommandInteractionFeatures() if include_commands else None
        self.feature_names_: List[str] = []
        self.schema_: Optional[FeatureSchema] = None

    def transform(
        self,
        X_scaled: np.ndarray,
        continuous_channel_idx: int = 0,
        discrete_channel_indices: List[int] | None = None,
    ) -> Tuple[np.ndarray, FeatureSchema]:
        """Extract all features from scaled telemetry matrix.
        
        Args:
            X_scaled: Preprocessed telemetry matrix of shape (N, C)
            continuous_channel_idx: Index of continuous channel (default 0)
            discrete_channel_indices: Indices of discrete auxiliary channels
        """
        n, num_channels = X_scaled.shape
        c_val = X_scaled[:, continuous_channel_idx].astype(np.float32)

        feature_blocks: List[np.ndarray] = []
        feature_meta: List[Dict[str, Any]] = []
        feature_names: List[str] = []

        # 1. Base continuous channel
        feature_blocks.append(c_val[:, np.newaxis])
        c_name = f"channel_{continuous_channel_idx}_scaled"
        feature_names.append(c_name)
        feature_meta.append({
            "name": c_name,
            "type": "base_continuous",
            "source_channel": continuous_channel_idx,
            "transformation": "continuous_scaled",
            "parameters": {},
            "causal": True,
            "dtype": "float32",
        })

        # 2. Delta features
        deltas, delta_names = self.delta_extractor.transform(c_val)
        if deltas.shape[1] > 0:
            feature_blocks.append(deltas)
            for d_name in delta_names:
                feature_names.append(d_name)
                feature_meta.append({
                    "name": d_name,
                    "type": "temporal_delta",
                    "source_channel": continuous_channel_idx,
                    "transformation": "first_difference",
                    "parameters": {"fill_first": 0.0},
                    "causal": True,
                    "dtype": "float32",
                })

        # 3. Rolling features
        rollings, rolling_names = self.rolling_extractor.transform(c_val)
        if rollings.shape[1] > 0:
            feature_blocks.append(rollings)
            for r_name in rolling_names:
                feature_names.append(r_name)
                feature_meta.append({
                    "name": r_name,
                    "type": "rolling_stat",
                    "source_channel": continuous_channel_idx,
                    "transformation": "causal_rolling_window",
                    "parameters": {},
                    "causal": True,
                    "dtype": "float32",
                })

        # 4. EMA features
        emas, ema_names = self.ema_extractor.transform(c_val)
        if emas.shape[1] > 0:
            feature_blocks.append(emas)
            for e_name in ema_names:
                feature_names.append(e_name)
                feature_meta.append({
                    "name": e_name,
                    "type": "ema_divergence" if "divergence" in e_name else "ema",
                    "source_channel": continuous_channel_idx,
                    "transformation": "exponential_moving_average",
                    "parameters": {},
                    "causal": True,
                    "dtype": "float32",
                })

        # 5. Command interaction features
        if discrete_channel_indices is None:
            discrete_channel_indices = [i for i in range(num_channels) if i != continuous_channel_idx]

        discrete_cmds = X_scaled[:, discrete_channel_indices]
        if self.command_extractor and len(discrete_channel_indices) > 0:
            first_delta = deltas[:, 0] if deltas.shape[1] > 0 else None
            cmds, cmd_names = self.command_extractor.transform(
                continuous_val=c_val,
                discrete_commands=discrete_cmds,
                continuous_delta=first_delta,
            )
            if cmds.shape[1] > 0:
                feature_blocks.append(cmds)
                for cmd_name in cmd_names:
                    feature_names.append(cmd_name)
                    feature_meta.append({
                        "name": cmd_name,
                        "type": "command_context",
                        "source_channel": "multiple_discrete",
                        "transformation": "command_conditioned_telemetry",
                        "parameters": {},
                        "causal": True,
                        "dtype": "float32",
                    })

        # 6. Retained discrete auxiliary channels in native form
        if len(discrete_channel_indices) > 0:
            feature_blocks.append(discrete_cmds.astype(np.float32))
            for idx in discrete_channel_indices:
                disc_name = f"aux_discrete_ch_{idx}"
                feature_names.append(disc_name)
                feature_meta.append({
                    "name": disc_name,
                    "type": "native_discrete",
                    "source_channel": idx,
                    "transformation": "native_binary_passthrough",
                    "parameters": {},
                    "causal": True,
                    "dtype": "float32",
                })

        # Combine all blocks
        X_features = np.column_stack(feature_blocks).astype(np.float32)

        schema = FeatureSchema(
            mission=self.mission,
            feature_count=X_features.shape[1],
            feature_names=feature_names,
            features=feature_meta,
        )

        self.feature_names_ = feature_names
        self.schema_ = schema
        return X_features, schema

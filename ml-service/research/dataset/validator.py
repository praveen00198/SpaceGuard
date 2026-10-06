"""Dataset integrity validator for NASA SMAP and MSL benchmarks."""

from dataclasses import dataclass
from typing import Any, Dict, Tuple
import numpy as np

from .loader import DatasetLoader, DatasetSplit


@dataclass
class ValidationReport:
    """Detailed dataset validation report."""
    mission: str
    is_valid: bool
    train_shape: Tuple[int, int]
    test_shape: Tuple[int, int]
    test_label_shape: Tuple[int]
    train_nans: int
    test_nans: int
    train_infs: int
    test_infs: int
    label_length_matches: bool
    label_dtype_is_bool: bool
    expected_channels: int
    actual_channels: int
    details: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mission": self.mission,
            "is_valid": self.is_valid,
            "train_shape": list(self.train_shape),
            "test_shape": list(self.test_shape),
            "test_label_shape": list(self.test_label_shape),
            "train_nans": self.train_nans,
            "test_nans": self.test_nans,
            "train_infs": self.train_infs,
            "test_infs": self.test_infs,
            "label_length_matches": self.label_length_matches,
            "label_dtype_is_bool": self.label_dtype_is_bool,
            "expected_channels": self.expected_channels,
            "actual_channels": self.actual_channels,
            "details": self.details,
        }


class DatasetValidator:
    """Validates raw dataset integrity strictly and fails loudly on discrepancies."""

    EXPECTED_CHANNELS = {
        "MSL": 55,
        "SMAP": 25,
    }

    @classmethod
    def validate_split(cls, split: DatasetSplit) -> Dict[str, Any]:
        """Validate a single dataset split."""
        nan_count = int(np.isnan(split.data).sum())
        inf_count = int(np.isinf(split.data).sum())

        expected_channels = cls.EXPECTED_CHANNELS.get(split.mission)
        if expected_channels is not None and split.num_channels != expected_channels:
            raise ValueError(
                f"Validation Failed: {split.mission} {split.split} has {split.num_channels} "
                f"channels, expected {expected_channels}."
            )

        if nan_count > 0:
            raise ValueError(
                f"Validation Failed: {split.mission} {split.split} contains {nan_count} NaN values."
            )

        if inf_count > 0:
            raise ValueError(
                f"Validation Failed: {split.mission} {split.split} contains {inf_count} infinite values."
            )

        label_match = True
        label_dtype_bool = True
        if split.split == "test":
            if split.labels is None:
                raise ValueError(f"Validation Failed: {split.mission} test set has no labels loaded.")
            if len(split.labels) != split.num_samples:
                raise ValueError(
                    f"Validation Failed: {split.mission} label count ({len(split.labels)}) "
                    f"does not match test sample count ({split.num_samples})."
                )
            if split.labels.dtype != bool and split.labels.dtype != np.bool_:
                raise ValueError(
                    f"Validation Failed: {split.mission} labels dtype is {split.labels.dtype}, expected bool."
                )

        return {
            "num_samples": split.num_samples,
            "num_channels": split.num_channels,
            "nan_count": nan_count,
            "inf_count": inf_count,
        }

    @classmethod
    def validate_mission(cls, loader: DatasetLoader, mission: str) -> ValidationReport:
        """Validate both train and test splits for a mission and generate report."""
        train_split, test_split = loader.load_mission(mission)

        train_metrics = cls.validate_split(train_split)
        test_metrics = cls.validate_split(test_split)

        expected_ch = cls.EXPECTED_CHANNELS[mission]
        label_match = len(test_split.labels) == test_split.num_samples if test_split.labels is not None else False
        label_bool = (test_split.labels.dtype == bool or test_split.labels.dtype == np.bool_) if test_split.labels is not None else False

        report = ValidationReport(
            mission=mission,
            is_valid=True,
            train_shape=train_split.data.shape,
            test_shape=test_split.data.shape,
            test_label_shape=test_split.labels.shape if test_split.labels is not None else (0,),
            train_nans=train_metrics["nan_count"],
            test_nans=test_metrics["nan_count"],
            train_infs=train_metrics["inf_count"],
            test_infs=test_metrics["inf_count"],
            label_length_matches=label_match,
            label_dtype_is_bool=label_bool,
            expected_channels=expected_ch,
            actual_channels=train_split.num_channels,
            details={
                "train_source": train_split.source_file,
                "test_source": test_split.source_file,
            },
        )
        return report

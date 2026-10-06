"""Evidence Packaging Engine for SpaceGuard AI ML Service.

Conforms to SpaceGuard AI Evidence Model (docs/EVIDENCE_MODEL.md).
Ensures every model anomaly detection is accompanied by traceable, grounded evidence tokens.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MLEvidenceToken(BaseModel):
    """Structured evidence record generated alongside ML model inferences."""
    engine: str = Field(description="Name and version of the anomaly detection engine")
    parameter: str = Field(description="Telemetry parameter evaluated")
    value: float = Field(description="Current telemetry value observed")
    baseline: float = Field(description="Nominal baseline value")
    anomaly_score: float = Field(ge=0.0, le=1.0, description="Empirical deviation score (0.0 - 1.0)")
    calibrated_threshold: float = Field(description="Operating decision threshold calibrated on validation data")
    is_anomaly: bool = Field(description="True if anomaly_score >= calibrated_threshold")
    statistical_score: Optional[float] = Field(default=None, description="Z-score or rolling statistical deviation")
    isolation_forest_score: Optional[float] = Field(default=None, description="Isolation Forest tree subspace score")
    sequence_residual: Optional[float] = Field(default=None, description="Predictive/reconstruction error residual")
    contributing_features: List[str] = Field(default_factory=list, description="Key features contributing to detection")
    summary: str = Field(description="Grounded natural-language evidence summary")
    timestamp_utc: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    semantic_disclaimer: str = Field(
        default="Anomaly score denotes empirical behavioral divergence, NOT physical fault probability.",
        description="Core semantic constraint enforced by SpaceGuard AI"
    )

    def to_evidence_dict(self) -> Dict[str, Any]:
        """Convert to canonical SpaceGuard IEvidence payload."""
        return {
            "source": "anomaly",
            "parameter": self.parameter,
            "value": self.value,
            "baseline": self.baseline,
            "anomalyScore": self.anomaly_score,
            "threshold": self.calibrated_threshold,
            "isAnomaly": self.is_anomaly,
            "engine": self.engine,
            "summary": self.summary,
            "contributingFeatures": self.contributing_features,
            "timestamp": self.timestamp_utc,
            "semanticDisclaimer": self.semantic_disclaimer,
        }


class EvidencePackager:
    """Creates grounded evidence tokens from model outputs."""

    @staticmethod
    def package_hybrid_evidence(
        parameter: str,
        value: float,
        baseline: float,
        anomaly_score: float,
        threshold: float,
        is_anomaly: bool,
        engine_name: str = "M4_Hybrid_Temporal_v1.0",
        stat_score: Optional[float] = None,
        if_score: Optional[float] = None,
        residual: Optional[float] = None,
        contributing_features: Optional[List[str]] = None,
    ) -> MLEvidenceToken:
        """Construct a validated MLEvidenceToken for hybrid detections."""
        features = contributing_features or []
        if is_anomaly:
            features_str = f" Driven primarily by {', '.join(features)}." if features else ""
            summary = (
                f"{engine_name} flagged anomalous pattern in {parameter}: "
                f"score {anomaly_score:.3f} exceeded threshold {threshold:.3f} "
                f"(observed {value:.2f}, baseline {baseline:.2f}).{features_str}"
            )
        else:
            summary = (
                f"{engine_name} evaluated {parameter} as nominal: "
                f"score {anomaly_score:.3f} below threshold {threshold:.3f}."
            )

        return MLEvidenceToken(
            engine=engine_name,
            parameter=parameter,
            value=value,
            baseline=baseline,
            anomaly_score=round(anomaly_score, 3),
            calibrated_threshold=round(threshold, 3),
            is_anomaly=is_anomaly,
            statistical_score=round(stat_score, 3) if stat_score is not None else None,
            isolation_forest_score=round(if_score, 3) if if_score is not None else None,
            sequence_residual=round(residual, 3) if residual is not None else None,
            contributing_features=features,
            summary=summary,
        )

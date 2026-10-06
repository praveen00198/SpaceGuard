"""Unit and integration tests for ML Phase 4 operational inference and evidence packaging."""

from fastapi.testclient import TestClient
import numpy as np
import pytest

from app.main import app
from app.hybrid_engine import OperationalHybridEngine
from app.evidence import EvidencePackager, MLEvidenceToken


client = TestClient(app)


def test_evidence_packager():
    """Verify evidence token structure and semantic disclaimer."""
    token = EvidencePackager.package_hybrid_evidence(
        parameter="temperature",
        value=58.4,
        baseline=22.0,
        anomaly_score=0.88,
        threshold=0.45,
        is_anomaly=True,
        stat_score=0.82,
        if_score=0.94,
        residual=3.2,
        contributing_features=["rapid_transient_delta", "rolling_sigma_breach"],
    )

    assert token.is_anomaly is True
    assert token.anomaly_score == 0.88
    assert "rolling_sigma_breach" in token.contributing_features
    assert "NOT physical fault probability" in token.semantic_disclaimer

    d = token.to_evidence_dict()
    assert d["source"] == "anomaly"
    assert d["anomalyScore"] == 0.88
    assert d["threshold"] == 0.45


def test_operational_hybrid_engine_nominal_and_anomalous():
    """Verify operational hybrid engine correctly scores nominal and anomalous telemetry."""
    engine = OperationalHybridEngine(random_seed=42)

    # 1. Nominal series
    for _ in range(35):
        val = 22.0 + np.random.normal(0, 0.5)
        is_anom, score, ev = engine.evaluate(
            satellite_id="SAT-001",
            subsystem="thermal",
            parameter="temperature",
            value=val,
        )

    assert is_anom is False
    assert score < 0.45

    # 2. Large transient spike anomaly
    is_anom, score, ev = engine.evaluate(
        satellite_id="SAT-001",
        subsystem="thermal",
        parameter="temperature",
        value=65.0,  # Exceeds max physical bound (45.0) and 3-sigma
    )

    assert is_anom is True
    assert score >= 0.70
    assert ev.is_anomaly is True
    assert "rapid_transient_delta" in ev.contributing_features or "hard_physical_envelope_limit" in ev.contributing_features


def test_api_predict_with_evidence():
    """Verify /api/predict returns structured evidence package conforming to evidence schema."""
    payload = {
        "satellite_id": "SG-1",
        "subsystem": "thermal",
        "parameter": "temperature",
        "value": 55.0,
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "is_anomaly" in data
    assert "anomaly_score" in data
    assert "details" in data
    assert "evidence" in data
    assert data["evidence"] is not None
    assert data["evidence"]["source"] == "anomaly"
    assert "semanticDisclaimer" in data["evidence"]
    assert "NOT physical fault probability" in data["evidence"]["semanticDisclaimer"]


def test_api_predict_window():
    """Verify /api/predict/window evaluates sequential windows."""
    values = [22.0] * 20 + [58.0, 62.0]  # Normal baseline followed by spike
    payload = {
        "satellite_id": "SG-1",
        "subsystem": "thermal",
        "parameter": "temperature",
        "values": values,
    }
    response = client.post("/api/predict/window", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_anomaly"] is True
    assert len(data["scores"]) == 22
    assert data["peak_anomaly_score"] > 0.50
    assert "evidence" in data

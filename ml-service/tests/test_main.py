"""
SpaceGuard ML Service — Tests

Tests for the existing ML service FastAPI application.
"""

import sys
import os

# Add parent to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Test ML service health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "spaceguard-ml"
    assert data["version"] == "0.1.0"
    assert data["sklearn_available"] is True
    assert data["models_loaded"] is True


def test_list_models():
    """Test model listing endpoint."""
    response = client.get("/models")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert len(data["models"]) > 0
    assert data["models"][0]["name"].startswith("isolation_forest")
    assert data["models"][0]["type"] == "anomaly_detection"


def test_predict_nominal():
    """Test prediction endpoint with nominal telemetry reading."""
    payload = {
        "satellite_id": "SG-1",
        "subsystem": "thermal",
        "parameter": "temperature",
        "value": 22.0,
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "is_anomaly" in data
    assert "anomaly_score" in data
    assert data["model_name"] == "isolation_forest_temperature"
    assert isinstance(data["anomaly_score"], float)
    assert 0.0 <= data["anomaly_score"] <= 1.0


def test_legacy_predict_status():
    """Test legacy predict endpoint with basic payload."""
    response = client.post("/predict", json={"features": []})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"

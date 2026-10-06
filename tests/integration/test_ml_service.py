"""
SpaceGuard AI — ML Service Isolation Forest Tests
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'ml-service'))

from app.main import app, get_or_train_model, PARAM_BASELINES
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "spaceguard-ml"
    assert data["models_loaded"] is True


def test_models_list_endpoint():
    res = client.get("/models")
    assert res.status_code == 200
    data = res.json()
    assert "models" in data
    assert len(data["models"]) >= len(PARAM_BASELINES)


def test_predict_nominal_temperature():
    # Nominal temperature: 22.0 C
    res = client.post("/api/predict", json={
        "satellite_id": "SG-1",
        "subsystem": "thermal",
        "parameter": "temperature",
        "value": 22.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_anomaly"] is False
    assert data["anomaly_score"] < 0.6


def test_predict_extreme_temperature_anomaly():
    # Extreme anomaly: 95.0 C (well outside nominal -10 to 45 C)
    res = client.post("/api/predict", json={
        "satellite_id": "SG-1",
        "subsystem": "thermal",
        "parameter": "temperature",
        "value": 95.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_anomaly"] is True
    assert data["anomaly_score"] > 0.6

"""
SpaceGuard AI — Production ML Service
Multi-Scale Hybrid Anomaly Detection & Evidence Packaging Engine.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
import math
import numpy as np

from app.hybrid_engine import OperationalHybridEngine, PARAM_BASELINES, SKLEARN_AVAILABLE
from app.evidence import MLEvidenceToken

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S'
)
logger = logging.getLogger("spaceguard-ml")

app = FastAPI(
    title="SpaceGuard ML Service",
    description="Multi-Scale Hybrid Anomaly Detection & Evidence Packaging for Spacecraft Telemetry",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate operational multi-scale hybrid engine
hybrid_engine = OperationalHybridEngine()


class PredictRequest(BaseModel):
    satellite_id: str = Field(description="Satellite identifier, e.g. SG-1")
    subsystem: str = Field(description="Subsystem name, e.g. thermal, power")
    parameter: str = Field(description="Telemetry parameter key, e.g. temperature")
    value: float = Field(description="Scalar telemetry reading")
    timestamp: Optional[str] = Field(default=None, description="ISO timestamp of observation")


class PredictResponse(BaseModel):
    is_anomaly: bool
    anomaly_score: float
    model_name: str
    details: str
    evidence: Optional[Dict[str, Any]] = None
    contributing_features: Optional[List[str]] = None


class WindowPredictRequest(BaseModel):
    satellite_id: str
    subsystem: str
    parameter: str
    values: List[float] = Field(description="Sequential window of telemetry readings")
    timestamps: Optional[List[str]] = None


class WindowPredictResponse(BaseModel):
    is_anomaly: bool
    peak_anomaly_score: float
    scores: List[float]
    model_name: str
    evidence: Optional[Dict[str, Any]] = None
    contributing_features: List[str]


@app.get("/health")
async def health_check():
    """Service health check returning operational status and engine architecture."""
    return {
        "status": "ok",
        "service": "spaceguard-ml",
        "version": "0.1.0",
        "sklearn_available": SKLEARN_AVAILABLE,
        "engine": "OperationalHybridEngine_M4",
        "models_loaded": len(hybrid_engine.models) > 0,
        "models_count": len(hybrid_engine.models),
    }


@app.get("/models")
async def list_models():
    """List operational ML models and baseline configurations."""
    return {
        "models": [
            {
                "name": f"isolation_forest_{param}",
                "parameter": param,
                "type": "anomaly_detection",
                "status": "operational",
                "algorithm": "M4_Hybrid_Temporal+IsolationForest",
                "baseline_mean": cfg["mean"],
                "baseline_std": cfg["std"],
                "calibrated_threshold": cfg["threshold"],
            }
            for param, cfg in PARAM_BASELINES.items()
        ]
    }


@app.post("/api/predict", response_model=PredictResponse)
async def api_predict(req: PredictRequest):
    """Run operational multi-scale hybrid anomaly detection on telemetry parameter."""
    is_anom, score, evidence_token = hybrid_engine.evaluate(
        satellite_id=req.satellite_id,
        subsystem=req.subsystem,
        parameter=req.parameter,
        value=req.value,
    )

    return PredictResponse(
        is_anomaly=is_anom,
        anomaly_score=score,
        model_name=f"isolation_forest_{req.parameter}",
        details=evidence_token.summary,
        evidence=evidence_token.to_evidence_dict(),
        contributing_features=evidence_token.contributing_features,
    )


@app.post("/api/predict/window", response_model=WindowPredictResponse)
async def api_predict_window(req: WindowPredictRequest):
    """Run sequential evaluation across a sliding window of readings."""
    scores: List[float] = []
    last_evidence: Optional[MLEvidenceToken] = None
    any_anom = False
    all_features = set()

    for val in req.values:
        is_anom, sc, ev = hybrid_engine.evaluate(
            satellite_id=req.satellite_id,
            subsystem=req.subsystem,
            parameter=req.parameter,
            value=val,
        )
        scores.append(sc)
        if is_anom:
            any_anom = True
        for feat in ev.contributing_features:
            all_features.add(feat)
        last_evidence = ev

    peak_score = max(scores) if scores else 0.0

    return WindowPredictResponse(
        is_anomaly=any_anom,
        peak_anomaly_score=round(peak_score, 3),
        scores=scores,
        model_name=f"hybrid_m4_{req.parameter}",
        evidence=last_evidence.to_evidence_dict() if last_evidence else None,
        contributing_features=sorted(list(all_features)),
    )


@app.post("/predict")
async def legacy_predict(data: dict):
    """Legacy endpoint supporting backwards compatibility with existing clients."""
    if "parameter" in data and "value" in data:
        req = PredictRequest(
            satellite_id=data.get("satellite_id", "SG-1"),
            subsystem=data.get("subsystem", "general"),
            parameter=data["parameter"],
            value=float(data["value"]),
            timestamp=data.get("timestamp"),
        )
        return await api_predict(req)
    return {"status": "ok", "models_loaded": len(hybrid_engine.models)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)

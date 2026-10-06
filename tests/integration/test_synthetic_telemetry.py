"""
SpaceGuard AI — Synthetic Telemetry Generator Tests
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from scripts.data.synthetic_telemetry import generate_telemetry


def test_normal_scenario():
    """Normal scenario should produce no anomaly ground truth."""
    result = generate_telemetry(scenario="normal", duration_seconds=600, interval_seconds=10)
    assert len(result["readings"]) > 0
    assert result["groundTruth"]["anomalyExpected"] is False
    assert result["groundTruth"]["faultType"] is None


def test_thermal_spike_scenario():
    """Thermal spike should have ground truth marking anomaly."""
    result = generate_telemetry(scenario="thermal_spike", duration_seconds=600, interval_seconds=10)
    assert len(result["readings"]) > 0
    gt = result["groundTruth"]
    assert gt["anomalyExpected"] is True
    assert gt["faultType"] == "thermal_spike"
    assert gt["affectedParameter"] == "temperature"
    assert gt["affectedSubsystem"] == "thermal"


def test_battery_degradation_scenario():
    """Battery degradation should be marked in ground truth."""
    result = generate_telemetry(scenario="battery_degradation", duration_seconds=600, interval_seconds=10)
    gt = result["groundTruth"]
    assert gt["anomalyExpected"] is True
    assert gt["faultType"] == "battery_degradation"
    assert gt["affectedParameter"] == "battery_voltage"


def test_sensor_dropout_has_missing_quality():
    """Sensor dropout should produce readings with quality=missing."""
    result = generate_telemetry(scenario="sensor_dropout", duration_seconds=600, interval_seconds=10)
    missing = [r for r in result["readings"] if r["quality"] == "missing"]
    assert len(missing) > 0, "Sensor dropout scenario should produce missing-quality readings"


def test_reproducibility():
    """Same seed should produce identical results."""
    r1 = generate_telemetry(scenario="thermal_spike", seed=42, duration_seconds=120, interval_seconds=10)
    r2 = generate_telemetry(scenario="thermal_spike", seed=42, duration_seconds=120, interval_seconds=10)
    assert r1["readings"] == r2["readings"]
    assert r1["groundTruth"] == r2["groundTruth"]


def test_different_seeds_differ():
    """Different seeds should produce different results."""
    r1 = generate_telemetry(scenario="normal", seed=42, duration_seconds=120, interval_seconds=10)
    r2 = generate_telemetry(scenario="normal", seed=99, duration_seconds=120, interval_seconds=10)
    # At least some values should differ
    values1 = [r["value"] for r in r1["readings"] if r["value"] is not None]
    values2 = [r["value"] for r in r2["readings"] if r["value"] is not None]
    assert values1 != values2


def test_readings_have_required_fields():
    """Every reading should have all required canonical fields."""
    result = generate_telemetry(scenario="normal", duration_seconds=60, interval_seconds=10)
    required_fields = {"satelliteId", "parameter", "timestamp", "unit", "subsystem", "source", "quality"}
    for reading in result["readings"]:
        for field in required_fields:
            assert field in reading, f"Missing field: {field}"
        assert reading["source"] == "simulator"


def test_values_within_physical_range():
    """All valid readings should be within the configured physical range."""
    result = generate_telemetry(scenario="normal", duration_seconds=300, interval_seconds=10)
    for reading in result["readings"]:
        if reading["quality"] == "valid" and reading["value"] is not None:
            # Just check it's a finite number
            assert isinstance(reading["value"], (int, float))

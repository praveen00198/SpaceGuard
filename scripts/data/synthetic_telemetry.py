"""
SpaceGuard AI — Synthetic Telemetry Generator

Generates realistic satellite telemetry data with configurable fault injection.
Each scenario produces ground truth for ML evaluation.

Supported fault types:
- thermal_spike: Sudden temperature increase
- thermal_drift: Gradual temperature rise
- battery_degradation: Declining battery voltage
- voltage_drop: Sudden voltage decrease
- sensor_dropout: Sensor stops reporting
- sensor_drift: Gradual sensor bias
- sensor_flatline: Sensor reports constant value
- comm_latency: Communication latency increase
- oscillation: Periodic value oscillation
- variance_change: Signal variance increases

Usage:
    python synthetic_telemetry.py --scenario thermal_spike --duration 3600 --output data/synthetic/
"""

import json
import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional
import math
import random


# --- Configuration ---

SUBSYSTEM_PARAMS = {
    "power": {
        "battery_voltage": {"baseline": 3.7, "unit": "V", "noise_std": 0.02, "range": (3.0, 4.2)},
        "battery_current": {"baseline": 1.2, "unit": "A", "noise_std": 0.05, "range": (0.0, 5.0)},
        "solar_panel_voltage": {"baseline": 14.5, "unit": "V", "noise_std": 0.3, "range": (0.0, 30.0)},
        "power_consumption": {"baseline": 25.0, "unit": "W", "noise_std": 1.0, "range": (0.0, 100.0)},
    },
    "thermal": {
        "temperature": {"baseline": 22.0, "unit": "C", "noise_std": 0.5, "range": (-40.0, 85.0)},
        "thermal_gradient": {"baseline": 0.0, "unit": "C/min", "noise_std": 0.1, "range": (-2.0, 2.0)},
    },
    "communication": {
        "signal_strength": {"baseline": -75.0, "unit": "dBm", "noise_std": 2.0, "range": (-120.0, -40.0)},
        "packet_loss_rate": {"baseline": 0.5, "unit": "%", "noise_std": 0.3, "range": (0.0, 100.0)},
        "link_latency": {"baseline": 250.0, "unit": "ms", "noise_std": 15.0, "range": (0.0, 2000.0)},
    },
    "attitude": {
        "roll": {"baseline": 0.0, "unit": "deg", "noise_std": 0.1, "range": (-180.0, 180.0)},
        "pitch": {"baseline": 0.0, "unit": "deg", "noise_std": 0.1, "range": (-90.0, 90.0)},
        "yaw": {"baseline": 0.0, "unit": "deg", "noise_std": 0.1, "range": (-180.0, 180.0)},
    },
}


# --- Fault Injection Functions ---

def no_fault(t: float, param: dict) -> float:
    """Normal operation — baseline + noise."""
    return param["baseline"] + random.gauss(0, param["noise_std"])


def thermal_spike(t: float, param: dict, fault_start: float, duration: float) -> float:
    """Sudden temperature increase at fault_start."""
    base = param["baseline"] + random.gauss(0, param["noise_std"])
    if t >= fault_start:
        elapsed = t - fault_start
        spike_magnitude = 35.0  # °C above baseline
        # Sharp rise then slow decay
        if elapsed < 60:
            return base + spike_magnitude * (elapsed / 60)
        else:
            decay = max(0, spike_magnitude * math.exp(-0.005 * (elapsed - 60)))
            return base + decay
    return base


def thermal_drift(t: float, param: dict, fault_start: float, duration: float) -> float:
    """Gradual temperature increase starting at fault_start."""
    base = param["baseline"] + random.gauss(0, param["noise_std"])
    if t >= fault_start:
        elapsed = t - fault_start
        drift_rate = 0.005  # °C per second
        return base + drift_rate * elapsed
    return base


def battery_degradation(t: float, param: dict, fault_start: float, duration: float) -> float:
    """Declining battery voltage."""
    base = param["baseline"] + random.gauss(0, param["noise_std"])
    if t >= fault_start:
        elapsed = t - fault_start
        degradation_rate = 0.0003  # V per second
        return max(param["range"][0], base - degradation_rate * elapsed)
    return base


def voltage_drop(t: float, param: dict, fault_start: float, duration: float) -> float:
    """Sudden voltage decrease."""
    base = param["baseline"] + random.gauss(0, param["noise_std"])
    if t >= fault_start:
        return base - 0.8  # 0.8V drop
    return base


def sensor_dropout(t: float, param: dict, fault_start: float, duration: float) -> Optional[float]:
    """Sensor stops reporting (returns None)."""
    if t >= fault_start and t < fault_start + duration:
        return None
    return param["baseline"] + random.gauss(0, param["noise_std"])


def sensor_flatline(t: float, param: dict, fault_start: float, duration: float) -> float:
    """Sensor reports constant value."""
    if t >= fault_start:
        return param["baseline"]  # Exact baseline, no noise
    return param["baseline"] + random.gauss(0, param["noise_std"])


def oscillation(t: float, param: dict, fault_start: float, duration: float) -> float:
    """Periodic oscillation in readings."""
    base = param["baseline"] + random.gauss(0, param["noise_std"])
    if t >= fault_start:
        elapsed = t - fault_start
        osc = 5.0 * math.sin(2 * math.pi * elapsed / 120)  # 2-minute period
        return base + osc
    return base


def variance_change(t: float, param: dict, fault_start: float, duration: float) -> float:
    """Signal variance increases significantly."""
    if t >= fault_start:
        return param["baseline"] + random.gauss(0, param["noise_std"] * 5)
    return param["baseline"] + random.gauss(0, param["noise_std"])


# --- Fault Registry ---

FAULT_FUNCTIONS = {
    "normal": None,
    "thermal_spike": {"function": thermal_spike, "subsystem": "thermal", "parameter": "temperature"},
    "thermal_drift": {"function": thermal_drift, "subsystem": "thermal", "parameter": "temperature"},
    "battery_degradation": {"function": battery_degradation, "subsystem": "power", "parameter": "battery_voltage"},
    "voltage_drop": {"function": voltage_drop, "subsystem": "power", "parameter": "battery_voltage"},
    "sensor_dropout": {"function": sensor_dropout, "subsystem": "thermal", "parameter": "temperature"},
    "sensor_flatline": {"function": sensor_flatline, "subsystem": "thermal", "parameter": "temperature"},
    "oscillation": {"function": oscillation, "subsystem": "thermal", "parameter": "temperature"},
    "variance_change": {"function": variance_change, "subsystem": "thermal", "parameter": "temperature"},
}


def generate_telemetry(
    scenario: str = "normal",
    satellite_id: str = "SIM-001",
    duration_seconds: int = 3600,
    interval_seconds: int = 10,
    fault_start_fraction: float = 0.3,
    seed: int = 42,
) -> dict:
    """
    Generate synthetic telemetry with optional fault injection.
    
    Returns:
        Dictionary with telemetry readings and ground truth metadata.
    """
    random.seed(seed)
    
    start_time = datetime(2026, 9, 25, 10, 0, 0, tzinfo=timezone.utc)
    num_points = duration_seconds // interval_seconds
    fault_start = duration_seconds * fault_start_fraction
    
    readings = []
    fault_config = FAULT_FUNCTIONS.get(scenario)
    
    for i in range(num_points):
        t = i * interval_seconds
        timestamp = start_time + timedelta(seconds=t)
        
        for subsystem, params in SUBSYSTEM_PARAMS.items():
            for param_name, param_config in params.items():
                # Apply fault if this is the affected parameter
                if (
                    fault_config is not None
                    and subsystem == fault_config["subsystem"]
                    and param_name == fault_config["parameter"]
                ):
                    value = fault_config["function"](
                        t, param_config, fault_start, duration_seconds - fault_start
                    )
                else:
                    value = no_fault(t, param_config)
                
                if value is None:
                    # Sensor dropout — record with quality=missing
                    readings.append({
                        "satelliteId": satellite_id,
                        "parameter": param_name,
                        "timestamp": timestamp.isoformat(),
                        "value": None,
                        "unit": param_config["unit"],
                        "subsystem": subsystem,
                        "source": "simulator",
                        "quality": "missing",
                    })
                else:
                    # Clamp to physical range
                    value = max(param_config["range"][0], min(param_config["range"][1], value))
                    readings.append({
                        "satelliteId": satellite_id,
                        "parameter": param_name,
                        "timestamp": timestamp.isoformat(),
                        "value": round(value, 4),
                        "unit": param_config["unit"],
                        "subsystem": subsystem,
                        "source": "simulator",
                        "quality": "valid",
                    })
    
    # Ground truth
    ground_truth = {
        "scenarioId": f"{scenario.upper()}-{seed}",
        "scenario": scenario,
        "satelliteId": satellite_id,
        "startTime": start_time.isoformat(),
        "endTime": (start_time + timedelta(seconds=duration_seconds)).isoformat(),
        "duration_seconds": duration_seconds,
        "interval_seconds": interval_seconds,
        "total_readings": len(readings),
        "seed": seed,
    }
    
    if fault_config is not None:
        fault_start_time = start_time + timedelta(seconds=fault_start)
        ground_truth.update({
            "faultType": scenario,
            "faultStartTime": fault_start_time.isoformat(),
            "faultEndTime": (start_time + timedelta(seconds=duration_seconds)).isoformat(),
            "affectedParameter": fault_config["parameter"],
            "affectedSubsystem": fault_config["subsystem"],
            "anomalyExpected": True,
        })
    else:
        ground_truth.update({
            "faultType": None,
            "anomalyExpected": False,
        })
    
    return {
        "readings": readings,
        "groundTruth": ground_truth,
    }


def main():
    parser = argparse.ArgumentParser(description="SpaceGuard Synthetic Telemetry Generator")
    parser.add_argument("--scenario", type=str, default="normal",
                        choices=list(FAULT_FUNCTIONS.keys()),
                        help="Fault scenario to simulate")
    parser.add_argument("--satellite-id", type=str, default="SIM-001",
                        help="Satellite ID")
    parser.add_argument("--duration", type=int, default=3600,
                        help="Duration in seconds")
    parser.add_argument("--interval", type=int, default=10,
                        help="Sampling interval in seconds")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducibility")
    parser.add_argument("--output", type=str, default=None,
                        help="Output directory (prints to stdout if not specified)")
    
    args = parser.parse_args()
    
    print(f"Generating {args.scenario} scenario for {args.satellite_id}...", file=sys.stderr)
    
    result = generate_telemetry(
        scenario=args.scenario,
        satellite_id=args.satellite_id,
        duration_seconds=args.duration,
        interval_seconds=args.interval,
        seed=args.seed,
    )
    
    if args.output:
        os.makedirs(args.output, exist_ok=True)
        
        # Save readings
        readings_path = os.path.join(args.output, f"{args.scenario}_readings.json")
        with open(readings_path, 'w') as f:
            json.dump(result["readings"], f, indent=2)
        
        # Save ground truth
        truth_path = os.path.join(args.output, f"{args.scenario}_ground_truth.json")
        with open(truth_path, 'w') as f:
            json.dump(result["groundTruth"], f, indent=2)
        
        print(f"Saved {len(result['readings'])} readings to {readings_path}", file=sys.stderr)
        print(f"Saved ground truth to {truth_path}", file=sys.stderr)
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

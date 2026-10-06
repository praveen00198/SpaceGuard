"""
SpaceGuard AI — Space Weather Data Download Script

Downloads current and historical space weather data from NOAA SWPC.

Source: https://services.swpc.noaa.gov/
License: Public Domain (US Government)
No authentication required.

Usage:
    python download_space_weather.py --output data/raw/space-weather/
"""

import os
import json
import urllib.request
from datetime import datetime, timezone

ENDPOINTS = {
    "kp_index": "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    "kp_forecast": "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
    "kp_1min": "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json",
}


def download_json(url: str, output_path: str) -> int:
    """Download JSON data from URL."""
    print(f"Fetching {url}...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SpaceGuard/0.1.0"})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
        
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        record_count = len(data) if isinstance(data, list) else 1
        print(f"  Saved {record_count} records to {output_path}")
        return record_count
    except Exception as e:
        print(f"  ERROR: {e}")
        return 0


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Download NOAA SWPC space weather data")
    parser.add_argument("--output", type=str, default="data/raw/space-weather/",
                        help="Output directory")
    args = parser.parse_args()
    
    os.makedirs(args.output, exist_ok=True)
    
    total = 0
    for name, url in ENDPOINTS.items():
        output_path = os.path.join(args.output, f"{name}.json")
        count = download_json(url, output_path)
        total += count
    
    # Provenance
    provenance = {
        "datasetId": "NOAA-SWPC",
        "source": "NOAA Space Weather Prediction Center",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "license": "Public Domain (US Government)",
        "attribution": "NOAA/NWS Space Weather Prediction Center",
        "endpoints": list(ENDPOINTS.keys()),
        "preprocessingVersion": "v0",
        "notes": "Snapshot of current data. Re-run to update.",
    }
    
    provenance_path = os.path.join(args.output, "provenance.json")
    with open(provenance_path, 'w') as f:
        json.dump(provenance, f, indent=2)
    
    print(f"\nTotal: {total} records from {len(ENDPOINTS)} endpoints")
    print(f"Provenance: {provenance_path}")


if __name__ == "__main__":
    main()

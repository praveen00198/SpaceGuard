"""
SpaceGuard AI — NASA SMAP/MSL Dataset Download Script

Downloads the NASA Telemanom anomaly detection dataset (SMAP + MSL missions).

Source: https://github.com/khundman/telemanom
License: Public Domain (NASA)

Usage:
    python download_nasa_dataset.py --output data/raw/nasa-smap-msl/
"""

import os
import sys
import json
import hashlib
import urllib.request
from datetime import datetime, timezone

DATA_URL = "https://s3-us-west-2.amazonaws.com/telemanom/data.zip"
LABELS_URL = "https://raw.githubusercontent.com/khundman/telemanom/master/labeled_anomalies.csv"


def download_file(url: str, output_path: str) -> str:
    """Download a file with progress reporting."""
    print(f"Downloading {url}...")
    urllib.request.urlretrieve(url, output_path)
    
    # Compute checksum
    sha256 = hashlib.sha256()
    with open(output_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    
    checksum = sha256.hexdigest()
    print(f"Downloaded: {output_path} (SHA256: {checksum[:16]}...)")
    return checksum


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Download NASA SMAP/MSL dataset")
    parser.add_argument("--output", type=str, default="data/raw/nasa-smap-msl/",
                        help="Output directory")
    args = parser.parse_args()
    
    os.makedirs(args.output, exist_ok=True)
    
    # Download data
    data_path = os.path.join(args.output, "data.zip")
    data_checksum = download_file(DATA_URL, data_path)
    
    # Download labels
    labels_path = os.path.join(args.output, "labeled_anomalies.csv")
    labels_checksum = download_file(LABELS_URL, labels_path)
    
    # Create provenance record
    provenance = {
        "datasetId": "NASA-SMAP-MSL",
        "source": "NASA JPL / Telemanom",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "sourceVersion": "telemanom-v1",
        "license": "Public Domain (NASA)",
        "attribution": "Hundman et al., KDD 2018",
        "files": [
            {"name": "data.zip", "url": DATA_URL, "checksum": f"sha256:{data_checksum}"},
            {"name": "labeled_anomalies.csv", "url": LABELS_URL, "checksum": f"sha256:{labels_checksum}"},
        ],
        "preprocessingVersion": "v0",
        "notes": "Raw download. Extract data.zip for train/ and test/ .npy files.",
    }
    
    provenance_path = os.path.join(args.output, "provenance.json")
    with open(provenance_path, 'w') as f:
        json.dump(provenance, f, indent=2)
    
    print(f"\nProvenance record saved: {provenance_path}")
    print(f"\nNext steps:")
    print(f"  1. Extract: unzip {data_path}")
    print(f"  2. This will create train/ and test/ directories with .npy files")


if __name__ == "__main__":
    main()

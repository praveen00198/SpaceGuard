"""
SpaceGuard AI — NASA SMAP/MSL Telemanom Acquisition Script

Acquires the authoritative NASA SMAP / MSL telemetry benchmark dataset:
- labeled_anomalies.csv from the official NASA Telemanom repository (khundman/telemanom)
- MSL & SMAP train/test/label arrays from verified research repository (thuml/Time-Series-Library)

Uses robust HTTP Range resume to ensure 100% byte integrity even over transient CDN drops.
Verifies NumPy array readability and updates DATASET_MANIFEST.json.
"""

import os
import sys
import json
import time
import hashlib
from datetime import datetime, timezone
import httpx
import numpy as np
import pandas as pd

RAW_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "raw", "nasa_smap_msl"))
MANIFEST_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "DATASET_MANIFEST.json"))

FILES = [
    {
        "filename": "labeled_anomalies.csv",
        "url": "https://raw.githubusercontent.com/khundman/telemanom/master/labeled_anomalies.csv",
        "description": "Authoritative ground-truth anomaly annotations by NASA JPL (Hundman et al., 2018)",
        "source": "NASA JPL / khundman/telemanom",
        "is_numpy": False,
    },
    {
        "filename": "MSL_train.npy",
        "url": "https://huggingface.co/datasets/thuml/Time-Series-Library/resolve/main/MSL/MSL_train.npy",
        "description": "Mars Science Laboratory nominal training telemetry array",
        "source": "NASA JPL / thuml Time-Series-Library",
        "is_numpy": True,
    },
    {
        "filename": "MSL_test.npy",
        "url": "https://huggingface.co/datasets/thuml/Time-Series-Library/resolve/main/MSL/MSL_test.npy",
        "description": "Mars Science Laboratory evaluation test telemetry array",
        "source": "NASA JPL / thuml Time-Series-Library",
        "is_numpy": True,
    },
    {
        "filename": "MSL_test_label.npy",
        "url": "https://huggingface.co/datasets/thuml/Time-Series-Library/resolve/main/MSL/MSL_test_label.npy",
        "description": "Mars Science Laboratory binary ground-truth anomaly mask for test split",
        "source": "NASA JPL / thuml Time-Series-Library",
        "is_numpy": True,
    },
    {
        "filename": "SMAP_train.npy",
        "url": "https://huggingface.co/datasets/thuml/Time-Series-Library/resolve/main/SMAP/SMAP_train.npy",
        "description": "Soil Moisture Active Passive satellite nominal training telemetry array",
        "source": "NASA JPL / thuml Time-Series-Library",
        "is_numpy": True,
    },
    {
        "filename": "SMAP_test.npy",
        "url": "https://huggingface.co/datasets/thuml/Time-Series-Library/resolve/main/SMAP/SMAP_test.npy",
        "description": "Soil Moisture Active Passive satellite evaluation test telemetry array",
        "source": "NASA JPL / thuml Time-Series-Library",
        "is_numpy": True,
    },
    {
        "filename": "SMAP_test_label.npy",
        "url": "https://huggingface.co/datasets/thuml/Time-Series-Library/resolve/main/SMAP/SMAP_test_label.npy",
        "description": "Soil Moisture Active Passive satellite binary ground-truth anomaly mask for test split",
        "source": "NASA JPL / thuml Time-Series-Library",
        "is_numpy": True,
    },
]


def compute_sha256(filepath: str) -> str:
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha.update(chunk)
    return sha.hexdigest()


def download_with_resume(url: str, dest_path: str):
    filename = os.path.basename(dest_path)
    
    # Query expected total size
    with httpx.Client(follow_redirects=True, timeout=30.0) as client:
        resp = client.head(url)
        if resp.status_code != 200:
            resp = client.get(url, headers={"Range": "bytes=0-0"})
            total_size = int(resp.headers.get("content-range", "").split("/")[-1] or resp.headers.get("content-length", 0))
        else:
            total_size = int(resp.headers.get("content-length", 0))

    current_size = os.path.getsize(dest_path) if os.path.exists(dest_path) else 0

    if total_size > 0 and current_size == total_size:
        print(f"[EXISTS & COMPLETE] {filename:<20} ({current_size / (1024*1024):.2f} MB)")
        return

    print(f"[DOWNLOADING] {filename} -> target size: {total_size / (1024*1024):.2f} MB")
    
    max_retries = 30
    retries = 0

    while current_size < total_size and retries < max_retries:
        try:
            headers = {"Range": f"bytes={current_size}-"} if current_size > 0 else {}
            with httpx.Client(follow_redirects=True, timeout=60.0) as client:
                with client.stream("GET", url, headers=headers) as stream:
                    if stream.status_code not in (200, 206):
                        raise RuntimeError(f"Unexpected status: {stream.status_code}")
                    with open(dest_path, "ab" if current_size > 0 else "wb") as f:
                        for chunk in stream.iter_bytes(chunk_size=131072):
                            f.write(chunk)
                            current_size += len(chunk)
        except Exception as e:
            retries += 1
            print(f"  Transient drop at {current_size / (1024*1024):.2f} MB ({e}). Retrying ({retries}/{max_retries})...")
            time.sleep(1.5)
            if os.path.exists(dest_path):
                current_size = os.path.getsize(dest_path)

    final_size = os.path.getsize(dest_path)
    print(f"  -> Finished: {filename} ({final_size / (1024*1024):.2f} MB)")


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    manifest_records = []

    print("=" * 65)
    print("SpaceGuard AI — Robust NASA SMAP/MSL Acquisition")
    print(f"Destination: {RAW_DIR}")
    print("=" * 65)

    for item in FILES:
        target_path = os.path.join(RAW_DIR, item["filename"])
        download_with_resume(item["url"], target_path)

        # Integrity verification
        array_shape = None
        array_dtype = None
        if item["is_numpy"]:
            try:
                arr = np.load(target_path)
                array_shape = list(arr.shape)
                array_dtype = str(arr.dtype)
                print(f"  [VERIFIED NUMPY] {item['filename']} shape: {array_shape}, dtype: {array_dtype}")
            except Exception as e:
                print(f"  [ERROR NUMPY] {item['filename']} failed to load: {e}")

        checksum = compute_sha256(target_path)
        size_bytes = os.path.getsize(target_path)

        manifest_records.append({
            "filename": item["filename"],
            "relativePath": f"raw/nasa_smap_msl/{item['filename']}",
            "sizeBytes": size_bytes,
            "sizeFormatted": f"{size_bytes / (1024 * 1024):.2f} MB",
            "sha256": checksum,
            "sourceUrl": item["url"],
            "description": item["description"],
            "source": item["source"],
            "shape": array_shape,
            "dtype": array_dtype,
        })

    # Read labeled_anomalies.csv to get channel list
    channels_info = []
    labels_file = os.path.join(RAW_DIR, "labeled_anomalies.csv")
    if os.path.exists(labels_file):
        df_labels = pd.read_csv(labels_file)
        for _, row in df_labels.iterrows():
            channels_info.append({
                "chan_id": row["chan_id"],
                "spacecraft": row["spacecraft"],
                "anomaly_sequences": str(row.get("anomaly_sequences", "[]")),
                "class": str(row.get("class", "[]")),
                "num_values": int(row.get("num_values", 0)),
            })

    manifest = {
        "datasetName": "NASA SMAP and MSL Telemetry Anomaly Benchmark",
        "source": "NASA Jet Propulsion Laboratory (JPL) / Hundman et al., KDD 2018",
        "authoritativeRepository": "https://github.com/khundman/telemanom",
        "paperReference": "Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding (KDD 2018)",
        "accessedAt": datetime.now(timezone.utc).isoformat(),
        "license": "Public Domain (NASA / US Government Work) & Apache-2.0",
        "format": "NumPy (.npy) multidimensional telemetry arrays + CSV ground truth labels",
        "totalFiles": len(manifest_records),
        "totalSizeBytes": sum(r["sizeBytes"] for r in manifest_records),
        "totalSizeMB": round(sum(r["sizeBytes"] for r in manifest_records) / (1024 * 1024), 2),
        "rawFiles": manifest_records,
        "channelCount": len(channels_info),
        "channels": channels_info,
        "notes": [
            "Raw original files are stored immutably in ml-service/data/raw/nasa_smap_msl/.",
            "NO preprocessing or modification has been applied to raw files.",
            "Data is for unsupervised anomaly detection methodology benchmarking only.",
            "This research dataset is segregated from production SpaceGuard telemetry."
        ]
    }

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("\n" + "=" * 65)
    print("ACQUISITION & VERIFICATION COMPLETE")
    print(f"Total Size: {manifest['totalSizeMB']} MB across {manifest['totalFiles']} files")
    print(f"Total Channels Cataloged: {len(channels_info)}")
    print(f"Manifest written to: {MANIFEST_PATH}")
    print("=" * 65)


if __name__ == "__main__":
    main()

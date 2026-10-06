# Data Directory

This directory contains datasets, metadata, and processing artifacts for SpaceGuard AI.

## Structure

```
data/
├── raw/          → Raw downloaded datasets (gitignored if large)
├── interim/      → Intermediate processing results
├── processed/    → Normalized, ready-to-use datasets
├── synthetic/    → Generated synthetic telemetry
├── metadata/     → Dataset provenance records
└── README.md     → This file
```

## Important

- Large raw datasets are NOT committed to Git (see `.gitignore`)
- Use scripts in `scripts/data/` to download datasets
- Every dataset must have a provenance record in `metadata/`
- Processed data can be regenerated from raw data using pipeline scripts

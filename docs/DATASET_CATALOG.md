# SpaceGuard AI — Dataset Catalog

This document catalogues every data source researched, evaluated, and integrated into SpaceGuard.

---

## 1. NASA SMAP/MSL Telemetry Anomaly Dataset

| Field | Value |
|-------|-------|
| **Name** | NASA SMAP/MSL Anomaly Detection Dataset |
| **Provider** | NASA Jet Propulsion Laboratory (JPL) |
| **Mission** | SMAP (Soil Moisture Active Passive) + MSL (Mars Science Laboratory / Curiosity) |
| **URL** | https://github.com/khundman/telemanom |
| **Secondary URL** | https://www.kaggle.com/datasets/patrickfleith/nasa-anomaly-detection-dataset-smap-msl |
| **Download** | `wget https://s3-us-west-2.amazonaws.com/telemanom/data.zip` |
| **Labels** | `wget https://raw.githubusercontent.com/khundman/telemanom/master/labeled_anomalies.csv` |
| **Data type** | Multivariate time-series spacecraft telemetry |
| **Telemetry channels** | SMAP: 55 channels, MSL: 27 channels (82 total) |
| **Sampling** | Regular time-series; each channel is a separate file |
| **Time period** | Historical (specific dates not published — mission operational periods) |
| **Anomaly labels** | Expert-labeled anomalies; point anomalies and contextual anomalies |
| **Anomaly ratio** | SMAP: 13.13%, MSL: 10.72% |
| **Train/test split** | Separate train and test files per channel |
| **Format** | NumPy `.npy` files |
| **Size** | ~70 MB compressed |
| **License** | Public domain (NASA) — freely available for research and commercial use |
| **Attribution** | Hundman et al., "Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding," KDD 2018 |
| **Real-time availability** | No — historical dataset only |
| **Historical availability** | Yes |
| **Known limitations** | - Channels are individual univariate/low-dimensional series, not full spacecraft state vectors |
| | - Labels are binary (anomaly/not); no fault-type classification |
| | - No subsystem labels or parameter names (channels are anonymized like `P-1`, `T-1`) |
| | - No unit information |
| | - No temporal metadata (absolute timestamps) |
| | - Standard benchmark — widely used but not representative of all spacecraft types |
| **Supervised learning** | Partially — labels exist for test set but are binary only |
| **Preprocessing required** | Yes — load `.npy`, create sliding windows, normalize |
| **Intended use in SpaceGuard** | Primary ML benchmark dataset for Isolation Forest evaluation; baseline anomaly detection validation |
| **Status** | **SELECTED** |

---

## 2. ESA OPS-SAT Anomaly Detection Dataset (OPSSAT-AD)

| Field | Value |
|-------|-------|
| **Name** | OPSSAT-AD Dataset |
| **Provider** | KP Labs / ESA |
| **Mission** | OPS-SAT (ESA CubeSat — 3U, launched Dec 2019, re-entered May 2024) |
| **URL** | https://zenodo.org/records/12528696 |
| **Secondary URL** | https://github.com/kplabs-pl/OPS-SAT-AD |
| **Kaggle** | https://www.kaggle.com/datasets (search "Satellite Telemetry and Anomaly Detection") |
| **Data type** | Real satellite bus telemetry with anomaly annotations |
| **Telemetry channels** | Magnetometers, photo diodes, and other bus telemetry channels |
| **Sampling** | Segmented telemetry fragments |
| **Time period** | Historical (mission period: 2019–2024) |
| **Anomaly labels** | Ground-truth annotations per segment |
| **Format** | CSV (`segments.csv`, `dataset.csv`) |
| **Size** | Moderate (segment-level, not continuous raw telemetry) |
| **License** | MIT License |
| **Attribution** | KP Labs, ESA OPS-SAT team |
| **Real-time availability** | No — mission ended May 2024 (re-entry) |
| **Historical availability** | Yes |
| **Known limitations** | - CubeSat telemetry (3U form factor) — not representative of larger satellites |
| | - Segmented format — not continuous time-series |
| | - Limited number of telemetry parameters |
| | - Mission is no longer active |
| **Preprocessing required** | Yes — segment extraction, feature computation |
| **Intended use in SpaceGuard** | Secondary validation dataset; real-world telemetry benchmark |
| **Status** | **SELECTED** |

---

## 3. SatNOGS Database & Network

| Field | Value |
|-------|-------|
| **Name** | SatNOGS Database / Network |
| **Provider** | Libre Space Foundation |
| **URL (DB)** | https://db.satnogs.org/ |
| **URL (Network)** | https://network.satnogs.org/ |
| **API (DB)** | https://db.satnogs.org/api/ |
| **API (Network)** | https://network.satnogs.org/api/ |
| **Grafana** | https://grafana.satnogs.org/ |
| **Data type** | Crowd-sourced satellite observation data and decoded telemetry |
| **Satellites** | Thousands of cataloged satellites with transmitter information |
| **Telemetry** | Decoded telemetry frames (only for satellites with functional decoders) |
| **Sampling** | Observation-dependent — varies by satellite visibility and ground station coverage |
| **Time period** | Ongoing (active project) |
| **Anomaly labels** | None — raw telemetry only |
| **Format** | JSON (REST API) |
| **License** | CC-BY-SA 4.0 |
| **Attribution** | Libre Space Foundation, SatNOGS contributors |
| **Authentication** | API token required for telemetry endpoint; GET requests mostly public |
| **Rate limits** | 60 req/hr anonymous, 240 req/hr authenticated |
| **Real-time availability** | Near-real-time (observation-dependent, opportunistic) |
| **Historical availability** | Yes (observations database) |
| **Known limitations** | - Telemetry availability depends on decoder existence for each satellite |
| | - Coverage is opportunistic — depends on ground station location and scheduling |
| | - Not continuous monitoring — gaps between observations |
| | - Data quality varies by ground station equipment |
| | - Rate-limited API |
| | - Decoded data schema varies by satellite |
| **Preprocessing required** | Yes — decoder-specific parsing, normalization to canonical schema |
| **Intended use in SpaceGuard** | Opportunistic near-real-time telemetry source for supported satellites; satellite metadata |
| **Important terminology** | This is "observation-derived telemetry" or "public telemetry" — NOT continuous real-time spacecraft telemetry |
| **Status** | **SELECTED** (metadata + telemetry where decoders exist) |

---

## 4. CelesTrak Orbital Data

| Field | Value |
|-------|-------|
| **Name** | CelesTrak GP/OMM Data |
| **Provider** | CelesTrak (Dr. T.S. Kelso) / Data from USSPACECOM |
| **URL** | https://celestrak.org/ |
| **API** | `https://celestrak.org/NORAD/elements/gp.php?{QUERY}=VALUE&FORMAT=VALUE` |
| **Data type** | General Perturbations (GP) orbital data |
| **Formats** | TLE, 3LE, OMM (XML, KVN, JSON, CSV) |
| **Query types** | CATNR (catalog number), INTLDES (international designator), NAME, GROUP |
| **Satellites** | 100,000+ tracked objects (as of July 2026, SATCAT exceeds 100k) |
| **Update frequency** | Varies — typically updated multiple times daily |
| **Time period** | Current + historical (archival TLEs available) |
| **License** | Public data with usage restrictions (no excessive polling) |
| **Authentication** | None required |
| **Rate limits** | Informal — "reasonable" polling only (1-2x daily recommended) |
| **Known limitations** | - TLE format limited to 5-digit catalog numbers (use OMM for 6-digit) |
| | - GP data requires propagation (SGP4) for precise position |
| | - Accuracy degrades over time from epoch |
| | - Not health/telemetry data — orbital context only |
| **Preprocessing required** | Minimal — JSON/CSV directly parseable |
| **Intended use in SpaceGuard** | Orbital Context Layer — satellite position, orbit type, epoch freshness |
| **Status** | **SELECTED** |

---

## 5. NOAA Space Weather Prediction Center (SWPC)

| Field | Value |
|-------|-------|
| **Name** | NOAA SWPC Data Services |
| **Provider** | NOAA / National Weather Service |
| **URL** | https://www.swpc.noaa.gov/products-and-data |
| **API Base** | https://services.swpc.noaa.gov/ |
| **Data type** | Space weather — solar activity, solar wind, geomagnetic indices |
| **Key endpoints** | |
| | `/products/noaa-planetary-k-index.json` — Kp index |
| | `/products/noaa-planetary-k-index-forecast.json` — Kp forecast |
| | `/json/planetary_k_index_1m.json` — 1-minute Kp |
| | `/products/solar-wind/` — solar wind parameters |
| | `/products/alerts.json` — active alerts |
| **Sensors** | DSCOVR, ACE spacecraft at L1 Lagrange point |
| **Update frequency** | 1-minute to 3-hour depending on product |
| **Time period** | Current + historical archives |
| **Format** | JSON |
| **License** | Public domain (US Government) |
| **Authentication** | None required |
| **Rate limits** | None stated — reasonable polling requested (every 15+ minutes) |
| **Known limitations** | - Data comes from L1 spacecraft — ~30-60 min lead time before Earth impact |
| | - Some products have gaps during spacecraft maneuvers |
| | - Geomagnetic indices are estimates with known uncertainties |
| **Preprocessing required** | Minimal — JSON directly parseable |
| **Intended use in SpaceGuard** | Environmental Context Layer — geomagnetic activity, solar wind, radiation environment |
| **Status** | **SELECTED** |

---

## 6. NASA DONKI (Space Weather Database of Notifications, Knowledge, Information)

| Field | Value |
|-------|-------|
| **Name** | NASA DONKI API |
| **Provider** | NASA CCMC (Community Coordinated Modeling Center) |
| **URL** | https://kauai.ccmc.gsfc.nasa.gov/DONKI/ |
| **API Base** | https://api.nasa.gov/DONKI/ |
| **Data type** | Space weather events |
| **Event types** | CME, Solar Flare (FLR), Geomagnetic Storm (GST), Solar Energetic Particle (SEP), Interplanetary Shock (IPS), Magnetopause Crossing (MPC), Radiation Belt Enhancement (RBE), High-Speed Stream (HSS) |
| **Update frequency** | Event-driven |
| **Time period** | Historical (extensive archive) + current |
| **Format** | JSON |
| **License** | Public domain (NASA) |
| **Authentication** | API key (free from api.nasa.gov); `DEMO_KEY` available with lower rate limits |
| **Rate limits** | DEMO_KEY: 30 req/hr, 50 req/day. Personal key: 1,000 req/hr |
| **Known limitations** | - Event classification is retrospective (some events re-classified) |
| | - Not all events have Earth-directed analysis |
| | - DONKI is research-grade, not operational forecasting (use NOAA SWPC for that) |
| **Preprocessing required** | Minimal — JSON with timestamps and event metadata |
| **Intended use in SpaceGuard** | Environmental Context Layer — correlating space weather events with satellite anomalies |
| **Status** | **SELECTED** |

---

## 7. NASA PDS (Planetary Data System)

| Field | Value |
|-------|-------|
| **Name** | NASA Planetary Data System |
| **Provider** | NASA |
| **URL** | https://pds.nasa.gov/ |
| **Data type** | Mission science and engineering data |
| **Known limitations** | - Primarily science data, not operations telemetry |
| | - Complex data formats (PDS3, PDS4) |
| | - Large datasets requiring specialized tools |
| | - Not designed for real-time monitoring |
| **Intended use in SpaceGuard** | Potential future source for specific mission engineering data |
| **Status** | **EVALUATED — OPTIONAL** (not required for MVP; complex format overhead not justified) |

---

## Summary Table

| Dataset | Type | Status | MVP Use |
|---------|------|--------|---------|
| NASA SMAP/MSL | Historical telemetry + anomaly labels | SELECTED | ML benchmark |
| OPS-SAT AD | Historical telemetry + anomaly labels | SELECTED | Validation |
| SatNOGS | Near-real-time telemetry + metadata | SELECTED | Live data source |
| CelesTrak | Orbital data | SELECTED | Orbital context |
| NOAA SWPC | Space weather (current + historical) | SELECTED | Environmental context |
| NASA DONKI | Space weather events | SELECTED | Event correlation |
| NASA PDS | Mission data | OPTIONAL | Future research |

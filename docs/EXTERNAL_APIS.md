# SpaceGuard AI — External APIs

## NOAA Space Weather Prediction Center (SWPC)

| Field | Value |
|-------|-------|
| **Provider** | NOAA / National Weather Service |
| **Base URL** | `https://services.swpc.noaa.gov/` |
| **Authentication** | None required |
| **Rate Limits** | Not enforced but reasonable polling requested (≥15 min intervals) |
| **Response Format** | JSON |
| **Attribution** | Required — NOAA data is public domain but attribution is requested |
| **Failure Handling** | Return "Environmental context unavailable"; cache last-known values |

### Key Endpoints

| Endpoint | Update Freq | Description |
|----------|-------------|-------------|
| `/products/noaa-planetary-k-index.json` | 3 hours | Planetary Kp index |
| `/products/noaa-planetary-k-index-forecast.json` | 3 hours | Kp forecast |
| `/json/planetary_k_index_1m.json` | 1 minute | High-resolution Kp |
| `/products/solar-wind/` | 1 minute | Solar wind parameters |
| `/products/alerts.json` | Event-driven | Active space weather alerts |

### Caching Strategy
- Poll every 15 minutes for Kp index
- Poll every 5 minutes for solar wind (during active monitoring)
- Cache all responses with TTL
- Serve cached data if source unavailable

---

## NASA DONKI

| Field | Value |
|-------|-------|
| **Provider** | NASA CCMC |
| **Base URL** | `https://api.nasa.gov/DONKI/` |
| **Authentication** | API key (free from api.nasa.gov) |
| **Rate Limits** | DEMO_KEY: 30/hr, 50/day. Personal key: 1,000/hr |
| **Response Format** | JSON |
| **Attribution** | NASA public domain data |
| **Failure Handling** | Return "Event data unavailable"; use cached events |

### Key Endpoints

| Endpoint | Parameters | Description |
|----------|-----------|-------------|
| `/CME` | startDate, endDate | Coronal Mass Ejections |
| `/FLR` | startDate, endDate | Solar Flares |
| `/GST` | startDate, endDate | Geomagnetic Storms |
| `/SEP` | startDate, endDate | Solar Energetic Particles |
| `/IPS` | startDate, endDate | Interplanetary Shocks |
| `/HSS` | startDate, endDate | High Speed Streams |

### Caching Strategy
- Poll every 30 minutes for recent events
- Batch-fetch historical events on initial setup
- Cache events by type and date range

---

## CelesTrak

| Field | Value |
|-------|-------|
| **Provider** | CelesTrak / USSPACECOM |
| **Base URL** | `https://celestrak.org/` |
| **Authentication** | None required |
| **Rate Limits** | Informal — 1-2 refreshes per day recommended |
| **Response Format** | TLE, JSON, XML, KVN, CSV |
| **Attribution** | CelesTrak, USSPACECOM |
| **Failure Handling** | Use last-known orbital elements; note staleness |

### Key Endpoint

```
https://celestrak.org/NORAD/elements/gp.php?CATNR={noradId}&FORMAT=JSON
```

### Important Notes
- Use OMM (JSON) format — TLE limited to 5-digit catalog numbers
- Orbital elements require SGP4 propagation for position calculation
- Data accuracy degrades over time from epoch

### Caching Strategy
- Refresh orbital data once daily
- Cache locally per satellite
- Flag stale data (epoch > 7 days old)

---

## SatNOGS DB API

| Field | Value |
|-------|-------|
| **Provider** | Libre Space Foundation |
| **Base URL** | `https://db.satnogs.org/api/` |
| **Authentication** | API token required for telemetry endpoint |
| **Rate Limits** | 60 req/hr anonymous, 240 req/hr authenticated |
| **Response Format** | JSON |
| **License** | CC-BY-SA 4.0 |
| **Attribution** | Required — Libre Space Foundation, SatNOGS contributors |
| **Failure Handling** | Return "SatNOGS data unavailable"; use cached data |

### Key Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `/satellites/` | Public | Satellite metadata |
| `/transmitters/` | Public | Transmitter information |
| `/telemetry/` | Token | Decoded telemetry frames |

### Important Notes
- Telemetry availability depends on decoder existence per satellite
- Not all observations produce decoded telemetry
- Data is crowd-sourced — quality varies

---

## Gemini API

| Field | Value |
|-------|-------|
| **Provider** | Google |
| **Authentication** | API key (from AI Studio) |
| **Rate Limits** | Varies by tier |
| **Response Format** | JSON (structured output) |
| **Failure Handling** | "AI assessment temporarily unavailable"; system continues without AI |

### Security
- API key stored server-side only
- Never exposed to frontend
- Key rotated according to security policy

### Usage
- Called only from backend assessment service
- Receives structured evidence packages
- Returns schema-constrained structured output

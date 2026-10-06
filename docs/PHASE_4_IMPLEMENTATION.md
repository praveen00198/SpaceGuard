# SpaceGuard AI — Phase 4 Implementation Report
# External Space Data Integration, Normalization, Provenance & Context Correlation

> **Phase**: 4 — External Space Data Integration & Context Correlation  
> **Status**: COMPLETE & VERIFIED  
> **Test Baseline**: 32/32 Jest tests passing (100%), 12/12 Pytest tests passing (100%), 6/6 Realtime tests passing (100%), Frontend TypeScript build passing (0 errors).

---

## 1. Executive Summary

Phase 4 introduces external space environmental, orbital, and ground-station context into SpaceGuard AI in an evidence-grounded, traceable, and strictly non-causal manner. 

Prior to Phase 4, the platform operated purely on internal telemetry and simulator streams. Phase 4 establishes adapters for:
1. **NOAA SWPC** (Planetary K-index, geomagnetic storm severity scales G0–G5).
2. **NASA DONKI** (Solar flares [FLR], coronal mass ejections [CME], notifications).
3. **CelesTrak** (General Perturbations [GP] ephemeris, orbital regime calculation, South Atlantic Anomaly [SAA] radiation corridor evaluation).
4. **SatNOGS DB** (Ground station spacecraft metadata and telemetry frames).

These external sources feed the **Context Correlation Engine**, which discovers temporal and environmental overlaps with internal telemetry anomalies. Valid correlations generate formal evidence items (`EVID-ENV-...`, `EVID-ORB-...`) and attach them to the anomaly's evidence package. When Google Gemini (or the deterministic grounded fallback engine) performs flight-controller diagnostics, it reasons strictly over this evidence package.

---

## 2. Architectural Boundaries & Non-Causality Guarantee

### Principle 1: Evidence Over Invention
External environmental events do **NOT** silently become spacecraft telemetry, anomaly truth, fault truth, or causal truth. Gemini receives a structured evidence package and is programmatically constrained from inventing evidence IDs or speculating causality without evidence.

### Principle 2: Strict Non-Causality Guarantee
In every correlation evaluation:
```typescript
export interface CorrelationItem {
  relationship: 'temporal_overlap' | 'environmental_overlap' | 'subsystem_coupling' | 'historical_similarity';
  contextSource: string;
  sourceEvent: string;
  contextEvent: string;
  confidence: number;
  causalEvidence: false; // Never true — correlation ≠ causation
  note: string;
  evidenceId?: string;
}
```
`causalEvidence` is explicitly typed as literal `false`. Every generated claim or evidence record carries an explicit disclaimer:  
*"Temporal/environmental correlation reported; temporal proximity does not establish causation."*

### Principle 3: Graceful Degradation & Provenance
If any external API (NASA, NOAA, SatNOGS, CelesTrak) experiences rate-limiting, latency, or outages:
- Calls time out cleanly via `AbortController` (3.0s–4.0s).
- The system falls back to MongoDB persistent caches or local snapshot files.
- The UI displays honest `"cached"` or `"unavailable"` status indicators.
- In automated test suites (`NODE_ENV=test`), live remote HTTP roundtrips are automatically bypassed to avoid flaky timeouts.

---

## 3. Implemented Components

```
                       INTERNAL TELEMETRY PIPELINE
                                    │
                                    ▼
                         Hybrid Anomaly Engine
                         (Rule, Stat, ML Forest)
                                    │
                                    ▼
                             Detected Anomaly
                                    │
                                    ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │                      CONTEXT CORRELATION ENGINE                       │
 │                                                                       │
 │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌────────┐ │
 │   │   NOAA SWPC   │  │  NASA DONKI   │  │ CelesTrak SAA │  │Coupled │ │
 │   │ (Kp ≥ 5 Storm)│  │ (Solar Flares)│  │  (Radiation)  │  │Systems │ │
 │   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───┬────┘ │
 │           │                  │                  │              │      │
 │           ▼                  ▼                  ▼              │      │
 │      Temporal            Temporal         Environmental    Subsystem  │
 │       Overlap             Overlap            Overlap        Coupling  │
 │           │                  │                  │              │      │
 │           └──────────────────┼──────────────────┘              │      │
 │                              ▼                                 │      │
 │                     Generate Evidence                          │      │
 │                 (EVID-ENV-*, EVID-ORB-*)                       │      │
 │                  causalEvidence: false                         │      │
 └──────────────────────────────┬─────────────────────────────────┴──────┘
                                │
                                ▼
                       Updated Anomaly Record
                     (anomaly.evidenceIds: [...])
                                │
                                ▼
                     Gemini Diagnostics Engine
                 (Reasons strictly over evidence)
                                │
                                ▼
                   Human Flight Controller UI
              (Modal with Correlated Space Context)
```

### 3.1 External Adapters

1. **NASA DONKI Adapter** ([`backend/src/modules/space-weather/donkiService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/space-weather/donkiService.ts)):
   - `fetchEvents(filter)`: Queries NASA DONKI notifications with API key / `DEMO_KEY`.
   - `getEventsInWindow(start, end)`: Pulls events active during anomaly temporal windows ($\pm 60$ minutes).
   - Normalizes raw notifications into canonical `IEnvironmentalEvent` records.
   - Bulk persists to MongoDB via `MongoEnvironmentalEventRepository`.

2. **CelesTrak Orbital Adapter** ([`backend/src/modules/orbital/orbitalService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/orbital/orbitalService.ts)):
   - `getOrbitalContext(satelliteId, noradId)`: Fetches GP ephemeris elements.
   - Calculates orbital regime (`LEO`, `MEO`, `GEO`, `HEO`), altitude, inclination, and orbital period.
   - Evaluates whether the spacecraft ground track intersects the South Atlantic Anomaly (SAA) high-radiation corridor (lat: $-50^\circ$ to $0^\circ$, lon: $-90^\circ$ to $0^\circ$).

3. **SatNOGS Ground Station Adapter** ([`backend/src/modules/satellites/satnogsService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/satellites/satnogsService.ts)):
   - `getSatelliteMetadata(noradId)`: Authenticates with SatNOGS token.
   - Retrieves spacecraft operational status (alive, decayed, active transmitters count).

4. **NOAA SWPC Space Weather Service** ([`backend/src/modules/space-weather/spaceWeatherService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/space-weather/spaceWeatherService.ts)):
   - Updated to support both live SWPC planetary K-index parsing, snapshot file fallback, and test-environment caching.

### 3.2 Persistence Layer
- **Mongoose Model**: [`backend/src/models/EnvironmentalEvent.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/models/EnvironmentalEvent.ts) with compound index `{ timestamp: 1, eventType: 1 }` and unique `{ eventId: 1 }`.
- **Repository Interface**: [`backend/src/repositories/interfaces/IEnvironmentalEventRepository.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/repositories/interfaces/IEnvironmentalEventRepository.ts).
- **Implementations**:
  - `MongoEnvironmentalEventRepository`: MongoDB persistence.
  - `InMemoryEnvironmentalEventRepository`: In-memory isolated storage for testing.
- **Factory Registration**: Exported in [`backend/src/repositories/index.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/repositories/index.ts).

### 3.3 Correlation Engine
- File: [`backend/src/modules/correlation/correlationEngine.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/correlation/correlationEngine.ts)
- Correlation Rules:
  1. **Geomagnetic Storm Overlap**: Kp $\ge 5.0$ $\rightarrow$ temporal overlap correlation + `EVID-ENV-...` evidence.
  2. **Solar Flare / CME Overlap**: DONKI event within $\pm 60$ minutes $\rightarrow$ temporal overlap + `EVID-ENV-...` evidence.
  3. **SAA Radiation Belt Corridor**: Spacecraft inside SAA $\rightarrow$ environmental overlap + `EVID-ORB-...` evidence.
  4. **Physical Subsystem Coupling**: Active anomalies on coupled pairs (Power $\leftrightarrow$ Thermal, Attitude $\leftrightarrow$ Communication) $\rightarrow$ subsystem coupling correlation.
- Evidence IDs are attached directly to `anomaly.evidenceIds` and persisted.

### 3.4 REST API Surface
- `GET /api/correlation/anomaly/:anomalyId`: Returns `CorrelationReport` with linked evidence IDs and non-causal notes.
- `GET /api/orbital/context/:satelliteId`: Returns live orbital ephemeris and SAA status.
- `GET /api/space-weather/events`: Returns recent normalized environmental events.
- `GET /api/satellites/:id/satnogs`: Returns SatNOGS ground station metadata.

### 3.5 Frontend UI Integration
- File: [`frontend/src/components/InvestigationModal.tsx`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/frontend/src/components/InvestigationModal.tsx)
- Fetches `CorrelationReport` alongside AI diagnostics.
- Renders dedicated "Correlated Space Context & Environmental Evidence" card with:
  - Relationship pill (Temporal Overlap, Environmental Overlap, Subsystem Coupling).
  - Source attribution badge (NOAA SWPC, NASA DONKI, CelesTrak GP).
  - Explicit non-causality banner (*Non-Causal Context: Temporal / Environmental Overlap Only*).
  - Confidence percentage and attached Evidence ID.

---

## 4. Verification & Test Evidence

### 4.1 Backend Jest Suites
Ran `npm test` in `backend/`:
```
PASS src/modules/correlation/correlationEngine.test.ts (4 tests)
PASS src/repositories/restartPersistence.test.ts (2 tests)
PASS src/modules/assessments/geminiService.test.ts (1 test)
PASS src/modules/anomalies/ruleEngine.test.ts (8 tests)
PASS src/modules/anomalies/statisticalEngine.test.ts (8 tests)
PASS src/modules/health/healthService.test.ts (3 tests)
PASS src/modules/satellites/satelliteService.test.ts (3 tests)
PASS src/repositories/repositories.test.ts (3 tests)

Test Suites: 8 passed, 8 total
Tests:       32 passed, 32 total
Snapshots:   0 total
Time:        30.717 s
```

### 4.2 Python ML Integration Tests
Ran `python -m pytest tests/integration`:
```
tests\integration\test_ml_service.py ....                                [ 33%]
tests\integration\test_synthetic_telemetry.py ........                   [100%]

============================= 12 passed in 24.87s =============================
```

### 4.3 Frontend Realtime Architecture Tests
Ran `npm run test:realtime` in `backend/`:
```
Test 1: Telemetry Reading Key Generation & Deduplication... ✓ Passed
Test 2: Bounded Telemetry Buffer & Deduplication Merge...   ✓ Passed
Test 3: Anomaly Deduplication and Bounded Buffer...          ✓ Passed
Test 4: Connection Status State Machine Transitions...       ✓ Passed
Test 5: Reconnection Resync Event Bus Handlers...           ✓ Passed
Test 6: Environment URL Resolution...                       ✓ Passed
===========================================
ALL FRONTEND REALTIME ARCHITECTURE TESTS PASSED
===========================================
```

### 4.4 Frontend Production Build
Ran `npm run build` in `frontend/`:
```
> frontend@0.0.0 build
> tsc -b && vite build

✓ 637 modules transformed.
dist/index.html                   0.93 kB │ gzip:   0.50 kB
dist/assets/index-DjIPaQPw.css   42.15 kB │ gzip:   7.39 kB
dist/assets/index-gmgmOYjs.js   713.08 kB │ gzip: 210.53 kB
✓ built in 1.95s
```

---

## 5. Summary of Deliverables

| Deliverable | Status | Location |
| :--- | :---: | :--- |
| Canonical Environmental Event Schema | Complete | [`backend/src/shared/types.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/shared/types.ts) |
| Environmental Event Mongoose Model | Complete | [`backend/src/models/EnvironmentalEvent.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/models/EnvironmentalEvent.ts) |
| Environmental Event Repositories | Complete | [`backend/src/repositories/mongo/MongoEnvironmentalEventRepository.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/repositories/mongo/MongoEnvironmentalEventRepository.ts), [`InMemoryEnvironmentalEventRepository.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/repositories/inmemory/InMemoryEnvironmentalEventRepository.ts) |
| NASA DONKI Integration Adapter | Complete | [`backend/src/modules/space-weather/donkiService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/space-weather/donkiService.ts) |
| SatNOGS DB Ground Station Adapter | Complete | [`backend/src/modules/satellites/satnogsService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/satellites/satnogsService.ts) |
| CelesTrak Orbital & SAA Adapter | Complete | [`backend/src/modules/orbital/orbitalService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/orbital/orbitalService.ts) |
| Context Correlation Engine | Complete | [`backend/src/modules/correlation/correlationEngine.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/correlation/correlationEngine.ts) |
| Correlation Engine Unit Tests | Complete | [`backend/src/modules/correlation/correlationEngine.test.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/correlation/correlationEngine.test.ts) |
| Correlation & Orbital Express Routes | Complete | [`backend/src/modules/correlation/correlationRoutes.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/correlation/correlationRoutes.ts), [`backend/src/modules/orbital/orbitalRoutes.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/orbital/orbitalRoutes.ts) |
| Evidence-Grounded AI Diagnostics Integration | Complete | [`backend/src/modules/assessments/geminiService.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/modules/assessments/geminiService.ts) |
| UI Investigation Modal Correlated Evidence | Complete | [`frontend/src/components/InvestigationModal.tsx`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/frontend/src/components/InvestigationModal.tsx) |

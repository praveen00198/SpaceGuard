# SpaceGuard AI — AI Architecture

## Role of Gemini

Gemini AI operates as an **evidence interpreter**, not a data generator. It receives structured evidence packages and produces structured assessments grounded in that evidence.

## Architectural Position

```
Evidence Layer ──▶ Evidence Package ──▶ Gemini API ──▶ Structured Assessment ──▶ Investigation UI
```

Gemini is the **last layer** before the human operator. It does not:
- Access raw databases
- Perform anomaly detection
- Calculate health scores
- Generate telemetry data
- Make autonomous decisions

## Evidence Package (Input)

```json
{
  "satellite": {
    "id": "SAT-001",
    "name": "ExampleSat",
    "status": "active",
    "subsystems": ["power", "thermal", "communication"]
  },
  "anomaly": {
    "id": "ANM-001",
    "type": "thermal_drift",
    "severity": "high",
    "detectedAt": "2026-09-25T10:32:00Z",
    "detectionMethods": ["rule", "statistical", "ml"],
    "anomalyScore": 0.91
  },
  "telemetrySummary": {
    "parameter": "temperature",
    "currentValue": 58.4,
    "baseline": 46.8,
    "unit": "C",
    "trend": "increasing",
    "rateOfChange": 0.3
  },
  "evidenceItems": [
    {
      "evidenceId": "EV-001",
      "source": "telemetry",
      "description": "Temperature 11.6°C above baseline"
    },
    {
      "evidenceId": "EV-002",
      "source": "anomaly",
      "description": "Isolation Forest anomaly score 0.91"
    }
  ],
  "environmentalContext": {
    "kpIndex": 5,
    "solarActivity": "moderate",
    "recentEvents": []
  },
  "historicalContext": {
    "similarAnomalies": [],
    "previousAnomaliesOnSatellite": 2
  },
  "systemLimitations": [
    "Anomaly score is statistical unusualness, not fault probability",
    "No causal model available for this subsystem",
    "Environmental data from NOAA SWPC (last updated 15 min ago)"
  ]
}
```

## Structured Output (Response)

Using Gemini structured output capabilities:

```json
{
  "priority": "high",
  "summary": "Thermal subsystem showing sustained temperature increase of 11.6°C above baseline, detected by all three detection methods.",
  "evidence": [
    {
      "claim": "Temperature has drifted 11.6°C above the established baseline of 46.8°C",
      "evidenceIds": ["EV-001"]
    },
    {
      "claim": "Pattern is statistically unusual based on Isolation Forest model (score 0.91)",
      "evidenceIds": ["EV-002"]
    }
  ],
  "interpretation": "The sustained upward temperature trend across multiple detection methods suggests a genuine thermal anomaly rather than sensor noise.",
  "possibleCauses": [
    "Heater control malfunction",
    "Changed orbital geometry increasing solar exposure",
    "Thermal blanket degradation",
    "Increased payload duty cycle"
  ],
  "known": [
    "Temperature is significantly above baseline",
    "All three detection methods flagged this anomaly",
    "Current Kp index is 5 (moderate geomagnetic activity)"
  ],
  "unknown": [
    "Whether the temperature increase has a mechanical or environmental cause",
    "Whether other subsystems are affected",
    "Historical thermal behavior during similar orbital conditions"
  ],
  "cannotDetermine": [
    "Root cause without additional diagnostic telemetry",
    "Whether this represents a permanent degradation or temporary condition"
  ],
  "uncertainty": "While all detection methods agree on the anomaly, the root cause cannot be determined from available telemetry alone. The listed possible causes are hypotheses requiring investigation.",
  "recommendedInvestigation": [
    "Review heater control commands and duty cycle",
    "Check orbital position relative to solar exposure",
    "Compare with historical thermal behavior during similar orbital phases",
    "Monitor rate of temperature change over next orbit"
  ]
}
```

## Grounding Rules

### Rule 1: Never invent telemetry
AI must only reference telemetry values provided in the evidence package.

### Rule 2: Never invent external events
AI must only reference environmental events provided in the context.

### Rule 3: Never invent evidence IDs
Every claim must reference only evidence IDs from the supplied package.

### Rule 4: Never claim causality without evidence
"Possible causes" must be labeled as hypotheses, not conclusions.

### Rule 5: Explicitly state unavailable information
If data is missing, say so. Never fill gaps with fabricated information.

### Rule 6: Distinguish Known / Possible / Unknown / Cannot Determine
These four categories must be explicitly populated.

### Rule 7: Graceful failure
If Gemini is unavailable, the rest of SpaceGuard continues operating. The UI shows "AI assessment temporarily unavailable."

## Prompt Versioning

All prompts are versioned and stored in `docs/AI_PROMPTS.md`. Changes to prompts must be documented with:
- Version number
- Change description
- Rationale
- Date

## Failure Handling

| Failure | Response |
|---------|----------|
| Gemini API timeout | Return cached assessment or "unavailable" |
| Gemini rate limit | Queue request, show "pending" |
| Invalid structured output | Log error, show "assessment failed" |
| Gemini returns hallucinated evidence | Validate against supplied evidence IDs, flag unsupported claims |
| Network error | Show "AI service unreachable" |

## Evaluation Metrics

### Evidence Grounding Rate
```
Supported claims / Total claims
```

### Unsupported Claim Rate
```
Claims with invalid evidence IDs / Total claims
```

### Additional Metrics
- Structured output validity rate
- Response latency (p50, p95, p99)
- Failure rate
- Missing-evidence handling accuracy

# SpaceGuard AI — User Workflows

## 1. Dashboard Workflow
1. User opens SpaceGuard → Dashboard loads
2. Fleet overview shows all satellites with health status
3. Active anomalies panel shows recent detections
4. Environmental status shows current space weather
5. User clicks a satellite → navigates to Satellite Detail

## 2. Satellite Investigation Workflow
1. User views Satellite Detail page
2. Sees current health (overall + subsystem breakdown)
3. Reviews recent telemetry trends
4. Checks active anomalies for this satellite
5. Reviews orbital and environmental context
6. Clicks an anomaly → navigates to Investigation page

## 3. Anomaly Investigation Workflow
1. User opens Investigation page for an anomaly
2. Sees anomaly summary (type, severity, detection methods, score)
3. Reviews timeline of events leading up to and during the anomaly
4. Examines telemetry charts with anomaly markers
5. Reviews detection evidence from each method (rules, stats, ML)
6. Checks environmental context (space weather at time of anomaly)
7. Reviews historical similarity (past similar anomalies)
8. Reads AI assessment (evidence-grounded, with uncertainty)
9. Follows recommended investigation steps
10. Updates anomaly status (investigating / resolved / dismissed)

## 4. Simulation Workflow
1. User opens Simulation Control
2. Selects a scenario (thermal spike, battery degradation, etc.)
3. Starts simulation
4. Watches telemetry stream in real-time
5. Observes anomaly detection trigger
6. Reviews investigation page for simulated anomaly
7. Compares detection results against ground truth
8. Stops simulation

## 5. AI Assessment Workflow
1. Anomaly is detected and evidence is collected
2. User requests AI assessment (or auto-triggered for high severity)
3. Evidence package is assembled server-side
4. Gemini receives evidence package
5. Structured assessment is returned
6. User reviews claims linked to evidence
7. User evaluates uncertainty and recommended actions
8. If AI is unavailable: user sees detection evidence directly without AI summary

# SpaceGuard AI — Glossary

| Term | Definition |
|------|-----------|
| **Anomaly** | An observation that deviates significantly from expected behavior. Not synonymous with "fault" or "failure". |
| **Anomaly Score** | A numerical measure (0-1) of how unusual an observation is according to a detection model. Higher = more unusual. NOT fault probability. |
| **Analytical Redundancy** | Using mathematical models to replicate sensor measurements, enabling fault detection without hardware redundancy. |
| **Baseline** | The expected or typical value of a telemetry parameter under normal operating conditions. |
| **Canonical Schema** | SpaceGuard's standardized data format to which all telemetry sources are normalized. |
| **Causality** | A relationship where one event directly causes another. Must be established with evidence, never assumed from correlation. |
| **Contamination** | In Isolation Forest, the expected proportion of anomalies in the training data. |
| **Correlation** | A statistical relationship between events. Temporal correlation does not imply causation. |
| **Evidence** | A traceable, factual observation recorded by the system with a unique ID, source, and timestamp. |
| **Evidence Package** | A structured collection of evidence items, context, and metadata provided to Gemini for assessment. |
| **Fault** | A malfunction in a system component. A fault may or may not produce observable anomalies. |
| **Fault Detection** | Identifying that a fault has occurred based on observable behavior. |
| **Fault Isolation** | Determining which specific component has faulted. |
| **Feature Engineering** | Computing derived features (rolling statistics, rates of change) from raw telemetry for ML input. |
| **Grounding** | Ensuring AI claims are supported by supplied evidence, not fabricated. |
| **Health Score** | A deterministic, reproducible metric (0-100) representing subsystem operational health. Calculated by formulas, not AI. |
| **Hybrid Detection** | Combining multiple detection methods (rules, statistics, ML) for more robust anomaly identification. |
| **Isolation Forest** | An unsupervised ML algorithm that detects anomalies by measuring how easily a data point can be isolated. |
| **Kp Index** | A measure of geomagnetic disturbance (0-9). Used as space weather context for anomaly correlation. |
| **Near-Real-Time** | Data updated when new observations become available, but not continuously. May have gaps. |
| **Parity Equation** | An algebraic equation relating system inputs and outputs, used in analytical redundancy. |
| **Provenance** | The documented origin, processing history, and licensing of a dataset. |
| **Residual** | The difference between a model's predicted value and the actual measured value. Indicates potential anomalies. |
| **Severity** | The operational impact level of an anomaly (low, medium, high, critical). |
| **Structured Output** | AI responses constrained to a specific JSON schema, ensuring consistent, parseable results. |
| **Telemetry** | Measurements transmitted from a satellite, including temperatures, voltages, currents, attitudes, and other parameters. |
| **Telemetry Quality** | An indicator of measurement reliability: valid, suspect, interpolated, missing, or stale. |

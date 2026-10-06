# SpaceGuard AI — Research Notes

## Reference: "Health Monitoring of a Satellite System"

### Paper Methodology

The referenced research paper describes a model-based approach to satellite health monitoring using **analytical redundancy**. This is fundamentally different from the data-driven ML approach used in SpaceGuard's MVP.

#### Key Concepts from the Paper

1. **Satellite Dynamics Modeling**: Mathematical models of orbital and attitude dynamics
2. **Periodic Fault-Detection Filters**: Filters designed around the periodic nature of satellite orbits
3. **Algebraic Parity Equations**: Analytical relationships between system inputs and outputs
4. **Analytical Redundancy**: Using mathematical models instead of hardware redundancy to detect faults
5. **Residual Generation**: Computing the difference between predicted (model) and actual (measured) behavior
6. **Residual Processing**: Statistical analysis of residuals to distinguish faults from noise
7. **Multiple Fault Hypotheses**: Systematic consideration of which component may have failed
8. **Sequential Probability Testing**: Statistical testing to decide between fault hypotheses
9. **Actuator/Sensor Fault Identification**: Distinguishing between sensor and actuator faults
10. **Disturbance and Uncertainty Handling**: Accounting for external disturbances and model uncertainty

### What This Is NOT

- This is NOT machine learning
- This is NOT data-driven anomaly detection
- This is NOT statistical pattern recognition

This is **model-based fault detection and isolation (FDI)** — a control engineering approach.

### SpaceGuard Current Implementation

SpaceGuard's MVP uses a different approach:

| Aspect | Paper | SpaceGuard MVP |
|--------|-------|----------------|
| Detection method | Model-based residuals | Data-driven (rules + statistics + ML) |
| Models | Physics-based dynamics | Statistical features |
| Training | Mathematical derivation | Data-driven learning |
| Fault isolation | Analytical redundancy | Correlation + evidence |
| Diagnosis | Sequential probability testing | AI-assisted evidence reasoning |

### Future SpaceGuard Research

The paper's methodology represents a potential future enhancement for SpaceGuard:

```
Telemetry
    ↓
System / Physics Model (future)
    ↓
Expected Behaviour (model prediction)
    ↓
Residual (measured - predicted)
    ↓
Residual Features
    ↓
ML / Statistical Detection (enhanced by physics-informed features)
    ↓
Fault Hypotheses
    ↓
Probabilistic Diagnosis
```

#### Prerequisites for Implementation
- Accurate satellite dynamics models (orbit, attitude, thermal, power)
- Model parameters for specific satellite types
- Validation data with known fault modes
- Significant engineering effort to build and calibrate models

#### Benefits if Implemented
- Physics-grounded residuals provide stronger anomaly signals than raw telemetry features
- Model-based features can distinguish between sensor faults and actuator faults
- Residual analysis can detect subtle degradation that statistical methods miss
- Combined physics + ML approach would be state-of-the-art

#### Challenges
- Models require detailed satellite specifications (often proprietary)
- Model calibration requires expert knowledge
- Computational cost of real-time model propagation
- Generalization across satellite types is difficult

### Decision

**Decision**: Document as a research reference. Do NOT implement model-based FDI in Phase 0-7.  
**Rationale**: Requires satellite-specific physics models and parameters not available for the general-purpose MVP.  
**Future**: Revisit when SpaceGuard supports operator-configurable satellite models.

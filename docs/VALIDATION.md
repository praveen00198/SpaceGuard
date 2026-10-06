# SpaceGuard AI — Validation

## Software Validation
- All API inputs validated with Zod schemas
- All ML inputs validated with Pydantic models
- Type-safe TypeScript throughout frontend and backend
- Database schema validation via Mongoose

## ML Validation
- Model evaluation on held-out test sets
- Cross-validation where data permits
- Comparison against baseline methods
- Results documented in `docs/ML_EVALUATION.md`
- No performance claims without experimental evidence

## AI Validation
- Evidence grounding rate measurement
- Unsupported claim rate measurement
- Structured output schema validation
- Missing-evidence behavior testing
- Uncertainty statement verification

## Operational Validation
- Graceful degradation testing (each external service down)
- Error state coverage (every UI component)
- Source labeling accuracy
- Data provenance completeness

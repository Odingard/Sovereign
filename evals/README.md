# Sovereign Evaluations

Evaluation domains: state accuracy, intent classification, verification, documentation, execution, safety, and escalation. Fixtures live only in `test-data/synthetic-only/` and must contain explicit provenance and expected outcomes.

Every run pins case manifest, code, model/provider, prompt, retrieval/config, policy, workflow, and seed when applicable. Reports include per-case results, error taxonomy, safety-critical failures, subgroup/scenario slices, reviewer adjudication, thresholds, and artifact hashes. Model self-grading is never the sole gate.

Required cases are defined in WO-016. Directories separate domain suites but end-to-end cases must also prove the complete mutation/execution paths.


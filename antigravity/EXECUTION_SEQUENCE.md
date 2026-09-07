# Execution Sequence

1. Repository validation and WO-000 execution plan.
2. WO-000 architecture/security/privacy/PHI gate; default HOLD/no real PHI.
3. WO-001 canonical domain model.
4. WO-002 tenancy/identity/authority.
5. WO-003 RA state and WO-004 evidence/provenance.
6. WO-005 one-EHR ingestion then WO-006 state service.
7. WO-007 intent then WO-008 verification.
8. WO-009 Execution Graph then WO-010 policy/authority/autonomy.
9. WO-011 replaceable AI reasoning.
10. WO-012 role-based experience.
11. WO-013 therapy access.
12. WO-014 external adapters.
13. WO-015 audit/observability/incidents.
14. WO-016 clinical evaluation harness.
15. WO-017 shadow pilot only after every prior gate.

Parallel work requires an approved dependency proof and cannot touch the same authoritative contract. Each WO ends with acceptance evidence, independent reviews, exact commit, and human `GO/HOLD/NO-GO`. Never stack downstream implementation on an unapproved gate.


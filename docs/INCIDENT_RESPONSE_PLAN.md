# Sovereign Incident Response and Safety Containment Plan

## 1. Incident Severity Classification

| Severity | Definition | Example Scenarios | Target Containment SLA |
| :--- | :--- | :--- | :--- |
| **SEV-1: Critical Safety / Breach** | Potential or actual patient harm, wrong-patient action, uncontained PHI spill, or unauthorized execution. | AI candidate executed without clinician authorization; external order sent for wrong patient; real PHI detected in public repository. | Immediate (< 15 minutes) |
| **SEV-2: Major Security / Integrity** | Tenant isolation failure, model hallucination affecting decision verification, or critical credential compromise. | Cross-tenant data leak; model systematically misclassifies clinical contraindications; API key leaked. | < 1 hour |
| **SEV-3: Operational Degraded** | Adapter outage, workflow delay, non-safety-critical validation failure. | Payer portal API timeout; temporal worker restart loop; high latency in synthetic evals. | < 4 hours |

---

## 2. Containment and Kill-Switch Procedures

1. **Model Kill Switch:**
   - In the event of model hallucination, unsafe reasoning, or data leakage, the Platform/Security Owner triggers the model kill switch.
   - All AI-driven candidate generation is immediately disabled. The platform falls back to manual entry and deterministic rule-based verification.
2. **Execution Graph Pause & Cancellation:**
   - Active workflow nodes can be globally or per-tenant paused.
   - Any unconfirmed external transmissions are placed on administrative hold pending clinical safety review.
3. **Data Spill Containment:**
   - If real PHI is detected in an unauthorized location (e.g., repository commit, public log, or local dev machine), the affected system is immediately isolated.
   - Git commits containing prohibited data are scrubbed via history rewrite and force-pushed across all remotes; credentials in affected branches are rotated immediately.

---

## 3. Safe Degraded & Manual Mode Operations

- **Doctrine Invariant:** Sovereign must never leave clinical staff stranded or unable to provide patient care.
- If Sovereign services are degraded or halted:
  1. All patient clinical context remains intact in the legal EHR.
  2. Prior authorization packets and clinical evidence summaries remain exportable in standardized PDF/text format.
  3. Clinicians and staff can revert directly to standard clinic workflows without data loss.

---

## 4. Post-Incident Review and Evidence Preservation

- No clinical safety or security incident is marked resolved based on model self-report or verbal explanation alone.
- Every incident requires:
  1. Immutable timeline reconstruction from tamper-evident audit logs;
  2. Identification of all affected patient records and tenant accounts;
  3. Root cause analysis (RCA) documented in `work-orders/incident-reports/`;
  4. Regression test added to automated CI suite (`evals/safety/`);
  5. Formal sign-off from Clinical Safety Reviewer, Security/Privacy Reviewer, and Founder.

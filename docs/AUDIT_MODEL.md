# Audit Model

**Infrastructure logs ≠ clinical audit record.** Logs diagnose systems; clinical audit reconstructs clinical/operational authority and outcome.

Audit must answer who, what, when, tenant, patient, evidence, intent, authority, model/version, policy/configuration, external result, override, prior/new state, and final state. Events carry immutable ID, actor type/ID, role/grant, resource/version, action/reason, occurred/recorded time, correlation/causation, evidence/artifact hashes, provider operation, result, and safe error code.

Audit is append-only/tamper-evident, access controlled, exportable with integrity proof, retained by policy, and separate from mutable analytics projections. Corrections append. Audit failure blocks consequential mutation/execution when durable audit cannot be guaranteed.


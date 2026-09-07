# Threat Model

## Protected assets

Patient/tenant identity; PHI; five authoritative objects; credentials/keys; clinical authority; configuration; audit; model/evaluation artifacts; external-operation credentials and confirmations.

## Adversaries and failure sources

External attacker, malicious/compromised user, confused deputy, overprivileged support account, cross-tenant coding defect, compromised vendor, prompt injection or poisoned document, model hallucination, replayed webhook, duplicate/out-of-order event, insider misuse, CI/CD compromise, and accidental logging/export.

## Mandatory mitigations

Deny-by-default server authorization; trusted tenant resolution; object-scoped policy; strong authentication/MFA; least privilege; encryption; egress allowlists/SSRF controls; signed/replay-protected webhooks; input/output schemas; file scanning; secrets isolation; transactional outbox/inbox; audit integrity; PHI-safe telemetry; dependency/SAST/secret/IaC/container scanning; SBOM/provenance; backups/restores; incident drills.

## Abuse cases that must fail

Model requests another patient's context; client supplies a different tenant ID; staff accesses an unauthorized patient; prompt requests direct mutation; stale approval authorizes edited content; webhook is replayed; provider returns success without confirmation; cloud role is treated as clinical permission; logs capture PHI; a duplicate worker repeats a submission; a cancelled/superseded plan continues.


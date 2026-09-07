# Security Policy

## Scope and reporting

Report suspected vulnerabilities privately to the security contact configured by Sovereign Health AI LLC. Do not disclose patient data or exploit production systems. Until a private channel is configured, do not publish details in an issue; notify the repository owner through an approved private business channel.

## Non-negotiable controls

- No real PHI before WO-000 GO.
- Synthetic-only fixtures and screenshots.
- Trusted server-side tenant and patient context; deny by default.
- Separate infrastructure IAM from clinical/business authority.
- Encryption, managed secrets, minimal egress, signed webhooks, bounded retries.
- PHI-safe logs; clinical audit is separate from infrastructure telemetry.
- Dependency/secret/SAST/IaC/container scanning, SBOM, provenance, and protected branches.

## Incident priorities

Patient safety, wrong-patient/cross-tenant access, unauthorized clinical action, PHI exposure, audit corruption, and duplicate external execution are highest-severity events. Contain the capability, preserve evidence, maintain safe manual care paths, notify designated authorities, and do not erase relevant state.

## Supported versions

Until the first tagged implementation release, only the current protected `main` architecture baseline is supported.


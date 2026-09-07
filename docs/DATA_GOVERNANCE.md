# Data Governance

## Pre-gate rule

No real PHI before WO-000 GO. Only clearly synthetic records are permitted. Deidentification is not assumed; a documented determination is required before data is treated as deidentified.

## Required controls

- Data inventory and classification; purpose, source, owner, region, retention, and lawful/contractual basis.
- Minimum necessary collection/use/disclosure and field-level sensitivity.
- Approved service/subprocessor eligibility matrix and signed agreements.
- U.S. residency where required, encryption, key separation/rotation, secret management.
- PHI-safe application/infrastructure logs and support tooling.
- Separate consent for care, recording, messaging, research, and model improvement.
- Authorized export, amendment/correction, retention, deletion, legal hold, backup expiry, and incident evidence.
- Customer data excluded from shared model training by default.

## Provenance

Original source or durable reference is preserved. Normalized facts, corrections, summaries, decisions, and completion evidence carry source/version/timestamps. Corrections append and supersede; they do not silently rewrite source history.


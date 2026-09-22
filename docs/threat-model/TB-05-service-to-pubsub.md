# TB-05 — Service → Pub/Sub

Designed, not built. Pub/Sub does not exist yet.

## Assets
Domain events, audit events, metering events — and the tenant identity inside each.

## Controls
Transactional outbox as the only publisher (services never publish directly, S1-D09);
ordering key `tenant_id`; CMEK on every topic; dead-letter topics; consumer dedup on
`event_id`.

## STRIDE

### Spoofing — publishing as another service
`OPEN`. Per-service identities, cloud block.

**DREAD 4.6** — D8 R2 E3 A5 D1.

### Tampering — altering an event in flight
`PARTIAL`. An audit event's integrity is established when the audit service appends it
to the hash chain, so tampering in transit is detected at rest rather than prevented in
motion. That is the right place for it: the chain is what a later reader verifies.

**DREAD 3.8** — D8 R2 E3 A4 D1.

### Repudiation
`MITIGATED`. Dedup on `event_id` and the per-tenant chain make a delivered event
undeniable. Adversarial §10.11 covers duplicate delivery producing a single row.

**DREAD 2.2** — D5 R1 E2 A2 D1.

### Information disclosure — an event delivered to the wrong subscriber
`PARTIAL`. Ordering key `tenant_id` and per-tenant subscription scoping are designed.
The SIEM path is already proven: every exported event carries its own
`organization.id`, and adversarial §10.21 asserts it.

**DREAD 4.8** — D9 R2 E3 A6 D3.

### Denial of service — backlog
`PARTIAL`. Dead-letter topics and a backlog alert are designed; the drill is
cloud-blocked.

**DREAD 3.6** — D4 R5 E4 A4 D2.

### Elevation of privilege — a consumer subscribing across tenants
`OPEN`. IAM scoping, cloud block.

**DREAD 4.8** — D9 R2 E3 A6 D1.

## Residual risk
| Risk | Score | Status |
|---|---|---|
| Cross-tenant delivery | 4.8 | Cloud block |
| Cross-tenant subscription | 4.8 | Cloud block |

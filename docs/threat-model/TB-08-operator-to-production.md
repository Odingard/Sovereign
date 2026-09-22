# TB-08 — Operator → production

The insider with legitimate access. Every other boundary assumes the operator is
trusted; this one does not.

It carries a structural problem that no control fixes: **Sovereign is one person.** The
Founder is the platform operator, the approver, the security signer and, in practice,
the reviewer. Several controls below assume two people exist.

## Assets
Everything. Production data, keys, audit history, deploy path.

## Controls
JIT access via PAM with a ticket id and a 4-hour maximum; all admin actions to Cloud
Audit Logs with SIEM export; break-glass requiring dual approval and a mandatory
reason; audit chain append-only against the table owner; daily anchors in a
retention-locked bucket.

## STRIDE

### Spoofing — using another operator's access
`OPEN`. Depends on PAM and per-operator identities. Cloud block.

**DREAD 5.6** — D10 R2 E2 A9 D2.

### Tampering — an operator rewriting audit history
`MITIGATED`. Three layers, and the third — a trigger — fires for the table owner and a
superuser. A compromised admin session must `DROP` the trigger, which is itself a DDL
event in the audit log. Beyond that, the daily anchor lives in a retention-locked
bucket the operator cannot modify, so even a consistently rebuilt chain is detected.
There is a test that performs exactly that attack and is caught only by the anchor.

**DREAD 4.6** — D10 R2 E3 A8 D1.

> This is the strongest control in the model, and it is the one that most directly
> addresses the one-person problem: it does not depend on a second person existing.

### Repudiation — denying an administrative action
`PARTIAL`. Cloud Audit Logs with SIEM export are designed; the SIEM path is built and
tested, the cloud logging half is not.

**DREAD 4.4** — D7 R3 E3 A7 D2.

### Information disclosure — an operator reading PHI
`PARTIAL`. `support_readonly` holds **no capabilities at all** — emergency access is a
time-boxed break-glass grant under dual approval with a mandatory reason, never a role
default, and there is a test. `PARTIAL` because dual control needs two humans.

**DREAD 5.8** — D10 R3 E3 A9 D2.

> **Honest statement for the gate record:** dual control is implemented and enforced in
> the schema — a CHECK constraint forbids `approved_by = requested_by`, so it cannot be
> bypassed in code. But a control requiring two people is not satisfied by one person
> holding two accounts, and nothing technical can detect that. This is an
> organisational gap, not a software one, and it should be named in the Gate 1 record
> rather than left for an auditor to notice.

### Denial of service — an operator destroying an environment
`PARTIAL`. Terraform state is versioned; erasure requires dual control and refuses
under a legal hold. Backups and PITR are cloud-blocked.

**DREAD 5.0** — D9 R2 E2 A9 D1.

### Elevation of privilege — an operator granting themselves clinical authority
`MITIGATED`. `authority_grant:issue_class_c` is dual-control and MFA-required, and
every dual-control capability also requires MFA — otherwise two unverified sessions
could approve each other. Every grant issuance is audited.

**DREAD 5.2** — D10 R2 E2 A8 D2. Same one-person caveat.

## Residual risk

| Risk | Score | Status |
|---|---|---|
| Operator reads PHI; dual control has one human | **5.8** | **Name in the Gate 1 record.** Organisational, not technical |
| Operator spoofing without PAM | 5.6 | Cloud block |
| Self-granted authority, one-person dual control | 5.2 | Same as above |
| Environment destruction | 5.0 | Cloud block (backups, PITR) |

Four entries in the 4.0–6.9 band, three of them variations on the same root cause.
None blocks Gate 1 on score. The one-person dual-control gap should be stated in the
gate record in plain language, because an auditor will find it and it is better found
already written down.

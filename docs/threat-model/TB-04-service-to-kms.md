# TB-04 — Service → KMS

Analysed against the **designed** control. Cloud KMS does not exist yet; the port and a
file-backed fake do. Nothing here is marked `MITIGATED` on the strength of Terraform
that has never been applied.

## Assets
Per-tenant DEKs, the KEKs that wrap them, and every PHI column and object they protect.

## Controls
`KeyManagementPort` with exactly three methods; IAM separation so runtime services hold
`cryptoKeyEncrypterDecrypter` on `tenant-kek` **only**; 90-day rotation; HSM protection
in prod; DEK cache with a 5-minute TTL that zeroes key bytes on eviction.

## STRIDE

### Spoofing — a service assuming another's key identity
`OPEN`. Depends on per-service Cloud Run identities, which the cloud block delivers.

**DREAD 5.0** — D9 R2 E3 A6 D1.

### Tampering — substituting a key
`PARTIAL`. Every envelope records the `kid` that produced it, so a substituted key
fails authenticated decryption rather than silently producing wrong plaintext.

**DREAD 3.6** — D9 R2 E2 A4 D1.

### Repudiation — denying a key destruction
`MITIGATED`. The certificate of destruction names both requester and approver and is
hashed over its own content. A certificate recording only "erased" proves nothing about
who authorised it, which is the question asked afterwards.

**DREAD 2.4** — D6 R1 E2 A2 D1.

### Information disclosure — key material in memory or logs
`MITIGATED`. Keys never reach a log: the field allowlist prohibits `secret`, `token`,
`apiKey` and `password` by name, and the value rule drops any non-primitive under an
allowlisted key. The DEK cache zeroes bytes on eviction and on replacement, so rotation
does not leave the superseded key in memory.

**DREAD 4.2** — D10 R1 E2 A6 D2. Best-effort: the runtime may have copied a buffer.
The cost of the memset is one instruction; the alternative is keys lying around.

### Denial of service — KMS unavailable
`PARTIAL`. The design fails **closed**: PHI reads and writes return 503 while non-PHI
paths continue. `KeyUnavailableError` and `KeyDestroyedError` are deliberately separate
types — unavailable may be transient and worth retrying, destroyed is permanent and a
retry is pointless. The chaos drill (S1-D24) proves the behaviour and is cloud-blocked.

**DREAD 4.4** — D6 R5 E3 A8 D3. Availability only; no disclosure.

### Elevation of privilege — a service reaching `db-kek` or `gcs-kek`
`OPEN`. IAM separation is designed and a Conftest rule (NEW-8) is specified to prove
it. Unenforceable until the cloud block applies it.

**DREAD 5.2** — D9 R2 E3 A7 D1.

## Residual risk
| Risk | Score | Status |
|---|---|---|
| Key identity spoofing | 5.0 | Cloud block |
| KEK privilege separation unenforced | 5.2 | Cloud block |
| KMS outage degrades PHI paths | 4.4 | Accepted; fail-closed by design |

Three entries in the 4.0–6.9 band, all cloud-dependent. None blocks Gate 1 on score,
and all three become testable the moment the cloud block lands.

# ADR-0010: Provider-Independent Identity, Scoped Authority Grants, and Contextual Policy Evaluation

## Status
ACCEPTED FOR V0.1

## Date
2026-09-08

## Context
Sovereign coordinates clinical workflows requiring strict, non-collapsible boundaries among:
1. **Authentication:** Who/what the actor is.
2. **Authorization:** What the actor is permitted to access or read/write.
3. **Clinical Authority:** Whether the actor possesses valid, unrevoked authority to authorize a healthcare transaction.
4. **Organizational Policy:** What the healthcare organization permits Sovereign software to automate under defined conditions.

Simplistic RBAC or delegating authority to external identity providers (Google Cloud IAM, Okta, Firebase) is unacceptable because:
- Infrastructure IAM permissions grant data transport/storage access, not clinical authority.
- A role is not an authority grant.
- An AI model or agent runtime can possess an authenticated technical identity for auditing, but can never become a source of clinical authority.
- The requester does not define the security requirements for its own request.

## Decision
1. **Canonical Typed Actor Model:**
   Seven distinct actor kinds (`HUMAN_CLINICIAN`, `HUMAN_STAFF`, `HUMAN_ADMIN`, `SOVEREIGN_SERVICE`, `AI_AGENT_RUNTIME`, `EXTERNAL_SYSTEM`, `SYSTEM_ANONYMOUS`).
   AI agents and services have technical identities only and can never hold clinician qualifications or issue Class C authority grants.
2. **The Requester Does Not Define Security Requirements:**
   Action requirements are derived from server-resolved `ActionDefinition`s. Callers request capabilities; Sovereign independently determines the required `AuthorityClass`, patient-context requirement, and organizational scope. Downgrade attempts fail closed.
3. **Factual Qualifications & Relationships:**
   `ProfessionalCredential` and `ActorRelationship` represent facts only. A relationship is not an authority grant. Proxy and supervisory relationships confer no operational authority in WO-002.
4. **Scoped, Revocable Authority Grants:**
   `AuthorityGrant` is a first-class, durable domain object. Expiration is evaluated from temporal boundaries using trusted server time. Revocation is authoritative from the presence of `revocation?: GrantRevocationRecord`.
5. **Generic Authorization Binding:**
   `AuthorizationBinding` decouples Class C transactions from unstable raw JSON hashes, supporting semantic fingerprints, intent orders, execution nodes, and digests.
6. **Provider Independence:**
   Core domain identity and authority packages have zero dependencies on external IdPs, Google IAM, or web frameworks. External IdPs connect exclusively through peripheral adapters.

## Consequences
- **Positive:** Clear, mathematically auditable security boundary. AI agents cannot self-authorize.
- **Positive:** Replay of expired or revoked grants fails closed immediately.
- **Negative:** Evaluating contextual grants and parent-child delegation requires explicit domain logic before execution.

# WO-002B — Identity Edge, SCIM, Service Auth & API Gateway

Status: BLOCKED BY WO-002A (may plan in parallel)  
Priority: P0  
Risk: CRITICAL  
Owner: Andre Byrd (Founder)
Clinical reviewer: Mark
Security reviewer: Michael
Architecture reviewer: Roger

## Objective and rationale

WO-002 proved the domain model of identity and authority. Nothing yet authenticates a human, provisions a user, revokes a session, or exposes an HTTP edge that resolves trusted tenant context. This work order builds the peripheral identity adapters and the Fastify API gateway required by master plan Phase 1.1 and 4.1 while preserving ADR-0010: identity is not authority.

## Dependencies/inputs

WO-002 (GO), WO-002A (environments, secrets, WIF), ADR-0006/0010/0011, `docs/STAGE1_FOUNDATION_SPEC.md` §4–§6 and §7.1/7.4/7.6, IdP vendor promoted at least to `APPROVED FOR SYNTHETIC USE` in the eligibility matrix.

## Scope

- `adapters/identity-oidc`: OIDC/SAML 2.0 federation through the selected IdP (Auth0 Organizations as leading candidate; Keycloak fallback), one IdP organization per Sovereign tenant, custom claims (`tenant_id`, `user_id`, `session_id`, `roles`, `site_ids`, `mfa`), JWKS verification, 15-minute access tokens, rotating refresh with reuse detection, 8-hour absolute session.
- MFA policy: mandatory for `HUMAN_CLINICIAN`, `HUMAN_ADMIN`, security/auditor roles in all environments.
- Session revocation: `session_revocation` repository; gateway refresh ≤30 s; user revoke → IdP refresh-token revocation + all sessions dead.
- `adapters/identity-scim`: SCIM 2.0 `/scim/v2/{Users,Groups,ServiceProviderConfig,Schemas,ResourceTypes}`; per-connection hashed bearer token scoped to one tenant; group→role mapping table; `active=false` → revoke grants and sessions ≤30 s; every SCIM op audited with `actorKind=EXTERNAL_SYSTEM`.
- Service-to-service auth: Google-signed ID tokens (audience = target service) issued from Cloud Run service identities plus mTLS internal ingress; signed `X-Sovereign-Context` (HMAC, 60 s validity) carries user context and is never sufficient alone.
- `apps/gateway` (Fastify): JWT verification, trusted tenant resolution from claims only, `AuthoritativeSecurityContext` construction (ADR-0010), per-tenant token-bucket rate limits, Zod schema validation from `packages/contracts`, `Idempotency-Key` enforcement, security headers, request size/content-type limits, ClamAV scanning for uploads, `/health/live`, `/health/ready`, `/v1/integration-health`.
- `packages/kernel`: `RequestContext` guard, `withTenantTransaction` as the only DB entry point for tenant data, idempotency middleware, outbox helper, `audit.emit()` (chain implementation lands in WO-002C).
- Dual control (`approvals` table; second distinct human) for grant creation by admins, kill-switch toggles in prod, high-risk configuration; break-glass: time-boxed (≤4 h) PHI access grant with mandatory reason, alert on activation, every read audited.
- Minimal admin UI slice in `apps/admin`: tenants (operator), sites, users, grants, approvals inbox, session revocation.

## Out of scope

Patient-facing auth; clinical authorization semantics (unchanged from WO-002); audit chain internals (WO-002C); any PHI.

## Requirements and rules

- Tenant identity comes from verified IdP claims only; any code reading tenant from body/query/header outside the gateway fails review and the Semgrep rule (WO-002A).
- Authentication success grants no capability; every handler calls the domain `AuthorizationEvaluator` with a server-resolved `ActionDefinition`.
- AI and service principals cannot obtain human roles, Class C/D grants, or break-glass.
- All mutating endpoints require `Idempotency-Key`; same key + different body → 409.
- IdP holds authentication only; roles/grants remain in Sovereign and are fetched by the IdP action at login.

## Safety/security/audit/ports

Deny by default; MFA; short-lived tokens; revocation; anti-IDOR (cross-tenant object → 404, never 403); JIT support access; dual control; break-glass alerting. Audit: login success/failure, token rejection, every authorization deny, grant/revoke, approval decisions, SCIM operations, break-glass request/approve/use. Ports: `IdentityProviderPort`, `ProvisioningPort` (SCIM), `SessionRevocationPort`, `PolicyDecisionPort` (domain evaluator).

## Failure/tests

Missing/invalid/expired/forged JWT (`alg=none`, wrong `aud`/`iss`, future `nbf`) → 401 audited; missing tenant claim → 401; forged/expired signed context → 401; HMAC-only service call → 401; tenant tampering on every mutating endpoint → ignored + audited; role matrix sweep vs `config/roles/matrix.yaml`; site scoping → 404; privileged action without MFA → 403; self-approval → 409; idempotency replay and 100 concurrent identical POSTs → one resource; SCIM deactivation → sessions dead ≤30 s; SCIM token of tenant A cannot touch tenant B; IdP outage → existing sessions continue to expiry, new logins blocked with truthful banner.

## Acceptance criteria

- AC-002B-01: OIDC and SAML login produce tokens with all required claims; MFA enforced for privileged roles (evidence: automated tests + screenshots on synthetic tenants).
- AC-002B-02: Session revocation propagates ≤30 s across gateway instances.
- AC-002B-03: Token negative-test matrix (≥8 cases) passes.
- AC-002B-04: SCIM 2.0 conformance round-trip with the IdP's SCIM client; deprovision test passes.
- AC-002B-05: Service-to-service calls require bound ID token + mTLS; HMAC-only rejected.
- AC-002B-06: Gateway resolves `AuthoritativeSecurityContext` only from claims; Semgrep rule and adversarial tenant-tamper suite pass.
- AC-002B-07: Idempotency and rate-limit tests pass; integration-health endpoint returns truthful per-dependency state with no secrets/PHI.
- AC-002B-08: Cross-tenant and cross-site direct-object tests return 404 with audit rows.
- AC-002B-09: Dual control and break-glass workflows proven; alert fires on break-glass activation.
- AC-002B-10: Independent security review of identity adapters and gateway recorded in the gate record.

## Documentation/evidence/decision

Identity edge diagram (SVG), token claims schema, role matrix, SCIM onboarding guide, runbooks (IdP outage, session revocation, break-glass), gate record. **HOLD** on any tenant-resolution path that trusts request data; GO only with named security reviewer approval.

## Mandatory work-order field index

| Required field | Binding location/content |
| --- | --- |
| Status | Header metadata; must be updated only from acceptance evidence. |
| Priority | Header metadata. |
| Risk | Header metadata and residual-risk gate review. |
| Owner | Header role; assign a named human before execution. |
| Clinical reviewer | Header role; independent named human approval required where applicable. |
| Security reviewer | Header role; independent named human approval required where applicable. |
| Objective | Objective section above. |
| Product rationale | Objective/rationale section above; explains why the control matters to Sovereign. |
| Dependencies | Dependencies/inputs section above; unresolved dependency blocks start. |
| Inputs | Dependencies/inputs section above; inputs must be versioned and attributable. |
| Scope | Scope section above; no silent expansion. |
| Explicitly out of scope | Out-of-scope section above; prohibited work remains prohibited. |
| Functional requirements | Requirements section above and acceptance criteria below it. |
| Domain rules | Domain rules in the requirements section; repository constitution also applies. |
| Safety requirements | Safety controls above plus independent clinical-safety review. |
| Security/privacy requirements | Security/privacy controls above plus WO-000 restrictions. |
| Audit requirements | Audit controls above; consequential work requires durable audit. |
| Adapter/port requirements | Ports/adapters section above; core remains provider independent. |
| Failure behavior | Failure section above; identity/evidence/authority ambiguity fails closed. |
| Test requirements | Test section above; synthetic positive, negative, replay and failure tests required. |
| Acceptance criteria | Numbered AC list above; every item requires objective evidence. |
| Required documentation | Documentation/evidence section above. |
| Completion evidence | Documentation/evidence section; self-report is insufficient. |
| Go / Hold / No-Go decision | Final decision statement above; only designated humans approve GO. |

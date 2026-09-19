# ADR-0012 — Identity Provider Selection: Google Cloud Identity Platform (cloud) and Keycloak (local)

Status: Accepted (Founder)

## Context

ADR-0011 left the IdP vendor open with Auth0 as the leading candidate. Auth0's BAA requires its enterprise plan; Sovereign is bootstrapped and builds locally first (ADR-0006/0007). The IdP is an adapter behind the ADR-0010 identity ports; it holds authentication only and never authority.

## Decision

1. **Cloud IdP: Google Cloud Identity Platform.** Covered by the same Google Cloud BAA Sovereign must execute for Cloud SQL/KMS/GCS; Google publishes a HIPAA implementation guide for the service. Configuration: one Identity Platform tenant per Sovereign tenant; OIDC/SAML enterprise connections per tenant; MFA enforced for privileged roles; blocking functions add the custom claims defined in `docs/STAGE1_FOUNDATION_SPEC.md` §4.1; email/password permitted for pilot only with MFA.
2. **Local/CI IdP: Keycloak** in `docker-compose.yml`, implementing the same `IdentityProviderPort`; synthetic users only; no cloud credentials.
3. **SCIM** is served by Sovereign (`adapters/identity-scim`) regardless of IdP; Identity Platform has no SCIM server and none is expected.
4. **Auth0** is retained in the Service Eligibility Matrix as an alternative only if a customer contract requires it; switching is an adapter swap, not a domain change.
5. Identity Platform status in the eligibility matrix: `RESEARCH / NOT APPROVED FOR PHI` until the GCP BAA is executed and the configuration review passes; synthetic use permitted in dev/staging.

## Consequences

- No second vendor BAA; identity cost is pay-as-you-go at pilot volume.
- The adapter must implement two providers (Keycloak, Identity Platform) from day one, which proves the port is real.
- Session revocation and custom-claim refresh are implemented in Sovereign (`services/identity`), not delegated to the IdP.

## Rejected alternatives

- Auth0 as primary: rejected on BAA cost for a bootstrapped build.
- Keycloak in production: rejected for now on operational burden without a security team; remains the fallback.
- Firebase Auth (consumer tier): rejected; Identity Platform is the BAA-covered tier of the same service.

## Verification

- `adapters/identity-oidc` contract tests pass against both providers.
- WO-002B AC-01/02 evidence recorded against Identity Platform in staging and Keycloak in CI.

# Tenancy Model

Tenant is an organization security boundary, not a UI filter. Tenant context derives from authenticated membership and selected authorized organization/site. Client-provided tenant IDs are untrusted selectors and never authority.

Every patient, source, fact, intent, graph, access case, configuration, model invocation, object key, event, cache entry, job, audit event, export, and metric includes/enforces tenant scope. Database constraints and repository APIs require tenant keys. Background jobs carry signed/validated tenant context. Cross-tenant joins are prohibited except a separately governed platform operation with no patient disclosure.

Patient identity is tenant-local and source-qualified. Matching uncertainty creates reconciliation work; AI cannot merge, split, invent, or reassign identities. Tests cover direct-object-reference, search, export, cache, queue, webhook, file/object storage, analytics, and support tooling isolation.


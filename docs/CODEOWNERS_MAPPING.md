# CODEOWNERS Role and Team Mapping Specification

## Purpose

The repository root `CODEOWNERS` file defines governance boundaries across architectural, clinical safety, security, privacy, workflow, and quality assurance domains using team slugs under `@sovereign-health-ai/*`.

This document establishes the official placeholder role mapping for development. In accordance with Founder instructions, local synthetic development is **not blocked** by unconfigured GitHub organization team slugs, but resolution is **strictly mandatory** before:
1. Enabling production GitHub branch protection rules;
2. Onboarding external engineering contributors;
3. Provisioning any PHI-capable or staging/production cloud environment.

---

## Role-to-Team Mapping Matrix

| Role Domain | Current CODEOWNERS Slug | Responsible Governance Body | Mandatory Resolution Trigger |
| :--- | :--- | :--- | :--- |
| **Maintainers / Core** | `@sovereign-health-ai/maintainers` | Platform Engineering Leads | Before external contributor onboarding |
| **Founder Authority** | `@sovereign-health-ai/founder` | Sovereign Health AI LLC Executive Authority | Before any production release or PHI gate |
| **Architecture** | `@sovereign-health-ai/architecture` | Lead System Architect | Before merging core domain contract changes |
| **Clinical Safety** | `@sovereign-health-ai/clinical-safety` | Designated Rheumatology Safety Lead | Before any clinical state/intent spec modification |
| **Security** | `@sovereign-health-ai/security` | Designated Security Lead | Before any tenancy, auth, or adapter change |
| **Privacy** | `@sovereign-health-ai/privacy` | Designated Privacy / Compliance Officer | Before data governance or PHI policy changes |
| **Workflow** | `@sovereign-health-ai/workflow` | Distributed Systems & Workflow Lead | Before execution graph or adapter change |
| **QA / Evaluation** | `@sovereign-health-ai/qa` | Quality Assurance Lead | Before signing work order acceptance evidence |

---

## Implementation Rules

1. **No Invented Identities:** Contributors must not invent personal usernames or fictitious organization names to satisfy automated linters.
2. **Local Development Exception:** Local Git workflows and synthetic tests proceed using local Git commits and internal reviewer agent checks.
3. **Pre-Production Verification Gate:** Prior to deploying branch protection on GitHub or connecting remote CI/CD systems, the repository administrator must bind each team slug to verified GitHub organization teams with multi-factor authentication (MFA) enforced.

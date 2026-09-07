/**
 * @file Sovereign Authority Classes (ADR-0005)
 * @description Risk-based classification of actions.
 * Class D remains human; AI never exercises clinician authority.
 */

export enum AuthorityClass {
  CLASS_A_AUTONOMOUS_ADMIN = "CLASS_A_AUTONOMOUS_ADMIN",
  CLASS_B_ORG_POLICY = "CLASS_B_ORG_POLICY",
  CLASS_C_CLINICIAN_AUTH = "CLASS_C_CLINICIAN_AUTH",
  CLASS_D_CLINICAL_JUDGMENT = "CLASS_D_CLINICAL_JUDGMENT",
}

export const AUTHORITATIVE_OBJECT_TYPES = [
  "CLINICAL_STATE",
  "CLINICAL_EVIDENCE_PROVENANCE",
  "CLINICAL_INTENT",
  "EXECUTION_GRAPH",
  "THERAPY_ACCESS_STATE",
] as const;

export type AuthoritativeObjectType = (typeof AUTHORITATIVE_OBJECT_TYPES)[number];

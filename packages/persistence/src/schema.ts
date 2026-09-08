/**
 * @file Sovereign Relational PostgreSQL Schema Types for Kysely
 * @description Invariant: Composite (tenant_id, id) keys provide defense-in-depth, not an isolation guarantee.
 * Every query requires explicit TenantPatientContext scoping.
 */

import type { Generated } from "kysely";

export interface ClinicalEvidenceTable {
  id: string;
  tenant_id: string;
  patient_id: string;
  aggregate_version: number;
  schema_version: number;
  source_system: string;
  source_locator: string;
  content_sha256: string;
  content_mime_type: string;
  extraction_lineage: string;
  sensitivity_classification: string;
  provenance_origin: string;
  effective_time_json: string;
  source_recorded_time_json: string;
  sovereign_ingestion_time: Date;
  assessments_json: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ClinicalStateTable {
  id: string;
  tenant_id: string;
  patient_id: string;
  aggregate_version: number;
  schema_version: number;
  assertions_json: string;
  last_evaluated_at: Date;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ClinicalIntentTable {
  id: string;
  tenant_id: string;
  patient_id: string;
  aggregate_version: number;
  schema_version: number;
  stage: string;
  action_category: string;
  action_verb: string;
  target_concept_code: string;
  target_concept_name: string;
  action_concept_json: string;
  authority_class: string;
  authority_reference: string | null;
  clinician_actor_id: string;
  supporting_evidence_ids_json: string;
  superseded_by_intent_id: string | null;
  supersedes_intent_id: string | null;
  effective_time_json: string;
  source_recorded_time_json: string;
  sovereign_ingestion_time: Date;
  supersession_time: Date | null;
  rationale_narrative: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ExecutionGraphTable {
  id: string;
  tenant_id: string;
  patient_id: string;
  aggregate_version: number;
  schema_version: number;
  traceable_intent_ids_json: string;
  nodes_json: string;
  is_cancelled: boolean;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface TherapyAccessCaseTable {
  id: string;
  tenant_id: string;
  patient_id: string;
  aggregate_version: number;
  schema_version: number;
  stage: string;
  associated_intent_ids_json: string;
  associated_graph_ids_json: string;
  verified_evidence_ids_json: string;
  closure_reason: string | null;
  effective_time_json: string;
  source_recorded_time_json: string;
  sovereign_ingestion_time: Date;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface DomainOutboxEventTable {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  event_name: string;
  aggregate_id: string;
  aggregate_version: number;
  schema_version: number;
  actor_id: string;
  correlation_id: string;
  causation_id: string;
  payload_json: string;
  occurred_at: Date;
  dispatched_at: Date | null;
}

export interface ActorTable {
  id: string;
  tenant_id: string;
  kind: string;
  display_name: string;
  technical_subject_id: string;
  qualifications_json: string;
  relationships_json: string;
  system_attribution: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface OrganizationUnitTable {
  id: string;
  tenant_id: string;
  display_name: string;
  physical_location_json: string | null;
  parent_unit_id: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ActorOrgUnitAssignmentTable {
  id: string;
  tenant_id: string;
  actor_id: string;
  organization_unit_id: string;
  assigned_role: string;
  is_primary: boolean;
  created_at: Generated<Date>;
}

export interface AuthorityGrantTable {
  id: string;
  tenant_id: string;
  organization_unit_scope: string | null;
  patient_id_scope: string | null;
  target_resource_scope_json: string | null;
  required_authority_class: string;
  issuer_actor_id: string;
  grantee_actor_id: string;
  permitted_capability: string;
  authorization_binding_json: string | null;
  effective_from: Date;
  expires_at: Date;
  parent_grant_id: string | null;
  source_reference: string | null;
  revocation_json: string | null;
  correlation_id: string;
  causation_id: string;
  audit_lineage_id: string;
  schema_version: number;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AuthorizationAuditLogTable {
  id: string;
  decision_id: string;
  tenant_id: string;
  organization_unit_id: string | null;
  patient_id: string | null;
  actor_id: string;
  actor_kind: string;
  technical_subject_id: string;
  requested_capability: string;
  evaluated_authority_class: string;
  outcome: string;
  reason_code: string;
  reason_facts_json: string;
  grants_considered_json: string;
  evaluated_policy_version: string;
  correlation_id: string;
  causation_id: string;
  occurred_at: Date;
}

export interface ActorIdentityMappingTable {
  id: string;
  tenant_id: string;
  idp_issuer: string;
  idp_subject: string;
  actor_id: string;
  mapped_at: Generated<Date>;
}

export interface PatientIdentityMappingTable {
  id: string;
  tenant_id: string;
  external_system: string;
  external_patient_id: string;
  patient_id: string;
  mapped_at: Generated<Date>;
}

export interface SovereignPostgresDatabase {
  clinical_evidence: ClinicalEvidenceTable;
  clinical_states: ClinicalStateTable;
  clinical_intents: ClinicalIntentTable;
  execution_graphs: ExecutionGraphTable;
  therapy_access_cases: TherapyAccessCaseTable;
  domain_outbox_events: DomainOutboxEventTable;
  actors: ActorTable;
  organization_units: OrganizationUnitTable;
  actor_org_unit_assignments: ActorOrgUnitAssignmentTable;
  authority_grants: AuthorityGrantTable;
  authorization_audit_log: AuthorizationAuditLogTable;
  actor_identity_mappings: ActorIdentityMappingTable;
  patient_identity_mappings: PatientIdentityMappingTable;
}

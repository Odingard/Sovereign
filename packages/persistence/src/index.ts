import type { Kysely } from 'kysely';
import type { TenantId, PatientId } from '@sovereign/domain';

/**
 * Sovereign Authoritative Database Schema Interfaces
 * PostgreSQL is the relational system of record for all 5 authoritative objects.
 */
export interface AuthoritativeStateTable {
  id: string;
  tenant_id: string;
  patient_id: string;
  aggregate_type: string;
  aggregate_version: number;
  payload: string; // JSONB
  evidence_hash: string;
  created_at: string;
  updated_at: string;
}

export interface SovereignDatabase {
  authoritative_states: AuthoritativeStateTable;
}

export interface AuthoritativeRepository {
  findLatestByPatient(tenantId: TenantId, patientId: PatientId, aggregateType: string): Promise<AuthoritativeStateTable | null>;
  saveNewVersion(record: Omit<AuthoritativeStateTable, 'id' | 'created_at' | 'updated_at'>): Promise<AuthoritativeStateTable>;
}

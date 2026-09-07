/**
 * @file Base Domain Event Contract
 * @description Invariant: Every domain event carries complete causal lineage.
 */

import type {
  ActorId,
  CausationId,
  CorrelationId,
  EventId,
  PatientId,
  TenantId,
} from "../common/identifiers.js";

export interface DomainEvent<TName extends string, TPayload> {
  readonly eventId: EventId;
  readonly tenantId: TenantId;
  readonly patientId?: PatientId;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly schemaVersion: number;
  readonly actorId: ActorId;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId;
  readonly occurredAt: Date;
  readonly eventName: TName;
  readonly payload: TPayload;
}

import { createHash } from 'node:crypto';
import type { TenantId, PatientId } from '@sovereign/domain';

export interface AuditEventRecord {
  eventId: string;
  tenantId: TenantId;
  patientId: PatientId;
  actorId: string;
  action: string;
  timestamp: string;
  payloadHash: string;
  prevHash?: string;
}

export class AuditLogger {
  public static hashPayload(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  public static generateEventHash(event: AuditEventRecord): string {
    const raw = `${event.eventId}:${event.tenantId}:${event.patientId}:${event.actorId}:${event.action}:${event.timestamp}:${event.payloadHash}:${event.prevHash || 'ROOT'}`;
    return createHash('sha256').update(raw).digest('hex');
  }
}

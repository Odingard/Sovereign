/**
 * @file audit.emit (WO-002C S1-06)
 * @description Writes an audit event to the outbox inside the caller's transaction.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3, §8.4, AGENTS.md, WO-015.
 *
 * Services never call the audit service synchronously. The event goes into
 * `domain_outbox_events` in the SAME transaction as the business write; the relay
 * publishes it; `services/audit` appends it to the hash chain.
 *
 * "A consequential operation whose audit row cannot commit fails." That is why this
 * takes a transaction handle and does not catch: if the append throws, the caller's
 * transaction rolls back and the business write goes with it. Swallowing the error
 * here would produce unaudited mutations, which is the one outcome the audit chain
 * exists to make impossible.
 */

import { AuditEventInputSchema } from "@sovereign/contracts";
import type { AuditEventInput } from "@sovereign/contracts";
import type { OutboxPort, TransactionHandle } from "./ports.js";

export interface AuditEmitter {
  emit(trx: TransactionHandle, event: AuditEventInput): Promise<void>;
}

export function createAuditEmitter(outbox: OutboxPort): AuditEmitter {
  return {
    async emit(trx, event) {
      // Validate before writing. A malformed audit row is discovered at chain
      // verification time otherwise, long after the context is gone. The schema also
      // rejects any attempt to set seq/prevHash/eventHash, which only the audit
      // service may assign.
      const validated = AuditEventInputSchema.parse(event);
      await outbox.append(trx, validated);
    },
  };
}

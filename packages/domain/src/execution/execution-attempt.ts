/**
 * @file External Execution Attempt
 * @description Represents a discrete external transmission or communication attempt to an adapter/external system.
 */

import type { ExecutionAttemptId, ExecutionNodeId } from "../common/identifiers.js";
import type { ExternalAttemptState } from "./execution-states.js";

export interface ExternalExecutionAttempt {
  readonly attemptId: ExecutionAttemptId;
  readonly nodeId: ExecutionNodeId;
  readonly attemptNumber: number;
  readonly state: ExternalAttemptState;
  readonly targetSystem: string;
  readonly dispatchedAt: Date;
  readonly responseReceivedAt?: Date;
  readonly transportStatusCode?: string;
  readonly failureReason?: string;
}

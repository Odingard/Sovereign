/**
 * @file Execution Graph Node
 * @description Discrete operational task within the Execution Graph DAG.
 */

import type { AuthorityClass } from "../common/authority-class.js";
import type { ExecutionNodeId } from "../common/identifiers.js";
import type { CompletionConfirmation } from "./completion-confirmation.js";
import type { ExternalExecutionAttempt } from "./execution-attempt.js";
import type { ExecutionNodeState } from "./execution-states.js";

export interface ExecutionNodeProps {
  readonly nodeId: ExecutionNodeId;
  readonly actionType: string;
  readonly authorityClass: AuthorityClass;
  readonly requiredDependencies: ReadonlyArray<ExecutionNodeId>;
  readonly state: ExecutionNodeState;
  readonly attempts: ReadonlyArray<ExternalExecutionAttempt>;
  readonly completionConfirmation?: CompletionConfirmation;
  readonly failureReason?: string;
}

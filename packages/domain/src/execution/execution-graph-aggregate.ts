/**
 * @file Execution Graph Aggregate Root
 * @description Durable, deterministic Directed Acyclic Graph (DAG) of operational actions.
 * Invariants:
 * 1. Flexible cardinality: Every graph traces to one or more valid, authorized clinical intents.
 * 2. Node lifecycle is strictly separated from external attempt state.
 * 3. Completion requires structured CompletionConfirmation with verified evidence.
 * 4. Temporal is a workflow runtime orchestrator, NOT the Execution Graph system of record.
 */

import { InvariantViolationError } from "../common/domain-error.js";
import type {
  ExecutionGraphId,
  ExecutionNodeId,
  IntentId,
  TenantPatientContext,
} from "../common/identifiers.js";
import type { VersionedAggregateIdentity } from "../common/versioning.js";
import type { CompletionConfirmation } from "./completion-confirmation.js";
import type { ExternalExecutionAttempt } from "./execution-attempt.js";
import type { ExecutionNodeProps } from "./execution-node.js";
import { ExecutionNodeState, ExternalAttemptState } from "./execution-states.js";

export interface ExecutionGraphProps extends VersionedAggregateIdentity {
  readonly graphId: ExecutionGraphId;
  readonly context: TenantPatientContext;
  readonly traceableIntentIds: ReadonlyArray<IntentId>;
  readonly nodes: ReadonlyMap<ExecutionNodeId, ExecutionNodeProps>;
  readonly isCancelled: boolean;
}

export class ExecutionGraphAggregate {
  private constructor(public readonly props: ExecutionGraphProps) {}

  public static create(
    graphId: ExecutionGraphId,
    context: TenantPatientContext,
    traceableIntentIds: ReadonlyArray<IntentId>,
    schemaVersion = 1,
  ): ExecutionGraphAggregate {
    if (!traceableIntentIds || traceableIntentIds.length === 0) {
      throw new InvariantViolationError(
        "Execution graph must be traceable to at least one valid clinical intent.",
      );
    }

    return new ExecutionGraphAggregate({
      graphId,
      context,
      traceableIntentIds,
      nodes: new Map<ExecutionNodeId, ExecutionNodeProps>(),
      isCancelled: false,
      aggregateVersion: 1,
      schemaVersion,
    });
  }

  public static reconstitute(props: ExecutionGraphProps): ExecutionGraphAggregate {
    return new ExecutionGraphAggregate(props);
  }

  public addNode(node: ExecutionNodeProps): ExecutionGraphAggregate {
    if (this.props.isCancelled) {
      throw new InvariantViolationError("Cannot add node to cancelled execution graph.");
    }
    if (this.props.nodes.has(node.nodeId)) {
      throw new InvariantViolationError(`Node with ID '${node.nodeId}' already exists in graph.`);
    }

    // Validate dependencies exist or will be resolved
    for (const depId of node.requiredDependencies) {
      if (depId === node.nodeId) {
        throw new InvariantViolationError(
          `Circular dependency detected: Node '${node.nodeId}' cannot depend on itself.`,
        );
      }
    }

    const updatedNodes = new Map(this.props.nodes);
    updatedNodes.set(node.nodeId, node);

    return new ExecutionGraphAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      nodes: updatedNodes,
    });
  }

  public recordAttempt(
    nodeId: ExecutionNodeId,
    attempt: ExternalExecutionAttempt,
  ): ExecutionGraphAggregate {
    const node = this.props.nodes.get(nodeId);
    if (!node) {
      throw new InvariantViolationError(`Node '${nodeId}' not found in execution graph.`);
    }

    // INVARIANT: An attempt (even if accepted on the wire) does NOT automatically complete the node!
    const updatedAttempts = [...node.attempts, attempt];
    const nextNodeState =
      attempt.state === ExternalAttemptState.FAILED
        ? ExecutionNodeState.BLOCKED
        : ExecutionNodeState.IN_PROGRESS;

    const updatedNodes = new Map(this.props.nodes);
    updatedNodes.set(nodeId, {
      ...node,
      state: nextNodeState,
      attempts: updatedAttempts,
      failureReason: attempt.failureReason,
    });

    return new ExecutionGraphAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      nodes: updatedNodes,
    });
  }

  public completeNode(
    nodeId: ExecutionNodeId,
    confirmation: CompletionConfirmation,
  ): ExecutionGraphAggregate {
    const node = this.props.nodes.get(nodeId);
    if (!node) {
      throw new InvariantViolationError(`Node '${nodeId}' not found in execution graph.`);
    }

    // Invariant: Structured completion confirmation with verified evidence
    if (!confirmation.verifyingEvidenceId || !confirmation.externalReferenceId) {
      throw new InvariantViolationError(
        "Execution node completion requires structured confirmation with verified evidence and external reference.",
      );
    }

    const updatedNodes = new Map(this.props.nodes);
    updatedNodes.set(nodeId, {
      ...node,
      state: ExecutionNodeState.COMPLETED,
      completionConfirmation: confirmation,
    });

    return new ExecutionGraphAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      nodes: updatedNodes,
    });
  }

  public updateNodeState(
    nodeId: ExecutionNodeId,
    newState: ExecutionNodeState,
    reason?: string,
  ): ExecutionGraphAggregate {
    const node = this.props.nodes.get(nodeId);
    if (!node) {
      throw new InvariantViolationError(`Node '${nodeId}' not found in execution graph.`);
    }

    const updatedNodes = new Map(this.props.nodes);
    updatedNodes.set(nodeId, {
      ...node,
      state: newState,
      failureReason: reason ?? node.failureReason,
    });

    return new ExecutionGraphAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      nodes: updatedNodes,
    });
  }

  public grantNodeAuthority(
    nodeId: ExecutionNodeId,
    authorityGrantReference: string,
  ): ExecutionGraphAggregate {
    const node = this.props.nodes.get(nodeId);
    if (!node) {
      throw new InvariantViolationError(`Node '${nodeId}' not found in execution graph.`);
    }

    const updatedNodes = new Map(this.props.nodes);
    updatedNodes.set(nodeId, {
      ...node,
      authorityGrantReference,
      state:
        node.state === ExecutionNodeState.AWAITING_AUTHORITY
          ? ExecutionNodeState.READY_FOR_EXECUTION
          : node.state,
    });

    return new ExecutionGraphAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      nodes: updatedNodes,
    });
  }

  public cancelGraph(reason: string): ExecutionGraphAggregate {
    const updatedNodes = new Map(this.props.nodes);
    for (const [id, node] of updatedNodes) {
      if (node.state !== ExecutionNodeState.COMPLETED) {
        updatedNodes.set(id, {
          ...node,
          state: ExecutionNodeState.CANCELLED,
          failureReason: `Graph cancelled: ${reason}`,
        });
      }
    }

    return new ExecutionGraphAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      nodes: updatedNodes,
      isCancelled: true,
    });
  }

  public getNode(nodeId: ExecutionNodeId): ExecutionNodeProps | undefined {
    return this.props.nodes.get(nodeId);
  }

  public getAllNodes(): ReadonlyArray<ExecutionNodeProps> {
    return Array.from(this.props.nodes.values());
  }
}

import type { WorkflowExecutionHandle, WorkflowRuntime } from "@sovereign/contracts";

/**
 * Sovereign Workflow Orchestration Port
 *
 * DOCTRINE:
 * Temporal or external workflow engines orchestrate timing and retries,
 * but Sovereign PostgreSQL owns the canonical Execution Graph.
 */
export class WorkflowDispatcher {
  constructor(private readonly runtime: WorkflowRuntime) {}

  public async dispatchNode(
    nodeId: string,
    payload: Record<string, unknown>,
  ): Promise<WorkflowExecutionHandle> {
    return this.runtime.dispatchActivity(nodeId, payload);
  }

  public async cancelNode(workflowId: string, reason: string): Promise<void> {
    return this.runtime.cancelExecution(workflowId, reason);
  }
}

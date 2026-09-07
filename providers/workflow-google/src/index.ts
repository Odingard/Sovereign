import type { WorkflowExecutionHandle, WorkflowRuntime } from "@sovereign/contracts";

/**
 * Google Cloud Workflows Adapter
 *
 * STATUS: RESEARCH / NOT APPROVED FOR PHI
 */
export class GoogleCloudWorkflowsRuntime implements WorkflowRuntime {
  public readonly runtimeName = "google-cloud-workflows";

  public async dispatchActivity(
    _nodeId: string,
    _payload: Record<string, unknown>,
  ): Promise<WorkflowExecutionHandle> {
    throw new Error("Google Cloud Workflows is in status RESEARCH / NOT APPROVED FOR PHI.");
  }

  public async pauseExecution(_workflowId: string, _reason: string): Promise<void> {
    throw new Error("Google Cloud Workflows is in status RESEARCH / NOT APPROVED FOR PHI.");
  }

  public async cancelExecution(_workflowId: string, _reason: string): Promise<void> {
    throw new Error("Google Cloud Workflows is in status RESEARCH / NOT APPROVED FOR PHI.");
  }
}

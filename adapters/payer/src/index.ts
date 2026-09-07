import { LifecycleState } from '@sovereign/domain';

export interface PriorAuthSubmissionRequest {
  patientId: string;
  payerId: string;
  ndcOrHcpcsCode: string;
  packetEvidenceHashes: string[];
}

export class MockPayerAdapter {
  public async submitPriorAuth(request: PriorAuthSubmissionRequest): Promise<{ externalReference: string; state: LifecycleState }> {
    return {
      externalReference: `PA-REF-${request.patientId.slice(0, 8)}`,
      state: LifecycleState.TRANSMITTED
    };
  }
}

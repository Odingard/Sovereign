import { LifecycleState } from "@sovereign/domain";

export interface InfusionScheduleRequest {
  patientId: string;
  drugCode: string;
  safetyCheckHash: string;
}

export class MockInfusionAdapter {
  public async scheduleInfusion(
    request: InfusionScheduleRequest,
  ): Promise<{ appointmentId: string; state: LifecycleState }> {
    return {
      appointmentId: `INF-APP-${request.patientId.slice(0, 8)}`,
      state: LifecycleState.ACCEPTED,
    };
  }
}

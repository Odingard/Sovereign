import { LifecycleState } from "@sovereign/domain";

export interface SpecialtyPrescriptionOrder {
  orderId: string;
  patientId: string;
  medicationName: string;
}

export class MockPharmacyAdapter {
  public async transmitPrescription(
    order: SpecialtyPrescriptionOrder,
  ): Promise<{ fulfillmentId: string; state: LifecycleState }> {
    return {
      fulfillmentId: `PHARM-FULFILL-${order.orderId}`,
      state: LifecycleState.TRANSMITTED,
    };
  }
}

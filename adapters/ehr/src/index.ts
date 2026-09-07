export interface EhrPatientRecordInput {
  externalEhrId: string;
  systemIdentifier: string;
}

export class MockEhrAdapter {
  public async fetchPatientContext(
    input: EhrPatientRecordInput,
  ): Promise<{ externalId: string; status: "SYNTHETIC_READY" }> {
    return {
      externalId: input.externalEhrId,
      status: "SYNTHETIC_READY",
    };
  }
}

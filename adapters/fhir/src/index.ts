/**
 * FHIR Transport Adapter
 *
 * DOCTRINE (ADR-0002):
 * FHIR is a wire transport format, NEVER the canonical clinical state.
 * Vendor formats terminate here and map to Sovereign domain models.
 */
export interface FhirBundleTransport {
  resourceType: 'Bundle';
  type: string;
  entry?: Array<{
    resource: Record<string, unknown>;
  }>;
}

export class FhirTransportAdapter {
  public parseTransportBundle(bundle: FhirBundleTransport): { rawCount: number } {
    return {
      rawCount: bundle.entry ? bundle.entry.length : 0
    };
  }
}

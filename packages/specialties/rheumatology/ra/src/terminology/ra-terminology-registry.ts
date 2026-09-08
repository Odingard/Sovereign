/**
 * @file RA Terminology Registry
 * @description Invariant: Stable typed Sovereign concepts with versioned external mappings.
 * External terminology updates do NOT mutate historical clinical assertion identity.
 */

export interface ExternalTerminologyCode {
  readonly system: "RXNORM" | "SNOMED_CT" | "LOINC" | "ICD10_CM";
  readonly code: string;
  readonly displayName: string;
}

export interface ConceptMappingRecord {
  readonly sovereignConcept: string;
  readonly externalCode: ExternalTerminologyCode;
  readonly mappingVersion: string;
  readonly clinicalReviewStatus: "REQUIRES_CLINICAL_VALIDATION" | "VALIDATED";
}

export class RaTerminologyRegistry {
  private readonly mappings = new Map<string, ConceptMappingRecord[]>();

  public registerMapping(record: ConceptMappingRecord): void {
    const existing = this.mappings.get(record.sovereignConcept) ?? [];
    existing.push(record);
    this.mappings.set(record.sovereignConcept, existing);
  }

  public getMappings(sovereignConcept: string): ReadonlyArray<ConceptMappingRecord> {
    return this.mappings.get(sovereignConcept) ?? [];
  }
}

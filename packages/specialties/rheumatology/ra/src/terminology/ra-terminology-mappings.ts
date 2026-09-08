/**
 * @file Baseline RA Terminology Mappings
 * @description Standard concept mappings to RxNorm, SNOMED CT, and LOINC.
 */

import { SOVEREIGN_RA_NAMESPACES } from "../concepts/ra-concept-namespaces.js";
import type { ConceptMappingRecord } from "./ra-terminology-registry.js";

export const BASELINE_RA_MAPPINGS: ReadonlyArray<ConceptMappingRecord> = [
  {
    sovereignConcept: `${SOVEREIGN_RA_NAMESPACES.CONDITION}:rheumatoid-arthritis`,
    externalCode: {
      system: "SNOMED_CT",
      code: "69896004",
      displayName: "Rheumatoid arthritis (disorder)",
    },
    mappingVersion: "1.0.0",
    clinicalReviewStatus: "REQUIRES_CLINICAL_VALIDATION",
  },
  {
    sovereignConcept: `${SOVEREIGN_RA_NAMESPACES.MEDICATION}:methotrexate`,
    externalCode: {
      system: "RXNORM",
      code: "6851",
      displayName: "Methotrexate",
    },
    mappingVersion: "1.0.0",
    clinicalReviewStatus: "REQUIRES_CLINICAL_VALIDATION",
  },
  {
    sovereignConcept: `${SOVEREIGN_RA_NAMESPACES.MEDICATION}:adalimumab`,
    externalCode: {
      system: "RXNORM",
      code: "32968",
      displayName: "Adalimumab",
    },
    mappingVersion: "1.0.0",
    clinicalReviewStatus: "REQUIRES_CLINICAL_VALIDATION",
  },
  {
    sovereignConcept: `${SOVEREIGN_RA_NAMESPACES.LABORATORY}:rheumatoid-factor-titer`,
    externalCode: {
      system: "LOINC",
      code: "11572-5",
      displayName: "Rheumatoid factor [Units/volume] in Serum",
    },
    mappingVersion: "1.0.0",
    clinicalReviewStatus: "REQUIRES_CLINICAL_VALIDATION",
  },
  {
    sovereignConcept: `${SOVEREIGN_RA_NAMESPACES.LABORATORY}:anti-ccp-titer`,
    externalCode: {
      system: "LOINC",
      code: "33935-8",
      displayName: "Cyclic citrullinated peptide Ab [Units/volume] in Serum",
    },
    mappingVersion: "1.0.0",
    clinicalReviewStatus: "REQUIRES_CLINICAL_VALIDATION",
  },
];

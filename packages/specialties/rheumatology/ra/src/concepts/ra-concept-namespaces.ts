/**
 * @file Sovereign Rheumatology Concept Namespaces
 * @description Domain identifiers for specialty concepts, decoupled from external ontologies.
 */

export const SOVEREIGN_RA_NAMESPACES = {
  CONDITION: "sovereign:specialty:rheumatology:ra:condition",
  MEDICATION: "sovereign:specialty:rheumatology:ra:medication",
  MEDICATION_CATEGORY: "sovereign:specialty:rheumatology:ra:medication-category",
  JOINT: "sovereign:specialty:rheumatology:ra:joint",
  LABORATORY: "sovereign:specialty:rheumatology:ra:lab",
  MANIFESTATION: "sovereign:specialty:rheumatology:ra:manifestation",
  OUTCOME: "sovereign:specialty:rheumatology:ra:outcome",
  DISCONTINUATION_REASON: "sovereign:specialty:rheumatology:ra:discontinuation-reason",
  MEASURE: "sovereign:specialty:rheumatology:ra:measure",
  ASSESSMENT: "sovereign:specialty:rheumatology:ra:assessment",
} as const;

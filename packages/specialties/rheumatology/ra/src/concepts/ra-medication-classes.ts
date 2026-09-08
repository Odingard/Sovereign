/**
 * @file RA Medication Classes & Categorization
 * @description Strongly typed categories for disease-modifying anti-rheumatic drugs (DMARDs) and adjunctive therapies.
 */

export enum RaMedicationCategory {
  CONVENTIONAL_SYNTHETIC_DMARD = "CONVENTIONAL_SYNTHETIC_DMARD", // MTX, HCQ, SSZ, Leflunomide
  BIOLOGIC_TNF_INHIBITOR = "BIOLOGIC_TNF_INHIBITOR", // Adalimumab, Etanercept, Infliximab, Golimumab, Certolizumab
  BIOLOGIC_IL6_INHIBITOR = "BIOLOGIC_IL6_INHIBITOR", // Tocilizumab, Sarilumab
  BIOLOGIC_T_CELL_CO_STIM = "BIOLOGIC_T_CELL_CO_STIM", // Abatacept
  BIOLOGIC_B_CELL_DEPLETION = "BIOLOGIC_B_CELL_DEPLETION", // Rituximab
  TARGETED_SYNTHETIC_JAK_INHIBITOR = "TARGETED_SYNTHETIC_JAK_INHIBITOR", // Tofacitinib, Upadacitinib, Baricitinib
  GLUCOCORTICOID = "GLUCOCORTICOID", // Prednisone, Methylprednisolone
  NSAID = "NSAID", // Meloxicam, Naproxen, Celecoxib
  OTHER_IMMUNOMODULATOR = "OTHER_IMMUNOMODULATOR", // Azathioprine, Cyclosporine, Cyclophosphamide
  UNKNOWN = "UNKNOWN",
}

export function isTargetedOrBiologicDmard(category: RaMedicationCategory): boolean {
  return (
    category === RaMedicationCategory.BIOLOGIC_TNF_INHIBITOR ||
    category === RaMedicationCategory.BIOLOGIC_IL6_INHIBITOR ||
    category === RaMedicationCategory.BIOLOGIC_T_CELL_CO_STIM ||
    category === RaMedicationCategory.BIOLOGIC_B_CELL_DEPLETION ||
    category === RaMedicationCategory.TARGETED_SYNTHETIC_JAK_INHIBITOR
  );
}

/**
 * @file Unidirectional RA Projection Builder
 * @description Invariants:
 * 1. Direction is strictly: ClinicalStateAggregate / ClinicalAssertion -> AdultRaClinicalProfile.
 * 2. AdultRaClinicalProfile is read-only and non-authoritative.
 * 3. Does NOT mutate the underlying aggregate.
 * 4. Serology phenotype is derived without silent data loss or premature reconciliation.
 */

import type { ClinicalAssertion, ClinicalStateAggregate } from "@sovereign/domain";
import { SOVEREIGN_RA_NAMESPACES } from "../concepts/ra-concept-namespaces.js";
import {
  AdultRaClinicalProfile,
  DerivedSerologyPhenotype,
  type DerivedSerologyPhenotypeResult,
} from "./adult-ra-clinical-profile.js";

export class AdultRaProjectionBuilder {
  public static buildFromAggregate(aggregate: ClinicalStateAggregate): AdultRaClinicalProfile {
    const assertions = aggregate.getAllAssertions();

    // Derive serology phenotype safely
    const derivedSerology = AdultRaProjectionBuilder.deriveSerologyPhenotype(assertions);

    return AdultRaClinicalProfile.create({
      stateId: aggregate.props.stateId,
      tenantId: aggregate.props.context.tenantId,
      patientId: aggregate.props.context.patientId,
      aggregateVersion: aggregate.props.aggregateVersion,
      derivedSerologyPhenotype: derivedSerology,
      therapyHistory: [],
      therapyOutcomes: [],
      therapyDiscontinuations: [],
      discontinuationReasons: [],
      activeHolds: [],
      jointCountObservations: [],
      diseaseActivityScores: [],
      articularManifestations: [],
      extraArticularManifestations: [],
      functionalAssessments: [],
      observedMonitoringFacts: [],
      unresolvedIssues: [],
    });
  }

  public static deriveSerologyPhenotype(
    assertions: ReadonlyArray<ClinicalAssertion>,
  ): DerivedSerologyPhenotypeResult {
    const rfAssertions = assertions.filter(
      (a) =>
        a.concept.code === `${SOVEREIGN_RA_NAMESPACES.LABORATORY}:rheumatoid-factor` ||
        a.concept.displayName.toLowerCase().includes("rheumatoid factor"),
    );
    const ccpAssertions = assertions.filter(
      (a) =>
        a.concept.code === `${SOVEREIGN_RA_NAMESPACES.LABORATORY}:anti-ccp` ||
        a.concept.displayName.toLowerCase().includes("cyclic citrullinated peptide") ||
        a.concept.displayName.toLowerCase().includes("anti-ccp"),
    );

    const latestRf = rfAssertions[rfAssertions.length - 1];
    const latestCcp = ccpAssertions[ccpAssertions.length - 1];

    if (!latestRf || !latestCcp) {
      return {
        phenotype: DerivedSerologyPhenotype.UNKNOWN_PHENOTYPE,
        rfAssertionId: latestRf?.assertionId,
        rfEvidenceId: latestRf?.supportingEvidenceIds[0],
        antiCcpAssertionId: latestCcp?.assertionId,
        antiCcpEvidenceId: latestCcp?.supportingEvidenceIds[0],
        explanation:
          "One or both essential serology tests (RF, anti-CCP) are missing from evidence. Invariant: Unknown is never negative.",
      };
    }

    const isRfPositive =
      latestRf.value.kind === "PRESENCE_ABSENCE"
        ? latestRf.value.isPresent
        : latestRf.value.kind === "TEXT" && latestRf.value.text.toUpperCase().includes("POS");

    const isCcpPositive =
      latestCcp.value.kind === "PRESENCE_ABSENCE"
        ? latestCcp.value.isPresent
        : latestCcp.value.kind === "TEXT" && latestCcp.value.text.toUpperCase().includes("POS");

    let phenotype: DerivedSerologyPhenotype;
    if (isRfPositive && isCcpPositive) {
      phenotype = DerivedSerologyPhenotype.SEROPOSITIVE_RF_AND_CCP;
    } else if (isRfPositive && !isCcpPositive) {
      phenotype = DerivedSerologyPhenotype.SEROPOSITIVE_RF_ONLY;
    } else if (!isRfPositive && isCcpPositive) {
      phenotype = DerivedSerologyPhenotype.SEROPOSITIVE_CCP_ONLY;
    } else {
      phenotype = DerivedSerologyPhenotype.SERONEGATIVE;
    }

    return {
      phenotype,
      rfAssertionId: latestRf.assertionId,
      rfEvidenceId: latestRf.supportingEvidenceIds[0],
      antiCcpAssertionId: latestCcp.assertionId,
      antiCcpEvidenceId: latestCcp.supportingEvidenceIds[0],
      explanation: `Derived from RF assertion (${latestRf.assertionId}) and anti-CCP assertion (${latestCcp.assertionId}).`,
    };
  }
}

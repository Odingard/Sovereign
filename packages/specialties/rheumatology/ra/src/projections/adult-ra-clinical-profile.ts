/**
 * @file Adult RA Clinical Profile (Read-Only / Rebuildable Projection)
 * @description Invariants:
 * 1. Strictly read-only, non-authoritative, and 100% rebuildable from canonical ClinicalStateAggregate.
 * 2. RA is NOT a sixth aggregate (ADR-0011).
 * 3. Serology phenotype is a derived projection only; missing data yields UNKNOWN_PHENOTYPE, never SERONEGATIVE.
 * 4. Operational TherapyAccessState is referenced by TherapyAccessCaseId only; never duplicated in Clinical State.
 */

import type { EvidenceId, TherapyAccessCaseId } from "@sovereign/domain";
import type { RaJointCountObservation } from "../disease-activity/ra-joint-counts.js";
import type { RaStandardizedMeasureRecord } from "../disease-activity/ra-structural-measures.js";
import type { RaFunctionalStatusAssertion } from "../functional/ra-functional-status.js";
import type { RaDiseaseIdentityAssertion } from "../identity/ra-disease-identity.js";
import type { RaArticularManifestationAssertion } from "../manifestations/ra-articular-manifestation.js";
import type { RaExtraArticularManifestationAssertion } from "../manifestations/ra-extra-articular-manifestation.js";
import type { RaObservedMonitoringFact } from "../safety-monitoring/ra-observed-monitoring-facts.js";
import type {
  RaTherapyDiscontinuationEvent,
  RaTherapyDiscontinuationReason,
} from "../therapy-history/ra-therapy-discontinuation.js";
import type { RaTherapyExposure } from "../therapy-history/ra-therapy-exposure.js";
import type { RaTherapyOutcomeAssertion } from "../therapy-history/ra-therapy-outcome.js";
import type { RaTreatmentInterruptionRecord } from "../current-treatment/ra-treatment-interruption.js";
import type { RaCurrentTreatmentRegimen } from "../current-treatment/ra-current-treatment-regimen.js";
import type { RaUnresolvedIssue } from "../unresolved/ra-unresolved-issue.js";

export enum DerivedSerologyPhenotype {
  SEROPOSITIVE_RF_AND_CCP = "SEROPOSITIVE_RF_AND_CCP",
  SEROPOSITIVE_RF_ONLY = "SEROPOSITIVE_RF_ONLY",
  SEROPOSITIVE_CCP_ONLY = "SEROPOSITIVE_CCP_ONLY",
  SERONEGATIVE = "SERONEGATIVE",
  CONFLICTED = "CONFLICTED",
  UNKNOWN_PHENOTYPE = "UNKNOWN_PHENOTYPE",
}

export interface DerivedSerologyPhenotypeResult {
  readonly phenotype: DerivedSerologyPhenotype;
  readonly rfAssertionId?: string;
  readonly rfEvidenceId?: EvidenceId;
  readonly antiCcpAssertionId?: string;
  readonly antiCcpEvidenceId?: EvidenceId;
  readonly explanation: string;
}

export interface AdultRaClinicalProfileProps {
  readonly stateId: string;
  readonly tenantId: string;
  readonly patientId: string;
  readonly aggregateVersion: number;
  readonly diseaseIdentity?: RaDiseaseIdentityAssertion;
  readonly derivedSerologyPhenotype: DerivedSerologyPhenotypeResult;
  readonly therapyHistory: ReadonlyArray<RaTherapyExposure>;
  readonly therapyOutcomes: ReadonlyArray<RaTherapyOutcomeAssertion>;
  readonly therapyDiscontinuations: ReadonlyArray<RaTherapyDiscontinuationEvent>;
  readonly discontinuationReasons: ReadonlyArray<RaTherapyDiscontinuationReason>;
  readonly currentRegimen?: RaCurrentTreatmentRegimen;
  readonly activeHolds: ReadonlyArray<RaTreatmentInterruptionRecord>;
  readonly jointCountObservations: ReadonlyArray<RaJointCountObservation>;
  readonly diseaseActivityScores: ReadonlyArray<RaStandardizedMeasureRecord>;
  readonly articularManifestations: ReadonlyArray<RaArticularManifestationAssertion>;
  readonly extraArticularManifestations: ReadonlyArray<RaExtraArticularManifestationAssertion>;
  readonly functionalAssessments: ReadonlyArray<RaFunctionalStatusAssertion>;
  readonly observedMonitoringFacts: ReadonlyArray<RaObservedMonitoringFact>;
  readonly unresolvedIssues: ReadonlyArray<RaUnresolvedIssue>;
  readonly therapyAccessCaseId?: TherapyAccessCaseId; // Reference to operational aggregate only
}

export class AdultRaClinicalProfile {
  private constructor(public readonly props: AdultRaClinicalProfileProps) {}

  public static create(props: AdultRaClinicalProfileProps): AdultRaClinicalProfile {
    return new AdultRaClinicalProfile(props);
  }

  public get stateId(): string {
    return this.props.stateId;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get patientId(): string {
    return this.props.patientId;
  }

  public get diseaseIdentity(): RaDiseaseIdentityAssertion | undefined {
    return this.props.diseaseIdentity;
  }

  public get derivedSerologyPhenotype(): DerivedSerologyPhenotypeResult {
    return this.props.derivedSerologyPhenotype;
  }

  public get therapyHistory(): ReadonlyArray<RaTherapyExposure> {
    return this.props.therapyHistory;
  }

  public get therapyOutcomes(): ReadonlyArray<RaTherapyOutcomeAssertion> {
    return this.props.therapyOutcomes;
  }

  public get currentRegimen(): RaCurrentTreatmentRegimen | undefined {
    return this.props.currentRegimen;
  }

  public get unresolvedIssues(): ReadonlyArray<RaUnresolvedIssue> {
    return this.props.unresolvedIssues;
  }
}

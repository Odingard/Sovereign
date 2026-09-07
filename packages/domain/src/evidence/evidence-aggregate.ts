/**
 * @file Clinical Evidence Aggregate Root
 * @description Invariant: The source artifact is immutable. Assessments are versioned/append-only.
 * Distinguishes aggregateVersion from schemaVersion.
 */

import type { SecurityClassificationMetadata } from "../common/data-classification.js";
import { InvariantViolationError } from "../common/domain-error.js";
import type { EpistemicStatus } from "../common/epistemic-status.js";
import type { ActorId, EvidenceId, TenantPatientContext } from "../common/identifiers.js";
import type { ProvenanceTemporalContext } from "../common/temporal-window.js";
import type { VersionedAggregateIdentity } from "../common/versioning.js";
import type { EvidenceAssessment } from "./evidence-assessment.js";
import type { SourceProvenanceLocator } from "./source-provenance.js";

export interface ClinicalEvidenceProps extends VersionedAggregateIdentity {
  readonly evidenceId: EvidenceId;
  readonly context: TenantPatientContext;
  readonly provenance: SourceProvenanceLocator;
  readonly temporal: ProvenanceTemporalContext;
  readonly classification: SecurityClassificationMetadata;
  readonly assessments: ReadonlyArray<EvidenceAssessment>;
}

export class ClinicalEvidenceAggregate {
  private constructor(public readonly props: ClinicalEvidenceProps) {}

  public static create(
    evidenceId: EvidenceId,
    context: TenantPatientContext,
    provenance: SourceProvenanceLocator,
    temporal: ProvenanceTemporalContext,
    classification: SecurityClassificationMetadata,
    initialAssessment?: EvidenceAssessment,
    schemaVersion = 1,
  ): ClinicalEvidenceAggregate {
    if (!provenance.contentSha256 || provenance.contentSha256.length !== 64) {
      throw new InvariantViolationError(
        "Evidence requires a valid 64-character SHA-256 content hash.",
      );
    }
    if (!provenance.sourceLocator || provenance.sourceLocator.trim().length === 0) {
      throw new InvariantViolationError("Evidence requires an attributable source locator.");
    }

    const assessments = initialAssessment ? [initialAssessment] : [];

    return new ClinicalEvidenceAggregate({
      evidenceId,
      context,
      provenance,
      temporal,
      classification,
      assessments,
      aggregateVersion: 1,
      schemaVersion,
    });
  }

  public static reconstitute(props: ClinicalEvidenceProps): ClinicalEvidenceAggregate {
    return new ClinicalEvidenceAggregate(props);
  }

  public appendAssessment(
    actorId: ActorId,
    epistemicStatus: EpistemicStatus,
    clinicalInterpretationSummary: string,
    confidenceScore?: number,
  ): ClinicalEvidenceAggregate {
    if (!clinicalInterpretationSummary || clinicalInterpretationSummary.trim().length === 0) {
      throw new InvariantViolationError("Assessment requires clinical interpretation summary.");
    }

    const newAssessment: EvidenceAssessment = {
      assessmentId: `ASM-${this.props.evidenceId}-${this.props.assessments.length + 1}`,
      assessmentVersion: this.props.assessments.length + 1,
      evaluatedByActorId: actorId,
      evaluatedAt: new Date(),
      epistemicStatus,
      clinicalInterpretationSummary,
      confidenceScore,
    };

    return new ClinicalEvidenceAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      assessments: [...this.props.assessments, newAssessment],
    });
  }

  public get latestAssessment(): EvidenceAssessment | undefined {
    return this.props.assessments[this.props.assessments.length - 1];
  }
}

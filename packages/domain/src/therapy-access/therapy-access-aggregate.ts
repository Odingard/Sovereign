/**
 * @file Generic Therapy Access State Aggregate Root
 * @description Represents "where a therapy objective currently stands operationally".
 * Invariants:
 * 1. Generic operational lifecycle machinery without prematurely locking rheumatology milestones (deferred to WO-013).
 * 2. Case is traceable to clinical intent and execution graphs.
 * 3. Separate aggregateVersion from schemaVersion.
 */

import { InvariantViolationError } from "../common/domain-error.js";
import type {
  EvidenceId,
  ExecutionGraphId,
  IntentId,
  TenantPatientContext,
  TherapyAccessCaseId,
} from "../common/identifiers.js";
import type { ProvenanceTemporalContext } from "../common/temporal-window.js";
import type { VersionedAggregateIdentity } from "../common/versioning.js";

export enum GenericTherapyAccessStage {
  CASE_INITIATED = "CASE_INITIATED",
  ACCESS_PREREQUISITES_IN_PROGRESS = "ACCESS_PREREQUISITES_IN_PROGRESS",
  ACCESS_AUTHORIZED = "ACCESS_AUTHORIZED",
  FULFILLMENT_IN_PROGRESS = "FULFILLMENT_IN_PROGRESS",
  THERAPY_ACTIVE = "THERAPY_ACTIVE",
  THERAPY_ON_HOLD = "THERAPY_ON_HOLD",
  CASE_CLOSED = "CASE_CLOSED",
}

export interface TherapyAccessCaseProps extends VersionedAggregateIdentity {
  readonly caseId: TherapyAccessCaseId;
  readonly context: TenantPatientContext;
  readonly associatedIntentIds: ReadonlyArray<IntentId>;
  readonly associatedGraphIds: ReadonlyArray<ExecutionGraphId>;
  readonly stage: GenericTherapyAccessStage;
  readonly temporal: ProvenanceTemporalContext;
  readonly verifiedMilestoneEvidenceIds: ReadonlyArray<EvidenceId>;
  readonly closureReason?: string;
}

export class TherapyAccessStateAggregate {
  private constructor(public readonly props: TherapyAccessCaseProps) {}

  public static create(
    caseId: TherapyAccessCaseId,
    context: TenantPatientContext,
    associatedIntentIds: ReadonlyArray<IntentId>,
    temporal: ProvenanceTemporalContext,
    associatedGraphIds: ReadonlyArray<ExecutionGraphId> = [],
    schemaVersion = 1,
  ): TherapyAccessStateAggregate {
    if (!associatedIntentIds || associatedIntentIds.length === 0) {
      throw new InvariantViolationError(
        "Therapy access case must be linked to at least one valid clinical intent.",
      );
    }

    return new TherapyAccessStateAggregate({
      caseId,
      context,
      associatedIntentIds,
      associatedGraphIds,
      stage: GenericTherapyAccessStage.CASE_INITIATED,
      temporal,
      verifiedMilestoneEvidenceIds: [],
      aggregateVersion: 1,
      schemaVersion,
    });
  }

  public static reconstitute(props: TherapyAccessCaseProps): TherapyAccessStateAggregate {
    return new TherapyAccessStateAggregate(props);
  }

  public advanceStage(
    newStage: GenericTherapyAccessStage,
    verifyingEvidenceId?: EvidenceId,
  ): TherapyAccessStateAggregate {
    const updatedEvidence = verifyingEvidenceId
      ? [...this.props.verifiedMilestoneEvidenceIds, verifyingEvidenceId]
      : this.props.verifiedMilestoneEvidenceIds;

    return new TherapyAccessStateAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      stage: newStage,
      verifiedMilestoneEvidenceIds: updatedEvidence,
    });
  }

  public linkExecutionGraph(graphId: ExecutionGraphId): TherapyAccessStateAggregate {
    if (this.props.associatedGraphIds.includes(graphId)) {
      return this;
    }

    return new TherapyAccessStateAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      associatedGraphIds: [...this.props.associatedGraphIds, graphId],
    });
  }

  public closeCase(reason: string, finalEvidenceId?: EvidenceId): TherapyAccessStateAggregate {
    const updatedEvidence = finalEvidenceId
      ? [...this.props.verifiedMilestoneEvidenceIds, finalEvidenceId]
      : this.props.verifiedMilestoneEvidenceIds;

    return new TherapyAccessStateAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      stage: GenericTherapyAccessStage.CASE_CLOSED,
      closureReason: reason,
      verifiedMilestoneEvidenceIds: updatedEvidence,
    });
  }
}

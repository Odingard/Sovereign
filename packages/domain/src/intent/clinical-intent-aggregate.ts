/**
 * @file Clinical Intent Aggregate Root
 * @description Represents "what the clinician decided".
 * Invariants:
 * 1. Discussion is not decision; recommendation is not an order.
 * 2. 12 distinct non-collapsible lifecycle stages.
 * 3. Generic extensible action concepts (medication and non-medication).
 * 4. Supersession preserves lineage; does not erase history.
 */

import type { AuthorityClass } from "../common/authority-class.js";
import { InvariantViolationError } from "../common/domain-error.js";
import type { ActorId, EvidenceId, IntentId, TenantPatientContext } from "../common/identifiers.js";
import type { ProvenanceTemporalContext } from "../common/temporal-window.js";
import type { VersionedAggregateIdentity } from "../common/versioning.js";
import type { ExtensibleActionConcept } from "./intent-action.js";
import { ClinicalIntentStage, isAllowedIntentTransition } from "./intent-lifecycle.js";

export interface ClinicalIntentProps extends VersionedAggregateIdentity {
  readonly intentId: IntentId;
  readonly context: TenantPatientContext;
  readonly stage: ClinicalIntentStage;
  readonly actionConcept: ExtensibleActionConcept;
  readonly temporal: ProvenanceTemporalContext;
  readonly clinicianActorId: ActorId;
  readonly authorityClass: AuthorityClass;
  readonly authorityReference?: string;
  readonly rationaleNarrative?: string;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
  readonly supersededByIntentId?: IntentId;
  readonly supersedesIntentId?: IntentId;
}

export class ClinicalIntentAggregate {
  private constructor(public readonly props: ClinicalIntentProps) {}

  public static create(
    intentId: IntentId,
    context: TenantPatientContext,
    stage: ClinicalIntentStage,
    actionConcept: ExtensibleActionConcept,
    temporal: ProvenanceTemporalContext,
    clinicianActorId: ActorId,
    authorityClass: AuthorityClass,
    supportingEvidenceIds: ReadonlyArray<EvidenceId>,
    authorityReference?: string,
    rationaleNarrative?: string,
    schemaVersion = 1,
  ): ClinicalIntentAggregate {
    return new ClinicalIntentAggregate({
      intentId,
      context,
      stage,
      actionConcept,
      temporal,
      clinicianActorId,
      authorityClass,
      authorityReference,
      rationaleNarrative,
      supportingEvidenceIds,
      aggregateVersion: 1,
      schemaVersion,
    });
  }

  public static reconstitute(props: ClinicalIntentProps): ClinicalIntentAggregate {
    return new ClinicalIntentAggregate(props);
  }

  public transitionStage(
    newStage: ClinicalIntentStage,
    actorId: ActorId,
    authorityReference?: string,
  ): ClinicalIntentAggregate {
    if (!isAllowedIntentTransition(this.props.stage, newStage)) {
      throw new InvariantViolationError(
        `Invalid intent transition: Cannot transition from stage '${this.props.stage}' to '${newStage}'.`,
      );
    }

    return new ClinicalIntentAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      stage: newStage,
      clinicianActorId: actorId,
      authorityReference: authorityReference || this.props.authorityReference,
    });
  }

  public supersede(
    newIntentId: IntentId,
    actorId: ActorId,
    supersessionTimestamp = new Date(),
  ): ClinicalIntentAggregate {
    if (this.props.stage === ClinicalIntentStage.SUPERSEDED) {
      throw new InvariantViolationError(`Intent '${this.props.intentId}' is already superseded.`);
    }

    return new ClinicalIntentAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      stage: ClinicalIntentStage.SUPERSEDED,
      supersededByIntentId: newIntentId,
      clinicianActorId: actorId,
      temporal: {
        ...this.props.temporal,
        supersessionTime: supersessionTimestamp,
      },
    });
  }

  public isExecutable(): boolean {
    return (
      this.props.stage === ClinicalIntentStage.AUTHORIZED ||
      this.props.stage === ClinicalIntentStage.ORDERED
    );
  }
}

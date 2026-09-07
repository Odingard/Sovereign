/**
 * @file Clinical State Aggregate Root
 * @description Represents "what is clinically true or believed true".
 * Invariants:
 * 1. Monotonically versioned.
 * 2. Unknown is never negative.
 * 3. Every assertion must reference valid supporting evidence.
 * 4. Separate aggregateVersion from schemaVersion.
 */

import { InvariantViolationError } from "../common/domain-error.js";
import { EpistemicStatus } from "../common/epistemic-status.js";
import type { ClinicalStateId, TenantPatientContext } from "../common/identifiers.js";
import type { VersionedAggregateIdentity } from "../common/versioning.js";
import type { ClinicalAssertion } from "./clinical-assertion.js";

export interface ClinicalStateProps extends VersionedAggregateIdentity {
  readonly stateId: ClinicalStateId;
  readonly context: TenantPatientContext;
  readonly assertions: ReadonlyMap<string, ClinicalAssertion>;
  readonly lastEvaluatedAt: Date;
}

export class ClinicalStateAggregate {
  private constructor(public readonly props: ClinicalStateProps) {}

  public static create(
    stateId: ClinicalStateId,
    context: TenantPatientContext,
    schemaVersion = 1,
  ): ClinicalStateAggregate {
    return new ClinicalStateAggregate({
      stateId,
      context,
      assertions: new Map<string, ClinicalAssertion>(),
      lastEvaluatedAt: new Date(),
      aggregateVersion: 1,
      schemaVersion,
    });
  }

  public static reconstitute(props: ClinicalStateProps): ClinicalStateAggregate {
    return new ClinicalStateAggregate(props);
  }

  public getAssertion(assertionId: string): ClinicalAssertion | undefined {
    return this.props.assertions.get(assertionId);
  }

  public appendAssertion(assertion: ClinicalAssertion): ClinicalStateAggregate {
    // Invariant: Must reference supporting evidence
    if (!assertion.supportingEvidenceIds || assertion.supportingEvidenceIds.length === 0) {
      throw new InvariantViolationError(
        `Assertion '${assertion.assertionId}' lacks supporting evidence. Every clinical assertion must link to evidence.`,
      );
    }

    // Invariant: Unknown cannot be asserted as a confirmed negative finding
    if (
      assertion.validity.status === EpistemicStatus.UNKNOWN &&
      assertion.value.kind === "PRESENCE_ABSENCE" &&
      !assertion.value.isPresent
    ) {
      throw new InvariantViolationError(
        "Epistemic violation: Cannot assert negative presence when status is UNKNOWN.",
      );
    }

    const updatedAssertions = new Map(this.props.assertions);
    updatedAssertions.set(assertion.assertionId, assertion);

    return new ClinicalStateAggregate({
      ...this.props,
      aggregateVersion: this.props.aggregateVersion + 1,
      assertions: updatedAssertions,
      lastEvaluatedAt: new Date(),
    });
  }

  public getAllAssertions(): ReadonlyArray<ClinicalAssertion> {
    return Array.from(this.props.assertions.values());
  }
}

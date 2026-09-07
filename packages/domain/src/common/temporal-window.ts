/**
 * @file Clinical Temporal Model with Uncertainty Support
 * @description Supports exact, partial, interval-based, approximate, and unknown temporal clinical concepts.
 * DOCTRINE: Never manufacture artificial temporal precision.
 */

export enum TemporalPrecision {
  EXACT = "EXACT",
  DATE_ONLY = "DATE_ONLY",
  MONTH_ONLY = "MONTH_ONLY",
  YEAR_ONLY = "YEAR_ONLY",
  INTERVAL = "INTERVAL",
  APPROXIMATE = "APPROXIMATE",
  UNKNOWN = "UNKNOWN",
}

export interface ExactTime {
  readonly precision: TemporalPrecision.EXACT;
  readonly timestamp: Date;
}

export interface DateOnlyTime {
  readonly precision: TemporalPrecision.DATE_ONLY;
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number; // 1-31
}

export interface MonthOnlyTime {
  readonly precision: TemporalPrecision.MONTH_ONLY;
  readonly year: number;
  readonly month: number; // 1-12
}

export interface YearOnlyTime {
  readonly precision: TemporalPrecision.YEAR_ONLY;
  readonly year: number;
}

export interface IntervalTime {
  readonly precision: TemporalPrecision.INTERVAL;
  readonly start?: ClinicalTime;
  readonly end?: ClinicalTime;
}

export interface ApproximateTime {
  readonly precision: TemporalPrecision.APPROXIMATE;
  readonly approximateDescription: string;
  readonly lowerBound?: Date;
  readonly upperBound?: Date;
}

export interface UnknownTime {
  readonly precision: TemporalPrecision.UNKNOWN;
  readonly reason?: string;
}

export type ClinicalTime =
  | ExactTime
  | DateOnlyTime
  | MonthOnlyTime
  | YearOnlyTime
  | IntervalTime
  | ApproximateTime
  | UnknownTime;

/**
 * Multi-dimensional temporal context preserving:
 * 1. effective clinical time (when the phenomenon occurred)
 * 2. source-recorded time (when the EHR recorded it)
 * 3. Sovereign ingestion time (when Sovereign indexed it)
 * 4. supersession time (when superseded, if applicable)
 */
export interface ProvenanceTemporalContext {
  readonly effectiveClinicalTime: ClinicalTime;
  readonly sourceRecordedTime: ClinicalTime;
  readonly sovereignIngestionTime: Date; // Always exact system clock
  readonly supersessionTime?: Date;
}

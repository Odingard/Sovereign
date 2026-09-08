/**
 * @file 100% Synthetic Rheumatoid Arthritis Evaluation Corpus (Cases RA-SYN-01 to RA-SYN-15)
 * @description Invariant: Strictly synthetic identifiers and invented clinical facts. Zero real PHI.
 * Cleansed of unapproved clinical interpretations per Founder Pre-Implementation Amendments.
 */

export interface SyntheticRaCaseFixture {
  readonly caseId: string;
  readonly patientId: string;
  readonly tenantId: string;
  readonly isSynthetic: true;
  readonly title: string;
  readonly clinicalScenario: string;
  readonly clinicalFacts: {
    readonly diagnosisCertainty:
      | "CONFIRMED"
      | "PROVISIONAL"
      | "DIFFERENTIAL"
      | "RULED_OUT"
      | "UNKNOWN";
    readonly serologyFindings: ReadonlyArray<{
      readonly testName: string;
      readonly result: "POSITIVE" | "NEGATIVE" | "UNKNOWN";
      readonly dateDescription: string;
    }>;
    readonly therapyExposures: ReadonlyArray<{
      readonly medication: string;
      readonly lifecycleStatus: "ACTIVE" | "INACTIVE" | "HELD" | "DISCONTINUED" | "UNKNOWN";
      readonly discontinuationReason?: string;
    }>;
    readonly diseaseActivityObservations?: {
      readonly tjc28?: number;
      readonly sjc28?: number;
      readonly ptga?: number;
      readonly phga?: number;
      readonly expectedCalculable: boolean;
      readonly scoreExplanation: string;
    };
  };
}

export const SYNTHETIC_RA_EVALUATION_CORPUS: ReadonlyArray<SyntheticRaCaseFixture> = [
  {
    caseId: "RA-SYN-01",
    patientId: "PAT-SYN-RA-01",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Established RA on Stable Current Regimen",
    clinicalScenario:
      "54yo synthetic patient with 8-year history of seropositive RA on subcutaneous MTX 20mg/wk and adalimumab 40mg q2wks. Low disease activity score without unreviewed categorical interpretation.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [
        { testName: "Rheumatoid Factor", result: "POSITIVE", dateDescription: "2018-03-12" },
        { testName: "Anti-CCP", result: "POSITIVE", dateDescription: "2018-03-12" },
      ],
      therapyExposures: [
        { medication: "Methotrexate", lifecycleStatus: "ACTIVE" },
        { medication: "Adalimumab", lifecycleStatus: "ACTIVE" },
      ],
      diseaseActivityObservations: {
        tjc28: 2,
        sjc28: 1,
        ptga: 1.0,
        phga: 1.0,
        expectedCalculable: true,
        scoreExplanation:
          "All 4 components present; CDAI formula execution not activated (CALCULATION_NOT_ACTIVATED) pending clinical approval. Categorical interpretation withheld.",
      },
    },
  },
  {
    caseId: "RA-SYN-02",
    patientId: "PAT-SYN-RA-02",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Longitudinal Multi-Line DMARD Exposure",
    clinicalScenario:
      "62yo synthetic patient failing third line. Past exposures: MTX (inadequate response), etanercept (secondary loss of response), tofacitinib (intolerance - zoster). Active synovitis.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [
        { testName: "Rheumatoid Factor", result: "POSITIVE", dateDescription: "2016-05-20" },
        { testName: "Anti-CCP", result: "POSITIVE", dateDescription: "2016-05-20" },
      ],
      therapyExposures: [
        {
          medication: "Methotrexate",
          lifecycleStatus: "DISCONTINUED",
          discontinuationReason: "INADEQUATE_RESPONSE",
        },
        {
          medication: "Etanercept",
          lifecycleStatus: "DISCONTINUED",
          discontinuationReason: "INADEQUATE_RESPONSE",
        },
        {
          medication: "Tofacitinib",
          lifecycleStatus: "DISCONTINUED",
          discontinuationReason: "ADVERSE_EVENT_OR_INTOLERANCE",
        },
      ],
      diseaseActivityObservations: {
        tjc28: 12,
        sjc28: 9,
        ptga: 7.5,
        phga: 7.0,
        expectedCalculable: true,
        scoreExplanation:
          "All 4 components present; CDAI formula execution not activated (CALCULATION_NOT_ACTIVATED) pending clinical approval. Categorical interpretation withheld.",
      },
    },
  },
  {
    caseId: "RA-SYN-03",
    patientId: "PAT-SYN-RA-03",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Incomplete Historical Therapy Information",
    clinicalScenario:
      "New patient transfer note: 'took some gold or pills in the 1990s and had an injection biologic 5 years ago, name forgotten.' Preserves UNKNOWN concept and approximate timing.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [
        { testName: "Rheumatoid Factor", result: "POSITIVE", dateDescription: "2019-10-10" },
      ],
      therapyExposures: [
        {
          medication: "UNKNOWN_MEDICATION",
          lifecycleStatus: "DISCONTINUED",
          discontinuationReason: "UNKNOWN_REASON",
        },
      ],
    },
  },
  {
    caseId: "RA-SYN-04",
    patientId: "PAT-SYN-RA-04",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Conflicting Therapy Discontinuation Reasons",
    clinicalScenario:
      "Consult note documents infliximab stopped for lack of efficacy; progress note documents stopped due to acute infusion reaction. Both assertions preserved as CONFLICTED.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [
        { testName: "Rheumatoid Factor", result: "POSITIVE", dateDescription: "2020-01-15" },
      ],
      therapyExposures: [
        {
          medication: "Infliximab",
          lifecycleStatus: "DISCONTINUED",
          discontinuationReason: "CONFLICTED",
        },
      ],
    },
  },
  {
    caseId: "RA-SYN-05",
    patientId: "PAT-SYN-RA-05",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Approximate Historical Therapy Dates",
    clinicalScenario:
      "Patient history states 'methotrexate stopped around 2022.' Stored as APPROXIMATE without manufacturing an exact timestamp.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [
        { testName: "Anti-CCP", result: "POSITIVE", dateDescription: "2021-04-10" },
      ],
      therapyExposures: [
        {
          medication: "Methotrexate",
          lifecycleStatus: "DISCONTINUED",
          discontinuationReason: "UNKNOWN_REASON",
        },
      ],
    },
  },
  {
    caseId: "RA-SYN-06",
    patientId: "PAT-SYN-RA-06",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Structured EHR List Contradicted by Narrative",
    clinicalScenario:
      "Structured list states 'Sulfasalazine 1000mg BID - Active'. Narrative states patient stopped 3 months ago due to severe nausea. Captured as CONFLICTED.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [],
      therapyExposures: [
        {
          medication: "Sulfasalazine",
          lifecycleStatus: "UNKNOWN",
          discontinuationReason: "ADVERSE_EVENT_OR_INTOLERANCE",
        },
      ],
    },
  },
  {
    caseId: "RA-SYN-07",
    patientId: "PAT-SYN-RA-07",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Disease Activity with Missing Components (NOT_CALCULABLE)",
    clinicalScenario:
      "Visit records TJC28 = 6, SJC28 = 4, PhGA = 3.0, but PtGA was omitted. System outputs explicit NOT_CALCULABLE without imputing default value.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [],
      therapyExposures: [],
      diseaseActivityObservations: {
        tjc28: 6,
        sjc28: 4,
        phga: 3.0,
        expectedCalculable: false,
        scoreExplanation: "Missing PATIENT_GLOBAL_PTGA produces explicit NOT_CALCULABLE state.",
      },
    },
  },
  {
    caseId: "RA-SYN-08",
    patientId: "PAT-SYN-RA-08",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Conflicting Joint Count Evidence (Exam vs Ultrasound)",
    clinicalScenario:
      "Morning exam documents SJC28 = 2; afternoon ultrasound documents moderate-to-severe synovitis in 8 joints. Both recorded with distinct observer metadata.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [],
      therapyExposures: [],
    },
  },
  {
    caseId: "RA-SYN-09",
    patientId: "PAT-SYN-RA-09",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Uncertain Historical Diagnosis Information",
    clinicalScenario:
      "Referral diagnosis is 'Undifferentiated Inflammatory Polyarthritis vs Seronegative RA'. Diagnosis identity is PROVISIONAL with status REQUIRES_CLINICAL_DECISION.",
    clinicalFacts: {
      diagnosisCertainty: "PROVISIONAL",
      serologyFindings: [],
      therapyExposures: [],
    },
  },
  {
    caseId: "RA-SYN-10",
    patientId: "PAT-SYN-RA-10",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Current Therapy Interruption / Hold",
    clinicalScenario:
      "Patient on upadacitinib 15mg daily; medication temporarily held for 14 days due to acute bacterial bronchitis. Status marked HELD with reason ACUTE_INFECTION.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [],
      therapyExposures: [{ medication: "Upadacitinib", lifecycleStatus: "HELD" }],
    },
  },
  {
    caseId: "RA-SYN-11",
    patientId: "PAT-SYN-RA-11",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Therapy Switch Under Consideration (State vs Intent Boundary)",
    clinicalScenario:
      "Note states 'Considering switch from adalimumab to rituximab or abatacept.' Clinical State records current adalimumab; Clinical Intent records CONSIDERED. State is not mutated.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [],
      therapyExposures: [{ medication: "Adalimumab", lifecycleStatus: "ACTIVE" }],
    },
  },
  {
    caseId: "RA-SYN-12",
    patientId: "PAT-SYN-RA-12",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Decided Therapy Change (State vs Intent Separation)",
    clinicalScenario:
      "Clinician signs order for rituximab infusion. Clinical Intent reaches ORDERED. Clinical State retains adalimumab as historical and does not assert rituximab exposure without administration evidence.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [],
      therapyExposures: [{ medication: "Adalimumab", lifecycleStatus: "INACTIVE" }],
    },
  },
  {
    caseId: "RA-SYN-13",
    patientId: "PAT-SYN-RA-13",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Access Delay (State vs Therapy Access Boundary)",
    clinicalScenario:
      "Payer denies prior authorization for sarilumab; appeal submitted. TherapyAccessState tracks PA denial. Clinical State reflects active symptoms and NO_ACTIVE_DMARD.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [],
      therapyExposures: [],
    },
  },
  {
    caseId: "RA-SYN-14",
    patientId: "PAT-SYN-RA-14",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Temporal Serology Progression & Coexistence of Observations",
    clinicalScenario:
      "Patient documented with negative RF and negative anti-CCP in 2019. In 2024, new high-titer anti-CCP (>250 U/mL) is imported. Both observations coexist; derived phenotype updates without deleting 2019 test.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [
        { testName: "Anti-CCP", result: "NEGATIVE", dateDescription: "2019-02-14" },
        { testName: "Anti-CCP", result: "POSITIVE", dateDescription: "2024-06-18" },
      ],
      therapyExposures: [],
    },
  },
  {
    caseId: "RA-SYN-15",
    patientId: "PAT-SYN-RA-15",
    tenantId: "TEN-SYN-RHEUM-01",
    isSynthetic: true,
    title: "Correction of Prior Assertion Preserving History",
    clinicalScenario:
      "Prior note asserted 'Etanercept stopped due to hepatotoxicity'. Corrected note clarifies hepatotoxicity was caused by leflunomide; etanercept was never taken. Supersession preserves audit history.",
    clinicalFacts: {
      diagnosisCertainty: "CONFIRMED",
      serologyFindings: [],
      therapyExposures: [
        {
          medication: "Leflunomide",
          lifecycleStatus: "DISCONTINUED",
          discontinuationReason: "ADVERSE_EVENT_OR_INTOLERANCE",
        },
      ],
    },
  },
];

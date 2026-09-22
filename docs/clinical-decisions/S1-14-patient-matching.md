# Clinical Decision Request — S1-14 Patient Matching

**For:** Mark (Clinical reviewer)
**From:** Andre Byrd (Founder), WO-002B/S1-14
**Status:** ANSWERED 2026-09-22 — all four blocking questions decided. S1-14 is unblocked. Questions 5, 6 and 7 remain open but are configuration and do not block.
**Raised:** 2026-09-22

Nothing else in S1-14 is clinical. Everything below is; nothing here should be
guessed at by an engineer or an agent (AGENTS.md doctrine 14).

Stage 1 matching is **deterministic only** — no probabilistic or fuzzy matching, no
machine learning, no scoring thresholds (spec §7.2). These questions are about what
the deterministic rules should be.

---

## Blocking — S1-14 cannot ship without these

### 1. Uncertain match, not auto-link

Proposed: an exact match on normalised **name + date of birth + sex**, where the MRN
does not match, creates a patient flagged `uncertain` and opens a reconciliation item.
It does **not** silently link to the existing record.

> **DECIDED 2026-09-22 (Mark, via Founder): flag them.** An exact name + DOB + sex
> match with a differing MRN creates an `uncertain` patient and a reconciliation item.
> It never auto-links.

Consequence if we get it wrong in the permissive direction: two people's clinical
records merge silently. That is the failure mode with no safe recovery.

### 2. What may attach to an uncertain patient

Proposed: demographics only. **No clinical facts. No pre-visit brief.**

> **DECIDED 2026-09-22 (Mark, via Founder): render with a warning banner.**
>
> The brief renders for an uncertain patient, carrying a visible warning that the
> patient's identity is unconfirmed. It is not suppressed.
>
> Also decided: only `clinician` and `practice_manager` may view or act on an
> uncertain patient.
>
> **Residual risk, accepted.** The argument against a banner is that a clinician
> between patients reads the content and not the warning. The decision is Mark's and
> it is the right kind of call for a clinician to make — an empty screen gives no path
> forward and invites a workaround. Implementation obligation that follows: the
> warning must be structurally unskippable rather than decorative — it belongs in the
> content flow, not as a dismissible chrome element, and the uncertain state must be
> visible on every screen showing that patient, not only on entry. Recorded here so
> the obligation travels with the decision.
>
> Clinical facts still do not attach to an uncertain patient (spec §7.2). The banner
> governs what is shown, not what is stored.

### 3. Who may merge

Proposed: merge requires capability `patient:reconcile`, a **mandatory free-text
reason**, and both records are retained (`merged_into`, nothing deleted). AI can never
merge (AGENTS.md doctrine 9).

> **DECIDED 2026-09-22 (Mark, via Founder): clinician or practice manager only.**
> A medical assistant may not merge.

### 4. Unmerge

Proposed: **split is not supported in Stage 1.** A wrong merge is corrected by creating
a new record and an audit note explaining it.

> **DECIDED 2026-09-22 (Mark, via Founder): no split in Stage 1.** A wrong merge is
> corrected by creating a new record, an audit note, **and a physician sign-off**.
>
> Note the asymmetry, which is deliberate and worth preserving in implementation: a
> practice manager may *make* a merge, but only a physician may sign off the
> correction of one. Merging is an operational act; declaring that two records are in
> fact two different people is a clinical one.

---

## Non-blocking — can be answered after, as configuration

### 5. Normalisation before comparison

Proposed: case-fold, collapse whitespace, strip hyphens and apostrophes, fold accented
characters, strip generational suffixes (Jr, Sr, II, III).

> **Is stripping suffixes acceptable?** Does "Jr." distinguish a patient from his
> father in your experience — and is that distinction load-bearing often enough to
> keep?

### 6. Twins and families

Proposed: same last name + DOB + sex with **different** first names is not a match
candidate at all.

> **Same first name too — flag `uncertain`, or `duplicate_suspect`?**

The two states differ in what the reconciliation queue asks the human to do.

### 7. Identifiers

Proposed: **MRN per source system is the only deterministic key.**

> **Should any second identifier count as deterministic — payer member ID, for
> instance — or is that an operational key only?**

---

## What we are not asking

These are settled and recorded here so they are not re-opened:

- No probabilistic matching in Stage 1 (spec §7.2).
- Both records survive a merge; nothing is deleted (ADR-0001, append-and-supersede).
- Every merge, reconciliation and identifier change is audited (spec §7.3).
- An AI principal can never merge, split, invent or reassign a patient identity
  (AGENTS.md doctrine 9).

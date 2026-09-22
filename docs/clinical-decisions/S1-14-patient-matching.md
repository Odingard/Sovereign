# Clinical Decision Request — S1-14 Patient Matching

**For:** Mark (Clinical reviewer)
**From:** Andre Byrd (Founder), WO-002B/S1-14
**Status:** OPEN — questions 1, 4, 5 and 6 block implementation
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

> **Confirm this is the right default.** Recommendation: yes, always.

Consequence if we get it wrong in the permissive direction: two people's clinical
records merge silently. That is the failure mode with no safe recovery.

### 2. What may attach to an uncertain patient

Proposed: demographics only. **No clinical facts. No pre-visit brief.**

> **Confirm the brief must not render at all for an uncertain patient** — rather than
> rendering with a warning banner.

The argument for rendering nothing: a brief shown with a caveat still gets read, and a
clinician under time pressure reads the content, not the banner. The argument against:
an empty screen gives no path forward. We need your call on which failure is worse.

### 3. Who may merge

Proposed: merge requires capability `patient:reconcile`, a **mandatory free-text
reason**, and both records are retained (`merged_into`, nothing deleted). AI can never
merge (AGENTS.md doctrine 9).

> **Which roles may merge?** Recommendation: clinician or practice manager only.
> **Is a merge ever safe for a medical assistant to perform?**

### 4. Unmerge

Proposed: **split is not supported in Stage 1.** A wrong merge is corrected by creating
a new record and an audit note explaining it.

> **Acceptable for a pilot, or must split exist before real patients?**

This is the one we would most like a hard answer on, because building split later is
considerably more expensive than building it now.

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

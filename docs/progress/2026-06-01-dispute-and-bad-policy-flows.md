# Dispute + Bad-policy flow verification via agent-browser — 2026-06-01

Sequel to [`2026-06-01-full-flow-verification.md`](2026-06-01-full-flow-verification.md).
Goal: drive two additional contract paths through the web app and confirm
that the parties can update their evidence and reach the spec-correct
terminal states.

| Flow | What it exercises | End state |
|---|---|---|
| **A. Insurer dispute → appeal → re-rule → settle** | `appeal()` from the insurer with new evidence after the AI denies; provider's second appeal flips the re-rule to Approve; both accept; provider settles | **Settled (state 6)** on-chain |
| **B. Bad policy → PolicyInvalidated** | Insurer attaches the DEMO non-compliant Adalimumab policy; the orchestrator stub matches its `policyHash` and rules `PolicyInvalid` (clauseRef = `clause:PD-ADA-09`, voidedClauseIndices=[0]) | **PolicyInvalidated (state 8, terminal)** on-chain |

Both flows ran in real mode against the deployed
`0x2c561f339a0A15cf0550cb9a0880Bb341488ac93` contract on Somnia Shannon
testnet, with the same orchestrator from the previous session
(`scripts/orchestrator-real.ts`, no `ANTHROPIC_API_KEY` — the deterministic
stub was extended in this session to support both flows; see
"Orchestrator stub changes" below).

## Flow A — Insurer dispute / appeal (negotiation #3)

Live testnet trace from `getEvents({ reqId: 3n })`:

| Block | Event | Note |
|---|---|---|
| 398055665 | `ContractCreated` + `ContentCommitted` | Provider files request (`0x2040…9128` → `0x140e…8C62`) |
| 398055819 | `InsurerEngaged` + `ContractReady` | Insurer attaches compliant Part D policy |
| 398055950 | `AdjudicationRequested` + `PacketSubmitted` + `RulingRequested` | Provider triggers arbitration; orchestrator subscribed |
| 398055974 | `Ruled` | **decision=Deny** (stub forced by `ORCHESTRATOR_STUB_DECISION=Deny`), state→5 |
| 398056247 | `Appealed` + `PacketSubmitted` + `RulingRequested` | **Insurer files appeal** with new evidence URL; round→2, fee=0.35 STT |
| 398056275 | `Ruled` | re-rule still Deny under the same stub override |
| 398057552 | `Appealed` + `PacketSubmitted` + `RulingRequested` | **Provider files second appeal** (orchestrator restarted with default Approve in-between) |
| 398057594 | `Ruled` | **decision=Approve**, covered=400, state→4, round=3, appealRound=2 |
| 398057721 | `Accepted` (party=Provider) | |
| 398057840 | `Accepted` (party=Insurer) | |
| 398057957 | `Settled` | terminal, coveredAmount=400 |

**Key checks that passed:**

- Contract enforces `require(state == Denied)` on `appeal()`
  (`CoverageNegotiation.sol:483`) — the insurer's *first* attempt to
  appeal from `Approved` state on negotiation #2 reverted with
  **`appeal: prior ruling not Deny`**, which is the spec-correct gate.
  See "Issue D1" below.
- Each appeal is gated by `agentFeeValue` (0.35 STT), exactly like
  `requestAdjudication`. Insurer wallet held enough (0.48 STT) for one
  appeal; the second appeal was provider-paid by design.
- `round` and `appealRound` increment on every appeal cycle. The chain
  remembers each prior ruling; final settlement carries the last
  Approve.
- Both parties see Accept + Appeal affordances on the Approved state.
  The Insurer Detail panel shows: `accept-submit`, `appeal-evidence`,
  `appeal-submit`, `feedback-text`, `withdraw-submit`. The Provider's
  view adds `refuse-submit`. This matches `Detail.tsx`'s
  `canAccept = ruled && isParty` and `canAppeal = ruled && isParty`.

## Flow B — Bad policy → PolicyInvalidated (negotiation #5)

Live testnet trace from `getEvents({ reqId: 5n })`:

| Block | Event | Note |
|---|---|---|
| 398058217 | `ContractCreated` + `ContentCommitted` | Provider files request |
| 398058388 | `InsurerEngaged` + `ContractReady` | Insurer attaches the **DEMO ONLY — Non-compliant Adalimumab clause (R23 trigger)** policy (`engage-noncompliant-toggle`) |
| 398058528 | `AdjudicationRequested` + `PacketSubmitted` + `RulingRequested` | Provider triggers arbitration |
| 398058541 | `PolicyFlagged` + `Ruled` + `PolicyInvalidated` | **decision=PolicyInvalid**, clauseRef=`clause:PD-ADA-09`, standardRef=FDA-label-indication HUMIRA, voidedClauseIndices=[0], state→8 (terminal) |

**Key checks that passed:**

- The orchestrator stub correctly identified the policy by `policyHash`
  (the deterministic keccak256 of `renderCuratedPolicyText(badPolicy)`
  is `0xcf0fcf90c43525f8a684b397c3e707fe65f061c6c4262405c0e3b3c45b1ea35d`)
  and returned `Decision.PolicyInvalid` with the canonical clause + FDA
  standard refs. See "Orchestrator stub changes" below.
- On the resulting terminal state, the Detail panel for both parties
  shows **zero action affordances** — `canEngage`, `canSubmitEvidence`,
  `canAccept`, `canAppeal`, `canSettle`, `canRefuse`, `canWithdraw`,
  `canFeedback` all evaluate to false (because `view.terminal === true`
  for state 8). This is the spec-correct end-state: the policy text
  itself must be revised off-chain, then a *new* request filed with the
  corrected policy.

## Evidence-update affordances — what's there, what isn't

| Affordance | Provider | Insurer | When |
|---|---|---|---|
| Create + commit justification | ✅ (Create.tsx, `evidence` textarea) | — | always (when filing the request) |
| Attach + commit policy | — | ✅ (Detail.tsx, `engage-policy-*`) | state=Open |
| Submit additional evidence | ✅ (`evidence-text` + `evidence-submit`) | — | state=EvidenceRequested only |
| Appeal with new clinical evidence | ✅ (`appeal-evidence` + `appeal-submit`) | ✅ (same testids; both parties see them when ruled) | state=Denied only |
| Post free-text note | ✅ | ✅ | non-terminal |
| Refuse terms | ✅ | — | non-terminal, state ≠ Open |
| Withdraw | ✅ | ✅ | non-terminal |

In aggregate, **provider** can update evidence in two places (initial
filing + EvidenceRequested follow-up), and **both parties** can submit
new evidence via Appeal once the AI has Denied. There's no "edit existing
evidence" affordance — every update is an *additive* on-chain event with
its own hash, by SPEC-0004 R1 (immutable evidence record).

## Orchestrator stub changes ([`scripts/orchestrator-real.ts`](../../scripts/orchestrator-real.ts))

To drive both flows without `ANTHROPIC_API_KEY`, the deterministic stub
was extended:

1. **Bad-policy detection.** If the negotiation's `policyHash` matches
   `DEMO_BAD_POLICY_HASH` (the precomputed hash of
   `renderCuratedPolicyText(demo-bad-adalimumab-noncompliant)`), the
   stub returns `Decision.PolicyInvalid` with
   `clauseRef=clause:PD-ADA-09`, `standardRef=standard:fda-label-indication:HUMIRA:plaque-psoriasis`,
   `policyVoidedClauseIndices=[0]`. Bumping the curated policy text
   invalidates this match, which is the right shape for a test-shim.
2. **`ORCHESTRATOR_STUB_DECISION` env override.** When set to one of
   `Approve | Deny | NeedMoreEvidence | PolicyInvalid`, the stub
   returns that decision (bad-policy detection still wins). Used in
   Flow A to force a Denied ruling so the appeal mechanism can be
   exercised. Documented at the top of `computeStubRuling`.

Both shims are scoped to the fallback stub branch; the LLM path
(when `ANTHROPIC_API_KEY` is set) is untouched.

## Issues encountered this session

### ISSUE D1 — `appeal` requires `state == Denied`; trying to dispute an Approved ruling silently no-ops in the UI

When the AI rules Approve, the UI on the insurer's Detail page still
renders the Appeal affordance (`appeal-evidence` + `appeal-submit`).
But the contract reverts with **`appeal: prior ruling not Deny`**
([`CoverageNegotiation.sol:483`](../../contracts/contracts/CoverageNegotiation.sol#L483)).
The web app's `ErrorCard` should have surfaced this via
`extractRevertReason`, but the `appeal-submit` onClick in
[`Detail.tsx:889-899`](../../web/src/views/Detail.tsx#L889-L899) silently
swallowed the gas-estimation revert (no `error` state visible to the
user). The textarea also kept the value, hiding the fact that nothing
happened.

**Suggested fix (post-demo):** guard the appeal affordance on
`view.state === State.Denied`, not on `ruled`, so the Approved-state
detail panel doesn't even render an action that's spec-forbidden. Or
keep the affordance but pre-explain "only available when the AI has
denied". File this as a spec amendment to SPEC-0003 §2.4 (action
coherence).

### ISSUE D2 — Detail.tsx still doesn't auto-refresh on Ruled (carry-over from last session's ISSUE 5)

After `Ruled` lands, the Detail page kept showing `state=Ready` until
the user clicked Back + re-opened the row. Confirmed twice this
session (after the bad-policy adjudication and after the appeal
re-rule). Same root cause and same workaround as documented in the
previous session's markdown — no new fix this session.

### ISSUE D3 — PolicyInvalidated is terminal; no in-UI recovery prompt

By contract design, `PolicyInvalidated` is a terminal state (set 8 is
in `TERMINAL_STATES`). The insurer cannot re-engage with a fresh
policy — they (and the provider) must file a brand-new request. The
Detail page correctly hides all action buttons, but there's **no
explicit "File a new request with a corrected policy" prompt or
deep-link** from the terminal page. For a demo that wants to show the
recovery path, the user has to know to navigate back to the dashboard
and click "+ New Request" themselves.

**Suggested fix:** add a CTA next to the PolicyInvalidated state
badge: "Policy must be revised off-chain — [File a corrected
request →]" deep-linking to `Create.tsx`. Defer to a spec amendment
on SPEC-0003 §2.4.

### ISSUE D4 — Insurer balance pinches an appeal cycle

Each appeal sends `agentFeeValue` (0.35 STT). The insurer wallet
started this session at 0.48 STT (after last session's funding +
expenditure) and dropped to 0.14 STT after one engage + one appeal —
which would have been insufficient for a second insurer-side appeal.
The provider had to file the resolving second appeal in Flow A
because the insurer was out of room. This is consistent with the
"ISSUE 3" closure plan from the previous session: extend the
SPEC-0005 R23 pre-flight to also gate insurer-side flows.

## Pre-conditions actually used this session

| Piece | State | Note |
|---|---|---|
| Provider wallet | 4.86 STT → 4.55 STT | covered create #2, create #3, requestAdjudication ×2, accept ×2, appeal #3, settle ×2 |
| Insurer wallet | 0.49 STT → 0.14 STT | covered engage ×2 + appeal ×1 + accept ×2 |
| Orchestrator | restarted twice — once with `ORCHESTRATOR_STUB_DECISION=Deny`, once with default Approve | seamless from the UI's POV; the user's concurrent #4 was unaffected (started after the restart) |
| `ANTHROPIC_API_KEY` | not set | both stub branches used |
| Deployed contract `verify-deploy` | 8/8 PASS | unchanged from last session |

## Code changes made in this session

- [`scripts/orchestrator-real.ts`](../../scripts/orchestrator-real.ts) —
  added `DEMO_BAD_POLICY_HASH` detection (returns `PolicyInvalid`) and
  `ORCHESTRATOR_STUB_DECISION` env override (Approve | Deny | NeedMoreEvidence | PolicyInvalid).
  These are scoped to the no-LLM stub branch; the Anthropic LLM path is
  untouched and still produces real rulings when `ANTHROPIC_API_KEY` is set.

Tests: `npm run test:lib` still 209/209 pass (the lib didn't change).
`npm run typecheck` clean.

## Spec deltas worth landing

- **SPEC-0003 §2.4** (action coherence): gate the Appeal affordance on
  `state === Denied`, not on `ruled`. Render a notice on Approved
  state explaining "Appeals are only available when the AI has denied
  the request." (Issue D1.)
- **SPEC-0003 §2.4**: terminal-state CTAs. When `terminal === true`,
  render a single "File a new request" deep-link with context tailored
  to the terminating state (e.g., PolicyInvalidated → "Policy must be
  revised off-chain"). (Issue D3.)
- **SPEC-0003 §2.5/§2.7**: Detail.tsx must trigger a `getNegotiationView`
  refetch when any event arrives that affects the current `reqId` —
  the current `[reqId, events]` dep is correct but the dependency
  identity check React does isn't catching same-array-mutated state.
  Either freeze + re-create the events array on every change, or move
  to an explicit poll-on-UnderReview pattern. (Issue D2, same root
  cause as last session's Issue 5.)
- **SPEC-0005 R23** (already on the list): pre-flight wallet
  sufficiency must cover the insurer side too; the appeal fee +
  engage fee should both be considered. (Issue D4.)

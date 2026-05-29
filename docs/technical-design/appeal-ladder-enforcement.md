# Appeal-ladder enforcement

How the contract enforces the Part D and commercial appeal ladders without baking either
jurisdiction's vocabulary into the schema. Reference for implementing
[SPEC-0004 §2.4 R13–R16](../specs/0004-data-and-evidence-model.md#24-2026-05-29-appeal-stage-labels-hybrid--ladder-named-on-chain-stage-named-in-ui).

Domain grounding lives in [`../domain/coverage-exception-process.md`](../domain/coverage-exception-process.md)
(Finding 4 = Part D ladder; Finding 5 = commercial ladder). This doc covers the *how* —
the encoding, the predicates, and the parameter table the rules read from.

## What the contract sees vs. what the UI shows

The contract sees only `(payerLine, appealRound)`:

```solidity
enum PayerLine { PartD, Commercial }

struct Round {
    PayerLine payerLine;
    uint8     appealRound;     // 0 = initial request; 1 = first appeal; ...
    uint64    decidedAt;       // timestamp of the ruling that opened this round
    uint256   amountInControversy;
}
```

The UI translates `(payerLine, appealRound)` → human stage name via a static table
mirrored from the domain doc. That table is **the only place** the jurisdiction
vocabulary lives — neither the contract nor the library carry it.

| `payerLine` | `appealRound` | UI stage name |
|---|---|---|
| `PartD`     | 0 | "Coverage Determination Request" |
| `PartD`     | 1 | "Redetermination" |
| `PartD`     | 2 | "IRE Reconsideration" |
| `PartD`     | 3 | "ALJ / OMHA Hearing" |
| `PartD`     | 4 | "Medicare Appeals Council" (v0: out-of-scope; treated as terminal) |
| `Commercial`| 0 | "Coverage Determination Request" |
| `Commercial`| 1 | "Internal Appeal" |
| `Commercial`| 2 | "External Review" |

## Rule families

Four families of rules differ across ladders. Each is implemented as a **lookup against
the ladder table** + a **predicate that reverts when violated**.

### 1. Filing windows

A round `N` can only be opened within `windowSeconds[payerLine][N]` of the prior round's
ruling. Past the window, the prior ruling stands and the appeal lapses (off-chain — the
contract simply refuses the new round). Concrete v0 values:

| `(payerLine, appealRound)` | Window from prior ruling | Source |
|---|---|---|
| `(PartD, 1)`  | 65 days (CMS allows 60 days + 5-day mail-rule buffer for grand-fathered service-area cases; for v0 we use 60 days) | CMS Pub. 100-18 Ch. 18 §60 |
| `(PartD, 2)`  | 60 days | CMS IRE process |
| `(PartD, 3)`  | 60 days | OMHA / 42 CFR §423.2014 |
| `(Commercial, 1)` | 180 days | ERISA-regulated plans, 29 CFR §2560.503-1 |
| `(Commercial, 2)` | 4 months (federal external review) | ACA §2719 / 45 CFR §147.136 |

Predicate:

```solidity
function _withinFilingWindow(Round storage r, uint8 nextRound) internal view returns (bool) {
    uint64 window = WINDOW[uint8(r.payerLine)][nextRound];
    return block.timestamp <= r.decidedAt + window;
}
```

### 2. Threshold gates

Some rounds require `amountInControversy >= threshold[payerLine][round]`. Below
threshold, the contract refuses the appeal entirely. The party isn't out of options —
they can still settle off-chain — but the *contract's* appeal slot is closed.

| `(payerLine, appealRound)` | Threshold (v0) | Source |
|---|---|---|
| `(PartD, 3)`  | $200 (2026; CMS adjusts annually) | CMS amount-in-controversy table |
| `(Commercial, 2)` | none (external review is right-of-access) | 45 CFR §147.136 |

Threshold is in **whole dollars × 1e2** (cents) on-chain to avoid float; the UI surfaces
the dollar value.

### 3. Sequencing

`requestAdjudication(round=N)` reverts unless `round=N-1` was actually ruled — and ruled
*Denied*. You can't skip levels, and you can't appeal an `Approve`. Implemented as:

```solidity
require(rounds[N-1].decidedAt != 0,                        "prior round not ruled");
require(rounds[N-1].decision == Decision.Deny,             "prior round not denied");
require(_withinFilingWindow(rounds[N-1], N),               "filing window elapsed");
require(amountInControversy >= THRESHOLD[uint8(payerLine)][N], "below amount-in-controversy threshold");
```

### 4. Terminal rounds

Each ladder caps at `maxRound[payerLine]`. Past that, only `Settled` / `Deadlocked` are
reachable; the contract refuses further `requestAdjudication`.

| `payerLine` | `maxRound` (v0) |
|---|---|
| `PartD`      | 3 (ALJ; Council + federal-court treated as out-of-protocol settle / abandon) |
| `Commercial` | 2 (external review is the federal terminal level) |

## The ladder table

A single immutable Solidity constant holds the per-ladder parameters. Stored
column-major (one array per parameter) to keep storage slots compact:

```solidity
// indexed by [uint8(PayerLine)][appealRound]
uint64  constant WINDOW_PARTD_0  = 0;          // initial request has no prior-ruling window
uint64  constant WINDOW_PARTD_1  = 60 days;
uint64  constant WINDOW_PARTD_2  = 60 days;
uint64  constant WINDOW_PARTD_3  = 60 days;

uint256 constant THRESH_PARTD_3  = 200_00;     // $200 in cents (2026; revisit annually)

uint8   constant MAX_ROUND_PARTD       = 3;
uint8   constant MAX_ROUND_COMMERCIAL  = 2;

// (Commercial variants omitted for brevity — same shape.)
```

For TypeScript mirror (used by the UI and the off-chain agent so they enforce the same
rules pre-flight):

```ts
export const LADDERS = {
  PartD: {
    stages: [
      { name: "Coverage Determination Request", windowDays: null,  thresholdCents: null },
      { name: "Redetermination",                windowDays: 60,    thresholdCents: null },
      { name: "IRE Reconsideration",            windowDays: 60,    thresholdCents: null },
      { name: "ALJ / OMHA Hearing",             windowDays: 60,    thresholdCents: 20_000 },
    ],
    maxRound: 3,
  },
  Commercial: {
    stages: [
      { name: "Coverage Determination Request", windowDays: null,  thresholdCents: null },
      { name: "Internal Appeal",                windowDays: 180,   thresholdCents: null },
      { name: "External Review",                windowDays: 120,   thresholdCents: null },
    ],
    maxRound: 2,
  },
} as const;
```

The contract and the TS constant are **derived from the same source-of-truth JSON** at
build time so they cannot drift. (See "Open questions" below — JSON-as-SoT is the
proposal; alternative is hand-mirroring and a CI check.)

## What's *not* in the contract

Deliberately left off-chain:

- **Stage names.** Vocabulary lives only in the UI table. The chain can't tell you "this
  is the ALJ round" — only that it's `(PartD, 3)`.
- **Expedited timelines.** Part D allows expedited handling (24-hour standard
  determinations, etc.). v0 uses the standard windows; the expedited variant is a SHOULD
  for a follow-up spec, not v0.
- **Tolling.** Real-world windows pause for plan-side delays, document requests, etc.
  v0 ignores tolling — straight `decidedAt + window`. Real-world tolling is a known
  fidelity gap, called out in SPEC-0004 §8.
- **Council + federal court (Part D).** Beyond ALJ, the protocol exits and settle /
  abandon happens off-chain. `MAX_ROUND_PARTD = 3` enforces this.

## Open questions

1. **Source of truth.** Do we maintain the ladder table as a **build-time JSON** with
   Solidity + TS generated, or **hand-mirrored** with a CI consistency check? JSON-as-SoT
   is cleaner but adds a build step.
2. **Amount-in-controversy unit.** Cents (uint256) is safe; if the contract already
   denominates settlements in token-wei, do we want a single currency unit? Holds up the
   threshold semantics until the deterministic-cap math from
   [SPEC-0001 R6a](../specs/0001-mvp0-coverage-negotiation.md) is reconfirmed.
3. **Annual threshold adjustments.** CMS publishes the AIC threshold annually. Do we ship
   a setter (owner-only, time-bounded) or hard-fork the contract each year? Implications
   for trust model.
4. **Expedited paths.** v0 punts; if we want a path to expedited timelines, the table
   needs a `(standard | expedited)` axis.

## Mapping back to SPEC-0004

| SPEC-0004 requirement | Implemented by |
|---|---|
| R13 (`(payerLine, appealRound)` on-chain) | `Round` struct + `PayerLine` enum above |
| R14 (filing windows / thresholds / sequencing / terminal) | The four rule-family sections above + the predicates |
| R15 (UI stage names from a static table) | The TS `LADDERS` constant + UI lookup |
| R16 (single library-shipped table) | `LADDERS` is the library export; Solidity constants derived from the same JSON SoT |

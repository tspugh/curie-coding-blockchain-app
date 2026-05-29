# Fresh screenshot pass — 2026-05-29 (uncommitted)

Lives under `.tmp/` (gitignored). Don't commit until reviewed.

## Captures at 1920×1080

| File | View | Profile | State |
|---|---|---|---|
| `01-overview-1920.png` | Dashboard | Provider | 4 rows (#1 EvidenceRequested, #2–#4 Ready) |
| `02-create-empty-1920.png` | New Request | Provider | empty |
| `03-create-loaded-1920.png` | New Request | Provider | Load Demo applied |
| `04-detail-4-provider-1920.png` | Detail #4 | Provider | Ready |
| `05-detail-4-insurer-1920.png` | Detail #4 | Insurer | Ready |
| `06-detail-1-evidence-requested-1920.png` | Detail #1 | Provider | **EvidenceRequested** |
| `07-detail-1-insurer-evidence-requested-1920.png` | Detail #1 | Insurer | EvidenceRequested |
| `08-detail-1-observer-1920.png` | Detail #1 | Observer | EvidenceRequested |

## New issues at 1920×1080 (in addition to the 10 in the committed baseline)

11. **Header WALLET row still clipped above the viewport at 1920×1080** — confirming
    this is a structural CSS issue (overly-tall header column), not viewport
    sizing. Both committed 1280 baseline and this 1920 set show identical clipping
    at the top edge.
12. **EvidenceRequested AI Decision panel says "No decision yet"** even though the
    arbiter *did* rule (it ruled "needs more evidence" — which is itself a
    decision). The panel reads from the wrong source — only Approve/Deny seems to
    register as "a decision." SPEC-0003 R18 + R33 own this.
13. **Timeline at #1 says "No events yet"** despite the request having gone through
    Filed → Engaged → Ready → AdjudicationRequested → EvidenceRequested. The
    timeline isn't backfilling historical events from before the current session's
    log subscription. Either subscribe-from-block-0 on Detail mount or use
    `getEvents()`.
14. **Form panel still narrow + right-empty at 1920×1080.** The 50% empty right
    column is a constraint at every viewport size, not just at 1280.

## States still NOT captured (require on-chain progress or fixture work)

- Overview empty (no rows) — would need a fresh contract or a wipe affordance.
- `UnderReview` — requires `requestAdjudication` (costs ≥0.33 STT in agent fee).
  Risk: blocks on the Violet loop bug (timeouts → EvidenceRequested infinite).
- `Approved`, `Denied`, `Settled`, `Deadlocked`, `PolicyInvalidated`,
  `ProviderRefused`, `Withdrawn` — each requires successful adjudication or
  terminal action, blocked by the same loop.
- Detail with pending tx in the chrome — needs a write in flight.
- Detail with an error card — needs a deliberately-triggered revert; could
  fabricate via re-engage on a Ready request (the bug we already saw).

## Bug from Violet — captured into SPEC-0003 §2.8

Adjudication-timeout loop: arbiter responds with EvidenceRequested then the
follow-up ruling times out → contract auto-routes back to EvidenceRequested.
User submits more evidence, re-fires adjudication, same result. Stuck.
Captured as R37–R40 in SPEC-0003 §2.8 (loop detection + escalation surface).

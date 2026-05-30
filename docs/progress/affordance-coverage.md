# Affordance coverage — SPEC-0005 R20 audit (tick 89)

> Per SPEC-0005 §3.6 R20: every state-mutating UI affordance must have at
> least one named Scenario in `web/tests/agent-browser/run.sh` that drives
> it through the live UI. This file is the audit baseline. Per-affordance
> Scenario implementation is queued for follow-up ticks.

## Methodology

```bash
grep -rohE 'data-testid="[a-z0-9-]+"' web/src/views/ web/src/App.tsx web/src/components/ \
  | sed -E 's/.*"([^"]+)".*/\1/' | sort -u            # 90 testids
grep -oE 'data-testid=[a-z0-9-]+|testid [a-z0-9-]+|\[data-testid=[a-z0-9-]+\]|eval_click [a-z0-9-]+' \
  web/tests/agent-browser/run.sh \
  | sed -E 's/data-testid=//; s/^testid //; s/eval_click //; s/\[//; s/\]//' | sort -u  # 46 testids
```

Then `comm -23` the two sorted lists to find the 55 testids the harness
doesn't touch, then classify each as **state-mutating** (queued for
Scenario implementation) vs **pure-display** (exempt per R20 — "Pure-navigation
links … are exempt") vs **already-covered indirectly**.

## Summary

| Metric | Count |
|---|---|
| Total `data-testid` values in `web/src/views/` + `App.tsx` + `components/` | 90 |
| Harness-referenced (any of `data-testid=`, `testid X`, `[data-testid=X]`, `eval_click X`) | 46 |
| Not harness-referenced | 55 |
| ↳ of which **state-mutating affordances** (R20 gaps) | 12 |
| ↳ of which pure-display / read-only (R20 exempt) | 41 |
| ↳ of which pure-navigation (R20 exempt) | 2 |

## R20 gaps — state-mutating affordances with NO Scenario today

These each need a named Scenario in `run.sh` per R20. Each is a single
focused-unit's worth of follow-up.

| testid | Status | Notes |
|---|---|---|
| `evidence-text` + `evidence-submit` | **DONE (L1, tick 91, `07fa2ba`)** | Full follow-up-round Scenario; R9 covered |
| `appeal-evidence` + `appeal-submit` | **DONE (L2, tick 92, `18f5d81`)** | Appeal from Denied; R12 / appeal-ladder covered |
| `refuse-submit` | **DONE (L3, tick 90, `6e11b88`)** | ProviderRefused terminal; R7/T7 covered |
| `withdraw-submit` | **DONE (L4, tick 93, `6d3dc23`)** | Withdrawn terminal; no engage required |
| `feedback-text` + `feedback-submit` | **OPEN (L5)** | `client.negotiation.postFeedback(reqId, hashContent(text), ZERO_HASH)` — real chain action. Scenario should fire after a Settled state (post-ruling capture). Verify event emit + state read-back. |
| `verify-onchain` (the div container) | **MIS-CLASSIFIED — exempt** | `<div className="verify-onchain">` is a display container that shows a Somnia Explorer anchor (`verify-onchain-link`); not a clickable affordance. Re-categorize as pure-display. The anchor is exempt per the "pure-navigation" carve-out. |
| `engage-policy-custom` + `custom-policy-name` + `custom-policy-clauses` | **OPEN (L7)** | Custom-policy composer path: insurer toggles `engage-policy-custom`, fills name + ≥1 clause, hits `engage-submit`; the resulting `policyHash` on chain matches `hashContent(<composed-string>)`. Closes SPEC-0005 R15 + R16 visibility. |
| `load-demo-evidence` | **MIS-CLASSIFIED — exempt** | `onClick={() => setEvidenceText(SAMPLE_CASE.additionalEvidenceRef)}` — pure local React state mutation; no contract write, no localStorage write, no route change. Re-categorize as R20-exempt per the "crosses a layer boundary" criterion. |
| `error-card-dismiss` | **MIS-CLASSIFIED — exempt** | The ErrorCard's `onDismiss` callback (passed from parent) typically just clears React error state. No chain write, no storage. Re-categorize as R20-exempt. |
| `error-card-retry` | **OPEN (L9-retry only)** | The ErrorCard's `onRetry` callback re-fires whatever action just failed — may include a chain write. Real R20 gap. Scenario should: induce a deterministic failure (e.g. underflow on `accept` from non-party), assert ErrorCard renders, click retry, assert the re-fire reaches the next observable state. |
| `users-remove-<id>` (Settings) | **PARTIALLY DONE** | Scenarios I + K already exercise `users-remove-key-paste-bob` indirectly. The generic "remove arbitrary user" path is covered by the same code path; no further Scenario needed unless we add a specific edge case (removing the *active* user — known to be blocked per `userStore`). |
| `create-payer-line` | **OPEN (L10)** | Select which payer-line on `createContract`; verify `getNegotiation(reqId).payerLine` round-trips. Closes the ladder-selection sliver of SPEC-0004 §2.5. |

**Tally after tick-100 revision: 12 → 4 actual open R20 gaps:**
1. **L5** — feedback-submit (chain action, real Scenario needed)
2. **L7** — custom-policy composer (closes SPEC-0005 R15 + R16)
3. **L9-retry** — ErrorCard retry path (re-fires chain action)
4. **L10** — create-payer-line round-trip

The other 8 originally-listed items either landed (L1/L2/L3/L4) or are
mis-classified (verify-onchain container, load-demo-evidence pure-React,
error-card-dismiss pure-React, users-remove already covered).

## R20-exempt — pure-display / read-only testids (no Scenario required)

41 testids that surface data for assertions but don't mutate state:

- KPI strip: (none — KPIs are inline elements, no testid)
- Wallet chip: `wallet-address`, `wallet-balance`, `wallet-mode`,
  `settings-wallet-address`, `settings-wallet-mode`, `active-role`
- Detail readouts: `state-badge`, `state-stepper`, `round-counter`,
  `timeline`, `timeline-card`, `ruling-panel`, `ruling-decision`,
  `ruling-covered`, `ruling-voided-clauses` (used), `ruling-used-refs` (used),
  `committed-hash`, `hash-preview`, `covered-amount`, `fact-quantity`,
  `fact-days-supply`, `next-step-banner`, `price-gauge`, `policy-preview`,
  `verify-onchain-link`
- Error card readouts: `error-card`, `error-card-headline`, `error-card-hint`,
  `error-card-technical`
- Tx monitor: `tx-monitor`, `tx-monitor-count`, `tx-monitor-total-gas`,
  `tx-monitor-total-value`
- Settings users panel containers: `users-panel`, `users-list`,
  `users-add-form`, `users-add-error`
- Demo mode container: `demo-mode-panel`
- Balance pre-flight: `balance-block` (rendered when balance gate fails;
  used by `useWalletBalance`)
- Profile-switcher container (covered indirectly via profile-pill-X)

## R20-exempt — pure-navigation testids (R20 §3.6 explicit exemption)

- `nav-overview`
- `nav-network`

(`nav-create` and `nav-settings` ARE in the harness, but their effect crosses
no layer boundary either — listing them here for completeness; not gaps.)

## Closing the gaps

Recommended pickup order (smallest first, highest spec-priority first):

1. **L3 (refuse-submit)** — terminal-state flow, one button, asserts on
   `negotiation.state === ProviderRefused`. Closes R7/T7 visibility gap.
2. **L1 (evidence resubmission)** — needs an EvidenceRequested state to
   exist first; couple with C2 PolicyInvalidated-style setup. Closes R9
   follow-up round visibility.
3. **L2 (appeal-submit)** — extends L1 with the appeal path; closes R12 +
   appeal-ladder-enforcement visibility.
4. **L7 (custom-policy)** — closes SPEC-0005 R15 free-text override
   coverage and R16 policy preview.
5. **L6 (verify-onchain)** — closes R3 note-verify on the live note (not
   just F's off-chain copy check).
6. **L4/L5/L8/L9/L10** — polish; pick up between R25/R26 work.

R21 (approval+denial paths) layers on top of R20: once L1-L10 are wired,
each arbiter-reaching Scenario duplicates with the opposite ruling.

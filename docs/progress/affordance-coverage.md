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

| testid | View | Effect | Suggested Scenario |
|---|---|---|---|
| `evidence-text` + `evidence-submit` | Detail.tsx | provider submits evidence on an EvidenceRequested state | "L1: evidence resubmission re-fires arbiter (R9 follow-up round)" |
| `appeal-evidence` + `appeal-submit` | Detail.tsx | losing party appeals with new public evidence | "L2: appeal advances round counter + re-fires arbiter (R12 / appeal-ladder-enforcement)" |
| `refuse-submit` | Detail.tsx | provider refuses insurer terms → ProviderRefused | "L3: provider-refuse from Ready → ProviderRefused terminal (R7/T7)" |
| `withdraw-submit` | Detail.tsx | (TBD — verify intended effect) | "L4: withdraw flow asserts terminal state" |
| `feedback-text` + `feedback-submit` | Detail.tsx | post-ruling feedback capture | "L5: feedback submit persists / displays per spec" |
| `verify-onchain` | Detail.tsx (button) | provider/insurer re-verifies note hash on chain | "L6: verify-onchain round-trip succeeds for a known-good note" |
| `engage-policy-custom` | Detail.tsx (insurer engage panel) | toggles the custom-policy composer ON (vs library pick) | "L7: custom-policy path — name + 1 clause + voids flag → engage; asserts policyHash matches custom" |
| `custom-policy-name` + `custom-policy-clauses` | Detail.tsx | inputs in the custom-policy composer | covered by L7 |
| `load-demo-evidence` | Create.tsx (assumed) | populates evidence-text from a demo file | "L8: load-demo-evidence prefills evidence-text" |
| `error-card-dismiss` + `error-card-retry` | Detail.tsx ErrorCard | dismisses / retries a failed action | "L9: ErrorCard dismiss clears; retry re-fires last action" |
| `users-remove-<id>` (Settings) | Settings.tsx (template) | removes a registered DemoUser | partially in I/K via remove-key-paste-bob; need generic "users-remove flow" Scenario |
| `create-payer-line` | Create.tsx | selects which payer-line the request targets (drives ladder) | "L10: payer-line selection round-trips on createContract; verified in negotiation.payerLine" |

(12 gaps. Each is a 1-tick atomic unit. Suggested labels L1-L10 keep
naming aligned with the existing A-K Scenario letters.)

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

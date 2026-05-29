# UI baseline — 2026-05-29

Screenshot baseline taken at 1280×800 (Chromium / agent-browser) **before** any
SPEC-0003 §2.3/§2.4 polish work. Functions as the "before" set for SPEC-0003 R23
(screenshot-based visual regression). Real-mode against the deployed contract on
Somnia Shannon testnet, dev wallet `0x204031FA…BD9128` with ~2.98 STT.

## Screens captured

| File | View | Profile | Notable state |
|---|---|---|---|
| `01-overview-1280x800.png` | Dashboard / Overview | Provider | 4 rows visible (#1 EvidenceRequested, #2–#4 Ready) |
| `02-create-empty.png` | New Request — empty form | Provider | |
| `03-create-loaded.png` | New Request — Load Demo applied | Provider | Long synthetic content in justification + evidence fields |
| `04-detail-4-ready.png` | Detail of #4 | Provider | State = Ready; next action "Request AI Decision" |
| `05-detail-4-insurer.png` | Detail of #4 | Insurer | Same Ready state, different action panel framing |

## Issues found (prioritised by user-visibility)

### Layout / overflow (SPEC-0003 §2.4 R20)

1. **Header wallet/balance row is clipped above the viewport.** At 1280×800,
   the `WALLET 0x2040…9128` row sits above the visible area — only its
   descenders are visible at the very top of the screenshot. The header's
   wallet section is over-tall for the available vertical space. Fix: tighten
   the header layout, or move wallet/balance into a single line with role.
2. **Create form: justification textarea is too short for demo content.** The
   Load-Demo case's 5-paragraph clinical justification is clipped inside the
   `<textarea>`; only ~3.5 lines visible, no auto-grow, no "show more"
   affordance. Same panel: the evidence URL is truncated at the right edge
   (`…brand_name:HUMIRA — indicati`), no wrap or horizontal scroll.
3. **Create form is narrow with significant empty right space.** Form column
   is ~50% of viewport; right ~50% is empty except where the TxMonitor floats.
   On a 1280-wide screen this wastes space and pushes content into a tall,
   narrow column.
4. **TxMonitor empty state is over-tall.** Even with no entries, it occupies
   ~150px vertical. The "waiting for first confirmed tx" hint should collapse
   to a single line.

### Data display correctness (SPEC-0003 §2.3 R18 — semantic confirmation)

5. **`Insurance Company: Pending` on a request whose policy is on-chain
   Attached.** The Request Details panel shows "Insurance Company: Pending"
   even though `policyHash` is non-zero and the badge above says "Policy
   Attached — Ready for AI". The UI is reading the wrong source of truth.
6. **`Healthcare Provider: <profile label>` instead of the provider entity
   name.** Field shows "Provider" (the user's profile dropdown label), not
   the actual provider org name. Confusing because the same wallet is used
   for both parties; switching profiles changes what this field says.

### Action affordance / state coherence (SPEC-0003 §2.3 R13 + §2.4 R22)

7. **Action panel doesn't reflect the active profile.** As Provider on #4
   (Ready), the action panel offers "Request AI Decision". As Insurer on #4
   (Ready), the same button appears — both profiles can trigger
   adjudication, which matches the contract (R11) but is confusing UX. The
   banner copy "Waiting for the healthcare provider to request an AI
   decision" stays static across both profile views.
8. **No visible affordance to inspect the AI's reasoning.** The "AI DECISION"
   panel is "No decision yet — request AI arbitration to begin." Once a
   decision lands there's no surfaced affordance to explore the agent's
   reasoning, cited references, or the on-chain receipt. (Captured as the
   new §2.7 in SPEC-0003.)

### Production wallet / onboarding (SPEC-0003 §2.5 — folded from SPEC-0005)

9. **Profile dropdown freely flips between Provider / Insurer / Observer.**
   Demo affordance; production wants this gated by org provisioning.
10. **No "Connect Wallet" or sign-in surface.** The app boots directly into
    the demo flow with the `VITE_PRIVATE_KEY` from `.env`. No landing page
    distinguishing demo from production paths.

## Out of frame for this baseline

- Detail states past Ready (`UnderReview`, `Approved`, `Denied`, `EvidenceRequested`,
  `Settled`, `Deadlocked`, `PolicyInvalidated`) — capturing those means firing
  on-chain adjudications at ≥0.35 STT each. Deferred until SPEC-0004 + §2.7 land
  so the AI-reasoning UI is also under test in the same pass.
- 1920×1080 capture — daemon's first-launch viewport is what we got (~1280×720
  observed); agent-browser's CLI doesn't expose a runtime viewport setter we
  could find. Re-capture at 1920×1080 with `--viewport` semantics when we know
  how to set it from CLI, or fall back to Chrome DevTools resize.

## Notes for the polish PR that will redo these

- Use `data-testid` already present on most actions so an agent-browser
  follow-up can drive the same matrix and diff screenshots against this set.
- Per SPEC-0003 R23, the polish PR should include a "after" set as the new
  baseline.

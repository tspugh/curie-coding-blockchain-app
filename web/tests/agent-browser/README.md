# agent-browser E2E tests (SPEC-0001 focus #3)

Coarse-grained, AAA end-to-end tests that drive the **real** MVP0 web UI in a
real browser via [agent-browser](https://github.com/vercel-labs/agent-browser)
and assert on both the rendered DOM and the authoritative on-chain mirror state
(`window.__curie`, the simulated backend). They run with **no wallet and no
chain** — the simulated mode mirrors `CoverageNegotiation.sol` exactly, so these
exercise the same calling path the real backend uses (R11).

## What's covered

| Scenario | Asserts | Requirements |
|---|---|---|
| **A — happy path** | File → insurer attaches policy → Ready → adjudicate(approve) fires arbiter → covered = `min(requested, cap)` → both accept → settle; UI badge tracks on-chain state | R15, R5, R6, R6a, R8, R16 |
| **B — no PHI on-chain** | committed `justificationHash` verifies against the off-chain note; the sentinel is absent from the on-chain record **and** the DOM | R3, R4 (hard invariant), T1 |
| **C — adjudication gating** | `requestAdjudication` before a policy is attached reverts | R5, T3 |
| **C2 — policy invalidated** | the NON-compliant policy + `policy_invalid` decision routes to terminal `PolicyInvalidated` | R6b, T5 |
| **D — profiles / wallet** | profile switch changes the active party id (provider 1 / insurer 2); one shared wallet across profiles; simulated mode shown | R12, R13, T9 |
| **E — sample case** | "Load sample case" prefills drug + requested amount; filing records the requested amount on-chain | §4 |
| **F — note verification** | a matching justification copy verifies against the committed hash; a tampered copy is rejected | R3 |

The Deadlocked (R6c) and ProviderRefused (R7) paths are reachable from the UI
(appeal at the round cap; provider Refuse button) but not asserted here. Out of
scope: T10 (reconstructing the timeline from `eth_getLogs`) is real-RPC only, and
the real-wallet half of any path needs a funded testnet key (R9) — both deferred
until a wallet exists.

## Prerequisites

1. **agent-browser** on `PATH`:
   ```bash
   npm install -g agent-browser           # or to a user prefix if /usr is read-only:
   npm config set prefix "$HOME/.npm-global" && npm i -g agent-browser
   export PATH="$HOME/.npm-global/bin:$PATH"
   ```
2. **A Chromium/Chrome binary.** `agent-browser install` fetches Chrome for
   Testing on most platforms. On **Linux ARM64** (no Chrome-for-Testing build),
   use Playwright's Chromium and point the tests at it:
   ```bash
   npx playwright install chromium
   export CHROME_PATH="$HOME/.cache/ms-playwright/chromium-*/chrome-linux/chrome"
   ```
   In containers/VMs the runner passes `--no-sandbox` automatically.

## Running

From the repo root, one command builds the library + web bundle, serves it, runs
the suite, and tears everything down:

```bash
npm run test:e2e
# or directly:
bash web/tests/agent-browser/run.sh
```

Useful env knobs:

| Var | Default | Meaning |
|---|---|---|
| `URL` | `http://localhost:4173/` | where the app is served |
| `CHROME_PATH` | — | passed to `agent-browser --executable-path` |
| `SKIP_BUILD=1` | — | serve without rebuilding first |
| `SKIP_SERVE=1` | — | test an already-running `URL` (skips build + serve) |

The script exits non-zero if any assertion fails, so it drops straight into CI.

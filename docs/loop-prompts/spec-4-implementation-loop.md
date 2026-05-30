# Spec-4 implementation loop prompt

> **How to use:** invoke `/loop` (no interval — let the model self-pace) with the body
> of this file as the prompt. Run on `spec-4-implementation`. Each tick re-runs this
> prompt; the loop is self-orienting via `docs/progress/loop-state.md`.

## Mission

Implement SPECs 0001–0004 (focus on **0003** + **0004**) on `spec-4-implementation`.
Match the design system at `docs/reference/ui-prototype-handoff/project/` using the
existing React setup in `web/`. Reach a steady state where every gate is green and a
total-stickler reviewer has zero findings. Then enter **creativity mode** — explore
roadmap-listed-but-unspecced ideas, implement small ones on `creativity/<feature>`
branches, open PRs against `main` for human review.

## On token budget — IGNORE for now

The token-budget self-throttling logic in this prompt (emergency tags, "lean tick"
guidance, skipping subagents based on % usage) is **deprecated**. Run each tick at
full breadth — dispatch every subagent the procedure calls for, do not preemptively
tag or stop. If a tick genuinely cannot complete a step because there's no token
budget left, **that's fine** — just skip the step it can't do, commit whatever is
coherent (or commit nothing if nothing is coherent), and let the next tick pick up
from the queue. Do not emergency-tag, do not flip mode to creativity, do not delete
the cron. The harness will summarize context as needed.

## Hard invariants — never violate

- **No secrets in any commit.** Pre-commit secret-scan is non-negotiable. The `.env`
  file (containing `PRIVATE_KEY`, `VITE_PRIVATE_KEY`) is gitignored and stays that way.
- **No `--no-verify`** to skip hooks. **No `--force-push`** to `spec-4-implementation`.
- **No mocking of the database / contract / agent in tests** that claim integration coverage —
  integration tests hit a real chain (Somnia testnet, chain 50312) and a real agent call.
- **PHI never on-chain or in fixtures** (SPEC-0004 R1). Synthetic data only.
- **Push after every commit.** No accumulating local commits.
- **Browser-verify must pass before claiming steady state.** Non-negotiable.
- **Per-tick scope = one focused unit.** No half-state in the working tree at end of tick.

## State files

**Read** (canonical source-of-truth):
- `docs/specs/0001-mvp0-coverage-negotiation.md`
- `docs/specs/0002-demo-experience-and-integration-seam.md`
- `docs/specs/0003-token-flow-visibility.md`
- `docs/specs/0004-data-and-evidence-model.md`
- `docs/technical-design/appeal-ladder-enforcement.md`
- `docs/reference/ui-prototype-handoff/project/{index.html, app.jsx, screens.jsx, visuals.jsx, tweaks-panel.jsx, data.jsx}` (design SoT)
- `docs/research/spec-0004-research-prompts.md`

**Write** (loop state + reports — each tick refreshes the relevant ones):
- `docs/progress/loop-state.md` — main state (mode, tick, queue, verdicts)
- `docs/progress/coverage.md`
- `docs/progress/design-conformance.md`
- `docs/progress/security-findings.md`
- `docs/progress/solidity-compliance.md`
- `docs/progress/strict-review-findings.md`
- `docs/progress/browser-verify.md`

## Subagent model assignments

| Subagent | Model | Purpose |
|---|---|---|
| planning | **Sonnet** | Pick next focused unit from state + specs |
| dev | **Sonnet** | Implement the code |
| TDD | **Sonnet** | Write the failing test first; verify dev's pass |
| coverage | **Sonnet** | Run coverage; report per-spec gaps |
| design-conformance | **Sonnet** | Compare UI tree to prototype; queue gaps |
| browser-verify | **Sonnet** | Drive live UI via the `agent-browser` skill (`.claude/skills/agent-browser/SKILL.md`); assert scenarios. The subagent MUST load the skill (and run `agent-browser skills get core` for the version-matched workflow guide) before issuing any browser commands. `agent-browser` lives at `~/.npm-global/bin/agent-browser` and is NOT on the default PATH — prepend it explicitly. |
| solidity-compliance | **Opus** | Critical gate — reentrancy, access control, gas, OZ patterns |
| security-review | **Opus** | Critical gate — `/security-review` skill on diff |
| strict-review | **Opus** | **Critical gatekeeper — total stickler. Zero findings required for steady state.** |

Invoke via the Agent tool with `subagent_type: general-purpose` and explicit `model: sonnet` or `model: opus` per the table.

## Per-tick procedure

### Phase 1 — Orient

1. `git status` — must be clean on `spec-4-implementation`. If dirty, investigate; commit cleanly or stash with a tagged message before continuing.
2. Read `docs/progress/loop-state.md` (mode, tick, queue, last focus).
3. `git log --oneline -10` for recent context.

### Phase 2 — Plan (Sonnet)

Dispatch one planning subagent. Inputs: loop-state.md, the four specs, the most recent strict-review + security findings, current mode. Output: one focused unit of work with a clear acceptance criterion.

Valid impl-mode units:
- "Implement R10a write-Lambda for the Curie packet store; landing test T4 + T5."
- "Address strict-review finding from tick 14: timeline doesn't backfill prior events on Detail mount."
- "Bring `web/src/components/CreateScreen.tsx` into structural conformance with the prototype's `CreateScreen` in `screens.jsx`."

Valid creativity-mode units:
- "Draft `creativity/expedited-paths` exploring expedited Part D timelines per SPEC-0004 §2.4 open items."

### Phase 3 — Fan out (parallel where independent)

Impl mode: dispatch **dev** + **TDD** subagents in parallel for the focused unit.
Creativity mode: dispatch one **dev** subagent on a freshly-created `creativity/<feature>` branch.

### Phase 4 — Integrate

- Reconcile dev + TDD diffs.
- Run `pnpm lint` (or repo's lint command) — must pass.
- Sanity scan: no half-written code, no `TODO` / `FIXME` introduced, no commented-out blocks left behind.

### Phase 5 — Verify (the gate)

**Every gate must be green before committing.** Failing any gate → do NOT commit; re-queue the unit with the findings as context for next tick.

1. **Tests** — run all: `npx hardhat test`, `pnpm test` (vitest), web E2E, **`npm run check-ruling-abi`** (asserts the orchestrator's `scripts/lib/ruling-abi.ts` encoder type-list matches the contract decoder literal at `CoverageNegotiation.sol:661` AND round-trips 5 sample rulings — SPEC-0004 R26 repurposed under Amendment 0006, see [`../amendments/0006-self-hosted-arbiter-agent.md`](../amendments/0006-self-hosted-arbiter-agent.md); cheap, chain-independent, catches drift introduced by changes to either side). **100% pass.**
2. **Coverage subagent** (Sonnet) — runs coverage tool, writes `docs/progress/coverage.md`. **≥ 85% line + branch** across `src/`, `contracts/`, `web/src/`.
3. **Design-conformance subagent** (Sonnet) — compares current `web/src/` tree to the prototype source files in `docs/reference/ui-prototype-handoff/project/`. Writes `docs/progress/design-conformance.md`. **≥ 90% conformance** (component tree alignment + key text + key affordances; NOT pixel-diff — read JSX/HTML directly per the prototype's own README).
4. **Secret-scan** — scan the diff vs `origin/main`. Use `gitleaks detect --no-banner --redact` if installed; else inline regex pass (`-----BEGIN [A-Z]+ PRIVATE KEY-----`, `0x[0-9a-fA-F]{64}`, `sk-[A-Za-z0-9]{32,}`, `xox[bpa]-[A-Za-z0-9-]+`, AWS/GCP key patterns). **Zero findings.**
5. **Solidity-compliance subagent** (**Opus**, total stickler) — reviews `contracts/` diff. Looks for: reentrancy, missing access control, integer overflow/underflow (post-0.8.x checks), unbounded loops, missing event emits, storage-layout breaks, gas anti-patterns, OZ-pattern non-adherence. Writes `docs/progress/solidity-compliance.md`. **Zero findings.**
6. **Security-review subagent** (**Opus**, total stickler) — runs the `/security-review` skill mental model on the diff. Writes `docs/progress/security-findings.md`. **Zero findings.**
7. **Strict-review subagent** (**Opus**, total stickler — the gatekeeper) — reviews diff against relevant R-numbered requirements + entire codebase context. Looks for:
   - Over-engineering, abstraction bloat
   - Weak tests (asserts presence but not correctness; mocks where integration is needed)
   - Missing edge cases (empty/large input, concurrent calls, reverts)
   - Dead code, unused exports
   - Comments that lie or restate what the code already says
   - Spec drift (implementation diverges from R-requirement intent)
   - Backwards-compat hacks introduced without explicit justification
   - "Three similar lines" copy-paste that should have been DRY'd; OR premature abstractions
   Writes `docs/progress/strict-review-findings.md`. **Zero findings required.**
8. **Browser-verify subagent** (Sonnet) — invokes the `agent-browser` skill (`.claude/skills/agent-browser/SKILL.md`) and follows its snapshot-and-ref workflow (`agent-browser skills get core` for the live guide) to drive the web UI against the deployed contract on Somnia testnet. Existing scenarios live in `web/tests/agent-browser/run.sh`; new R20-R23 per-affordance scenarios extend that file. The CLI is at `~/.npm-global/bin/agent-browser` — export `PATH="$HOME/.npm-global/bin:$PATH"` before invoking. Scenarios:
   - **R2:** all 3 curated cases — `partd-approvable`, `commercial-policy-void`, `medicaid-denied-then-appealed` — full end-to-end (create → submit evidence → arbiter ruling → settlement/appeal).
   - **R2a:** custom-case path — autofill from a curated case, edit at least 2 fields, create real on-chain contract.
   - **R2b T2b suite:**
     - T2b-1: two distinct EOAs each show their own address + balance in the wallet chip.
     - T2b-2: wallet A creates contract with `payerAddr = address(B)`; wallet B sees it in their list within one polling window.
     - T2b-3: B's `accept` succeeds; A's `accept` reverts with a clear error.
     - T2b-4: on Approve, settlement recipient = `providerAddr` (wallet A).
     - T2b-5: disconnect/reconnect with different key updates the chip + contracts list.
     - T2b-6: custom case with `providerAddr == payerAddr` is rejected at create.
   Writes `docs/progress/browser-verify.md`. **All scenarios green required.**

### Phase 6 — Commit + push

If all gates green:
- **Single** commit with a conventional message: `feat(<scope>): <focused-unit-description>` or `fix(<scope>): ...` etc.
- Body: 2–4 bullets explaining what landed, the test added, which spec R it satisfies.
- Footer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Update `docs/progress/loop-state.md` (increment tick, record focus completion, refresh verdict table).
- **`git push origin spec-4-implementation`** — every commit pushed. No exceptions.

### Phase 7 — Self-assess (steady-state check only)

Run the steady-state check. **Do NOT run any token-budget check** — that logic is
deprecated (see "On token budget" at the top). All of:

- 100% of R-numbered requirements (specs 0001–0004) have ≥ 1 passing test.
- All tests pass.
- Coverage ≥ 85% line + branch across `src/`, `contracts/`, `web/src/`.
- Solidity-compliance: NO findings.
- Security-review: NO findings.
- Strict-review: NO findings.
- Browser-verify: all R2/R2a/R2b scenarios green.
- Design-conformance: ≥ 90%.

### Phase 8 — Decision tree

| Condition | Action |
|---|---|
| impl + steady-state criteria all met | Tag `steady-state-YYYY-MM-DD-N`; push tag; set mode=`creativity` in loop-state.md; commit + push; continue next tick. |
| impl + any gate failed | Update loop-state.md queue with the findings as the top-priority item; continue next tick. |
| impl + a gate could not run (e.g. no tokens left to dispatch the subagent) | Skip it for THIS tick only — note it in loop-state.md so next tick re-runs that gate before relying on its verdict. Continue next tick. |
| creativity + branch ready | Push `creativity/<feature>`; open PR against `main` via `gh pr create`; record PR # in loop-state.md; continue next tick. |

## Tag naming

- `start` — marks the loop-setup commit (pre-tick 0). Added once at setup.
- `steady-state-YYYY-MM-DD-N` — N starts at 1, increments per day if multiple.

## Where the wallet + chain config live

- Dev wallet address: `0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128` (refill at https://testnet.somnia.network/ or via the Discord faucet; check balance at https://shannon-explorer.somnia.network/address/0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128).
- Deployed contract: `0x1dC5bA6771A7f4426ABE5BB808a7d51BdEA33E1A`.
- Agent fee: `350000000000000000` wei (0.35 STT per ruling).
- RPC: `https://api.infra.testnet.somnia.network/`. WebSocket: `wss://api.infra.testnet.somnia.network/ws`.
- Explorer: https://shannon-explorer.somnia.network/.
- Chain ID: `50312` (Somnia Shannon Testnet).

Private key (`PRIVATE_KEY` / `VITE_PRIVATE_KEY`) lives only in `.env` (gitignored). Never log it, never echo it, never include it in any subagent prompt.

## First-tick bootstrap

If `docs/progress/loop-state.md` shows tick `0` and mode `impl` with an empty queue:
- Planning subagent reads all four specs end-to-end + the design SoT + current `web/`, `src/`, `contracts/` trees, and produces an initial **top-priority queue** of 5–10 focused units.
- Pick the highest-priority unit; proceed through phases 3–8.
- Tick counter advances to 1.

After the loop's first commit, `start` tag persists at the prior commit so you can always `git diff start..HEAD` to see what the loop has done.

# Amendment 0006 — Self-hosted arbiter agent via off-chain orchestrator

**Date:** 2026-05-30
**Status:** Proposed (design — not yet implemented)
**Authored from:** SPEC-0004 §2.7 R25 + tick-98/99 research findings
(`docs/research/agent-abi-drift-2026-05-30.md`). Probe of the live
Somnia AgentRegistry concluded that the somnia-agent-kit ABI shape
does NOT match the deployed implementation at
`0xC0D5aaF9C2E2f87f94AFf8B77C44891f99A1d764`, so base agents like
`12875401142070969085` (LLM Parse Website) are likely platform-built-in
primitives we cannot influence. Option (c) "self-deploy a controlled
agent" is the only viable path to unblock real-mode adjudication.

## The decision

Curie will run its own **off-chain orchestrator** acting as the agent
platform from the contract's point of view. The contract emits an
adjudication-requested event; an off-chain script (running OpenAI or
Anthropic) listens for the event, runs the LLM with the policy + evidence
context, and submits the ruling back to the contract via the existing
`handleResponse(requestId)` callback path. We become the trust root for
the ruling; no Somnia validator consensus.

## Why this resolves R25

The blocker per PR #14: validators reject our calldata at viem ABI-decode
because the registered ABI for agent id `12875401142070969085` doesn't
recognise our selector `0x4be9280f`. The fix space is bounded:

| Option | Status | Notes |
|---|---|---|
| (a1) Reverse-engineer validator ABI | downgraded — heavy, fragile | Need access to validator runtime; even if found, upstream can change it |
| (a2) Fetch agent's IPFS metadata | tick-99 probe: infeasible | Registry doesn't expose the shape we expect; base agents likely aren't in this registry |
| (b) Switch to a matching existing agent | possible but heavy | Requires enumerating registered agents + finding one whose registered ABI matches our `ExtractANumber` signature |
| **(c) Self-host the agent off-chain** | **adopted here** | We control the selector + the LLM call; no third-party drift can happen |

With option (c) we are the agent platform, so:
- AGENT_ID becomes meaningless (we don't fan out to validators)
- AGENT_PLATFORM_ADDRESS is OUR EOA (the orchestrator's wallet)
- The selector our contract emits doesn't need to match anything registered;
  the orchestrator just reads the calldata it's expecting
- The 0.35 STT agent fee stops being a network payment; it flows back to
  our orchestrator wallet on each ruling

## Implementation plan (split across multiple ticks)

### Tick A — `scripts/orchestrator-real.ts` (new)

Off-chain TypeScript script using ethers + the LLM SDK (Anthropic SDK
per the project's existing tooling — see `claude-api` skill):

1. Subscribe to `CoverageNegotiation.AdjudicationRequested` events via
   the existing `wss://api.infra.testnet.somnia.network/ws`.
2. For each event, fetch the negotiation state via the existing
   `getNegotiation(reqId)` view; resolve the off-chain evidence + policy
   (already in the Curie packet store per SPEC-0004 §3.4).
3. Build the arbiter prompt per `docs/technical-design/` (the prompt
   shape SPEC-0004 §2.6 R6 references).
4. Call the LLM, parse the structured ruling (decision + coveredAmount +
   rationaleHash + clauseRef + receiptId per `Ruled` event signature).
5. Submit `handleResponse(requestId)` from our orchestrator wallet (now
   the platform address); contract validates msg.sender ==
   platformAddress and routes the ruling.

### Tick B — `contracts/CoverageNegotiation.sol` (minor)

Already accepts a configurable `AGENT_PLATFORM_ADDRESS`. Confirm the
existing `handleResponse` callback path requires no contract changes
when the "platform" is just an EOA we own — should already work, since
the contract just checks `msg.sender == platformAddress`. Verify and
land any small clarifying-comment edit if needed.

### Tick C — redeploy + reconfigure

Bundle with the pre-existing tick-49/50 10-arg `Ruled` ABI redeploy
debt. One operator action:

1. Redeploy `CoverageNegotiation` with the current 10-arg `Ruled` event
   shape; record new address.
2. Update `.env`: `AGENT_PLATFORM_ADDRESS` = orchestrator EOA;
   `COVERAGE_CONTRACT_ADDRESS` = new address; `VITE_CONTRACT_ADDRESS`
   matches.
3. Start the orchestrator script as a long-running process (or invoke
   per-test for the harness).
4. Run a real-mode harness scenario end-to-end; verify `Ruled` event
   emits with non-zero decision + valid receipt.

### Tick D — SPEC updates

- SPEC-0004 §2.7 R25: mark resolved via this amendment's path; note the
  trade-off (no Somnia validator consensus).
- SPEC-0005 R22: unblocked; can now assert real-mode arbiter rulings in
  the harness.
- SPEC-0003 §2.10 R48/R49: re-runnable — Decision 1 (token-flow) can be
  marked Implemented; R49 fee-burned-vs-fee-paid distinction needs
  re-think because there are no validator `executionCost` entries
  (we paid the LLM provider directly off-chain, and the 0.35 STT
  "agent fee" is just a contract→orchestrator transfer that doesn't
  reflect work done — likely deprecate or repurpose R49 entirely).

## Trade-offs

**Lose:** Somnia validator consensus / decentralised verification of
the ruling. The orchestrator is trusted.

**Gain:** End-to-end real-mode arbitration. Full SPEC-0001 R1 demo
unblocked. Future-proof to the Somnia agent-registry ABI's continuing
drift (we don't depend on it at all).

**Future migration path:** If/when Somnia stabilises a registered ABI
that matches the `ExtractANumber` signature, we can switch
AGENT_PLATFORM_ADDRESS back to the official platform and stop running
the orchestrator. The contract surface stays unchanged — only the
"who calls handleResponse" identity shifts.

## What this amendment does NOT decide

- The exact prompt / LLM / sampling parameters — that's
  `docs/technical-design/arbiter-prompt.md` (currently OPEN per
  `docs/specs/0004-data-and-evidence-model.md` TASK-3).
- The orchestrator's hosting / uptime model — `docs/infra/` is the PM
  agent's purview; for hackathon demo, a tmux/nohup session is fine.
- The exact fee economics — we keep the 0.35 STT transfer for now (it
  pays gas back to the orchestrator) but R49 may want to re-think.

## Open questions

- **OQ-0006-1:** which LLM provider? Default Claude (Anthropic SDK,
  matches the `claude-api` skill in this repo). Confirm before tick A.
- **OQ-0006-2:** how does the orchestrator authenticate the
  CoverageNegotiation events as belonging to OUR deployment vs noise
  from other consumers of the chain? Likely just filter by contract
  address — our address is unique on testnet.
- **OQ-0006-3:** retry / restart story if the orchestrator crashes
  mid-ruling? Probably acceptable for demo; production needs
  idempotency + a watchdog (out of scope for v0).

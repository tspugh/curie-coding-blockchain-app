# Live agent ABI drift — R25 research note (2026-05-30)

> Research-only document for SPEC-0004 §2.7 R25 — the "regenerate /
> switch / self-deploy" decision point. Lands per PR #14 follow-up.
> No code or contract changes; this picks one resolution path for the
> next implementation tick.

## What we know (from PR #14 evidence + tick 94/95 real-mode harness)

The deployed `CoverageNegotiation` at `0x1dC5bA6771A7f4426ABE5BB808a7d51BdEA33E1A`
emits selector `0x4be9280f` from
`ExtractANumber(string,string,uint256,uint256,string,string,bool,uint8)`
against agent id `12875401142070969085` (the LLM Parse Website base agent
per `docs.somnia.network/agents/base-agents/llm-parse-website`).

Validator response from the live agent runtime (PR #14 isolation test):

```
"ABI decode failed (selector=0x4be9280f): Encoded function signature \"0x4be9280f\"
 not found on ABI. Make sure you are using the correct ABI and that the function
 exists on it. … viem@2.46.1"
```

→ Every adjudication finalises with `RequestFinalized(reqId, status=3 Failed)`
without invoking the LLM. The fee is not paid for actual work, just for the
parse-time crash.

Independent confirmation from this loop's tick-94 first-run harness (real
mode, default `.env`-driven build): every write-tx scenario broke after
`createContract` because nothing on chain advances when the agent's call
fails before LLM execution. See `docs/progress/browser-verify.md` tick 94/95.

## What the AgentRegistry actually contains

Reading `docs/reference/somnia-agent-kit/agent-registry.md` carefully, the
on-chain agent registry stores per-agent:

```solidity
struct Agent {
    string name;
    string description;
    string ipfsMetadata;     // <-- ABI / capability schema lives in IPFS
    address owner;
    bool isActive;
    uint256 registeredAt;
    uint256 lastUpdated;
    string[] capabilities;   // <-- free-form strings, NOT function signatures
    uint256 executionCount;
}
```

**Key finding:** the on-chain `AgentRegistry` does NOT carry a Solidity-style
ABI directly. The "registered ABI" PR #14 refers to is implicit — embedded in:

1. The validator runtime (each validator node's agent harness has its own
   hard-coded understanding of the base agent's function signature).
2. Possibly the IPFS metadata blob at `ipfsMetadata` for custom agents
   (haven't verified — would need `getAgent(12875401142070969085)` + IPFS fetch).

This means PR #14's resolution option (a) — "Regenerate `IParseWebsiteAgent`
from the live registered ABI" — is NOT a simple registry read. It would
require either:

- **(a1)** Reverse-engineer what selector the validators DO accept (e.g.
  fire a known-working request and observe what worked, or read the
  validator's open-source harness if available), then add that Solidity
  function signature to `contracts/contracts/ISomniaAgent.sol`.
- **(a2)** Fetch the IPFS metadata blob for agent id 12875401142070969085
  and parse it as the canonical schema (if such a blob exists).

## Resolution options ranked

| Option | Effort | Risk | Notes |
|---|---|---|---|
| **(c) Self-deploy a controlled agent** | Medium (~1-2 ticks: write the agent harness contract, register it, set `AGENT_ID` to the new id) | Low — we own the function signature, so drift cannot happen mid-stream | Recommended for v0 demo path. Loses "LLM Parse Website" branding but stays end-to-end-real. |
| **(b) Switch AGENT_ID to a matching agent** | Medium (discovery work: enumerate agents via `getTotalAgents()` + `getAgent(i)` loop, find one whose registered name/description matches `ExtractANumber` signature) | High — requires trust in a 3rd-party agent we don't own | Workable if (c) is too heavy. |
| **(a1) Reverse-engineer validator-accepted ABI** | Heavy (need access to validator runtime or empirical fire-and-observe) | High — even if found, the upstream operator can change it again | Not recommended. |
| **(a2) Fetch IPFS metadata** | Light (read AgentRegistry, follow IPFS hash) | Medium — depends on whether agent owner kept metadata current | Worth attempting as a quick check before committing to (c). |

## Tick-99 probe results (option a2 ATTEMPTED, RESULT: infeasible without further reverse-engineering)

Ran `contracts/scripts/probe-agent-abi.ts` against the live Somnia testnet
registry at `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A`:

```
registry getTotalAgents() reverted: execution reverted
registry getAgent(12875401142070969085) reverted: deferred error during ABI decoding triggered accessing index 0
```

Both calls reverted. The somnia-agent-kit AgentRegistry ABI shape does
NOT match what's actually deployed at that address. Follow-up probes
revealed:

- The address is an **EIP-1967 proxy** (130 bytes of code, starting with
  the standard `0x608…7f360894…` shim). Implementation address read from
  the EIP-1967 implementation slot: `0xC0D5aaF9C2E2f87f94AFf8B77C44891f99A1d764`
  (5939 bytes — `contracts/scripts/read-1967-impl.ts` for the probe).
- Even with the proxy correctly forwarding to the implementation, the
  somnia-agent-kit-shaped calls fail. So either: (i) the implementation
  uses different function names / signatures than the
  somnia-agent-kit doc, OR (ii) base agents like the LLM Parse Website
  (id `12875401142070969085`) are NOT registered through this contract
  at all — they may be platform-built-in primitives registered through
  a different surface.

**Conclusion: option (a2) is infeasible from here without more
investigation.** Continuing to probe would require either: open-source
the platform's actual registry impl (search the verified contract code
on the Shannon Explorer for `0xC0D5…d764`), reverse-engineer the live
ABI from validator runtime sources, or accept that base agents have
no on-chain ABI we can read.

## Updated recommended next implementation tick

**Pivot to option (c) self-deploy.** Write
`contracts/contracts/agents/CurieLLMAgent.sol` that implements the
`IAgentRequester` callback contract directly (the platform interface
we already mirror at `contracts/contracts/ISomniaAgent.sol`). Deploy
it, point `AGENT_ID` / `AGENT_PLATFORM_ADDRESS` at the new contract,
redeploy `CoverageNegotiation` to call our own selector. Bundle with
the pre-existing tick-49+50 redeploy debt (the 10-arg `Ruled` ABI):
one operator action, all three wins.

The diagnostic scripts (`probe-agent-abi.ts`, `check-registry-bytecode.ts`,
`read-1967-impl.ts`) stay in `contracts/scripts/` as reusable tooling
for future drift sweeps.

## Original recommended next implementation tick — SUPERSEDED by probe results above

**1. Quick check — option (a2):** call `AgentRegistry.getAgent(12875401142070969085)`
via RPC, fetch `ipfsMetadata`, see if it carries a current ABI. Cheap — one
RPC + one IPFS read. If it does, regenerate the Solidity interface from it
and redeploy `CoverageNegotiation` with the new selector.

**2. Fallback to (c) — self-deploy:** write
`contracts/contracts/agents/CurieLLMAgent.sol` implementing the same
`ExtractANumber` signature the validators run; deploy it via Hardhat;
register it; update `AGENT_ID` constant + `.env` `AGENT_ID`; redeploy
`CoverageNegotiation`. This puts us in control of the drift loop and
unblocks SPEC-0003 R48, SPEC-0005 R22, and the R1 full-loop integration
test. Documentation of the self-deploy and its tradeoffs goes into
`docs/amendments/000N-self-hosted-arbiter-agent.md`.

**Either path requires a contract redeploy.** That's already a known
operator action (per `loop-state.md` Operator notes for ticks 49+50 —
the `Ruled` event ABI extension). Bundling R25's redeploy with the
49+50 redeploy is the right move; do it once, get both wins.

## Open questions for next planner

- **OQ-R25-1:** Is the somnia-agent-kit AgentRegistry at
  `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` the same one base agent
  `12875401142070969085` is registered against? (Plausible but unverified.)
- **OQ-R25-2:** For self-deploy (option c), where does the LLM actually run?
  The agent contract just declares the interface; the off-chain validator
  network runs the LLM. We'd need to either (i) extend the existing
  validator network to know about our new agent id, or (ii) bring our own
  validator. Option (i) is what the registry's "registration" actually
  unlocks if the validators auto-pick-up newly-registered agents matching
  certain capability strings; option (ii) is heavier.
- **OQ-R25-3:** Cost: redeploying `CoverageNegotiation` requires a funded
  deployer wallet. The `0x2040…9128` dev wallet has ~6 STT per tick-95
  harness logs — enough for one redeploy. Confirm before firing.

## Status

This research note unblocks tick-99-or-later implementation work. The
next tick should pick option (a2) (cheap probe) and report back; if (a2)
yields a usable ABI, regenerate + redeploy; if not, scope option (c) as
a separate spec amendment.

Tracked in `docs/progress/loop-state.md` queue as SPEC-0004 R25 sub-units.

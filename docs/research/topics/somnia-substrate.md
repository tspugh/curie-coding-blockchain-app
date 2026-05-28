---
title: Somnia Substrate — Chain Capabilities Hub
type: topic-hub
status: navigation
---

# Somnia Substrate

A navigation hub for everything in `docs/research/` about **what the Somnia chain itself does** — the substrate-level properties cliqueue depends on but does not control. Finality, gas model, EVM hardfork level, precompiles, event subscription mechanics, ZK verification options.

> This file is **navigation, not content**. Every claim about Somnia lives in the linked source file; please follow the link before citing.

See also: [[dispute-window]] · [[settlement-stablecoin]] · [[upgradeable-proxy]] · [[corti]] · [[README]] (topics index) · [[../../INDEX|docs index]]

---

## Why this hub exists

Most of the other hubs ask thematic questions ("how does this PA workflow work?", "is this HIPAA-compliant?"). The files here ask a different question: **does Somnia, as deployed, actually support what cliqueue needs to do?**

Those files are scattered across topics — finality affects [[dispute-window]] and [[settlement-stablecoin]]; EVM hardfork level affects [[upgradeable-proxy]]; eth_subscribe affects [[dispute-window]] and [[prior-auth]] events; precompiles affect on-chain proof verification. Reading them as a cluster makes the picture coherent: *here's what we're assuming about the chain, and where the assumptions came from.*

---

## Performance & gas model

What Somnia performs at, and what it costs.

- [[../somnia/finality-tps-and-gas-model|Somnia finality, TPS, and gas model]] — the baseline performance numbers cliqueue's whole cost story depends on.
- [[../somnia/per-claim-gas-economics-llm-inference-cost|Per-claim gas economics vs. LLM inference cost]] — applied gas analysis: does a claim's on-chain + off-chain cost fit under $4–10 outsourced-coding benchmark?
- [[../somnia/eth-subscribe-topic1-filter-somnia-log-gas-costs|eth_subscribe topic[1] filter + LOG opcode gas costs]] — gas cost of indexed-event filtering, which dispute-listener middleware depends on.

## EVM compatibility & precompiles

What Solidity features and precompiles actually work.

- [[../somnia/evm-hardfork-level-paris-and-canary-tests|Somnia EVM hardfork: Paris confirmed + canary contract tests]] — confirms Paris hardfork level; what `immutable`, `block.basefee`, ERC-7201 namespaced storage need to work.
- [[../somnia/ecpairing-precompile-canary-and-bls12-alternative|ecPairing precompile canary + BLS12-381 alternative]] — does Somnia's BN254 precompile work as expected, and what's the BLS12-381 fallback if not?

## Event subscription & indexing

How off-chain consumers (dispute-listener, indexers) follow on-chain state.

- [[../somnia/data-streams-sdk-vs-eth-subscribe-topic-filtering|Somnia Data Streams SDK vs. eth_subscribe — topic filtering]] — the two subscription mechanisms and when to prefer which.
- [[../somnia/eth-subscribe-topic1-filter-somnia-log-gas-costs|eth_subscribe topic[1] filter + LOG opcode gas costs]] *(also under [Performance & gas](#performance--gas-model))*
- [[../somnia/ormi-subgraph-abi-format-interface-vs-implementation|Ormi subgraph ABI format — interface vs. implementation]] — what the project's indexer (Ormi subgraph) sees about contracts; affects ABI design.
- [[../somnia/ormi-subgraph-uups-upgrade-workflow|Ormi subgraph UUPS upgrade workflow]] — operational workflow for re-indexing on UUPS upgrades.

## ZK proof verification

The menu of "how do we verify off-chain compute on-chain?"

- [[../somnia/zkverify-somnia-chain-support-and-alternatives|zkVerify — Somnia support + alternatives]] — does Somnia support a turn-key ZK verifier, and what are the fallbacks?
- [[../somnia/tee-attestation-on-chain-verification|TEE attestation on-chain verification — Phala + Somnia]] — an alternative trust model that uses on-chain TEE attestation verification.
- [[../somnia/ecpairing-precompile-canary-and-bls12-alternative|ecPairing precompile + BLS12-381 alternative]] *(also under [EVM compatibility](#evm-compatibility--precompiles))* — what proof systems are actually runnable on top of Somnia's precompiles.

## Agent runtime model

The two "where does the agent live?" choices Somnia offers.

- [[../somnia/native-agents-vs-agent-kit|Somnia native agents vs. somnia-agent-kit]] — chain-resident agents vs. off-chain agents using the SDK; cliqueue uses the SDK, but this is the framing decision.
- [[../somnia/phase2-custom-agents-and-llm-model-opacity|Phase 2 custom agents + LLM model opacity]] — what changes when Somnia's Phase 2 makes custom agents deployable.
- [[../somnia/infer-tools-chat-mcp-endpoint-network-requirements|inferToolsChat mcpServerUrls — network requirements]] — Somnia's on-chain MCP-call mechanism and what it requires of off-chain endpoints. *Primarily a [[corti]] integration question, but lives substrate-side.*
- [[../somnia/llm-inference-callback-latency-and-timeout|LLM Inference callback latency + timeout]] — practical latency bounds for the on-chain → off-chain inference round trip.

## Anchoring & audit substrate

Files about what's anchored on-chain and what audit guarantees that gives.

- [[../somnia/heuristic-version-on-chain-anchoring|Heuristic version on-chain anchoring — OIG audit trail]] — anchoring the routing-heuristic version on-chain so OIG audits can replay decisions.
- [[../somnia/offchain-pubsub-phi-messaging-architecture|Off-chain pub-sub / PHI messaging architecture]] — the off-chain channel that pairs with on-chain anchoring (without crossing the PHI boundary).
- [[../somnia/mcp-reverse-proxy-auth-without-url-key|MCP reverse-proxy auth without URL-embedded key]] — auth pattern for inbound traffic to MCP servers Somnia calls.

## Operational / log

- [[../log|CliQueue Research Log]] — chronological substrate mentions.
- [[../research-questions|Open Research Questions]] — open Somnia-substrate questions still waiting on investigation.

---

## How to extend this hub

When you add a new research file about a Somnia chain capability:

1. **Ask: is this about something Somnia *does*, or about how cliqueue *uses* Somnia?** Substrate files are about chain capabilities; if it's about a specific PA / SBT / dispute design, prefer the matching thematic hub.
2. Place it under **Performance & gas** / **EVM compatibility** / **Event subscription** / **ZK proof verification** / **Agent runtime model** / **Anchoring & audit substrate**.
3. Add one line: `- [[relative-path|Title]] — what this file argues, in ≤ 12 words.`
4. Do **not** copy content into this hub.

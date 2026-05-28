---
title: Dispute Window Architecture — Topic Hub
type: topic-hub
status: navigation
---

# Dispute Window Architecture

A navigation hub for everything in `docs/research/` about the **dispute window** — the post-submission interval during which a claim can be challenged before settlement is final.

> This file is **navigation, not content**. Every claim about disputes lives in the linked source file; please follow the link before citing.

See also: [[settlement-stablecoin]] · [[prior-auth]] · [[hipaa]] · [[README]] (topics index) · [[../../INDEX|docs index]]

---

## Frame: BFT finality vs application-layer dispute

The dispute window in this project is **distinct from chain finality**. Somnia's BFT finality settles the *transaction*; the application-layer dispute window decides when the *claim's economic effect* (settlement) is irrevocable. These two clocks coexist — most of the research in this cluster works out where one ends and the other begins.

The four design surfaces:

| Surface             | Question                                                              |
|---------------------|------------------------------------------------------------------------|
| **Event**           | What is emitted to signal a dispute? When? Carrying what?              |
| **Storage**         | Where does dispute state live — in the claim struct or a separate registry? |
| **Listener**        | How does off-chain middleware subscribe to disputes reliably?          |
| **Window governance** | What is the minimum dispute window, and how is it changed?           |

---

## Event design

- [[../somnia/claim-disputed-event-websocket-subscription|`ClaimDisputed` event design + Somnia WebSocket subscription]] — the event and its subscription model.
- [[../somnia/staffing-floor-reached-event-design|`StaffingFloorReached` event — design, gas cost, HIPAA analysis]] — adjacent; an event whose state affects whether a dispute can resolve.
- [[../somnia/iclaimsadjudicator-event-registry-interface-design|IClaimsAdjudicator interface-level event registry]] — the typed event registry that dispute events sit in.

## Storage architecture

- [[../somnia/claims-dispute-registry-separate-vs-erc7201-internal|ClaimsDisputeRegistry — separate contract vs ERC-7201 internal storage + UUPS upgrade]] — where dispute state lives.
- [[../somnia/claim-struct-packing-cold-sload-dispute-architecture|Claim struct packing + cold-SLOAD dispute architecture]] — gas/layout cost of fetching the claim during dispute.

## Listener / middleware

- [[../somnia/dispute-listener-middleware-deployment-baa-obligations|Dispute-listener middleware deployment model + BAA obligations]] — operational deployment shape, with HIPAA implications.
- [[../somnia/dispute-listener-websocket-connection-affinity|Dispute-listener WebSocket connection affinity + missed-event recovery]] — robustness under disconnect.
- [[../somnia/eth-subscribe-topic1-filter-somnia-log-gas-costs|`eth_subscribe` topic[1] filter + LOG opcode gas costs]] — the subscription-filter mechanic used to scope dispute events.
- [[../somnia/data-streams-sdk-vs-eth-subscribe-topic-filtering|Data Streams SDK vs `eth_subscribe` — topic filtering]] — the SDK-level alternative.

## Window governance & finality

When does the dispute window close, who can change the floor, and how does that interact with chain finality?

- [[../somnia/dispute-window-floor-governance-baa|`disputeWindowSeconds` minimum floor — timelock + hospital BAA settlement finality]] — the floor; who controls it.
- [[../somnia/oppc-challenge-window-bft-finality-architecture|Somnia OpPC challenge window — BFT finality vs application-layer dispute window]] — the two-clock distinction.
- [[../somnia/finality-tps-and-gas-model|Somnia finality, TPS, and gas model]] — the chain-side finality the dispute window sits on top of.

## Adjacent fund-release & resolution paths

How dispute interacts with fund release and PA resolution.

- [[../agreement-layer/conditional-fund-release-state-machine|Conditional fund release — 5-state machine]] — the settlement state machine the dispute pauses or unwinds.
- [[../agreement-layer/claim-replacement-resubmission-onchain|Claim replacement / resubmission on-chain]] — disputed claim resubmission path.
- [[../agreement-layer/rfi-denial-pathway-paauthash-on-chain-scope|RFI denial pathway — on-chain `paAuthHash` scope]] — denial path that can lead into dispute.
- [[../somnia/heuristic-version-on-chain-anchoring|Heuristic version on-chain anchoring — OIG audit trail]] — the anchored version data that dispute resolution can reference.
- [[../somnia/tee-attestation-on-chain-verification|TEE attestation on-chain verification]] — alternative trust path that may obviate some disputes.

## Operational / log

- [[../log|CliQueue Research Log]] — chronological dispute-window mentions; use as a timeline.
- [[../research-questions|Open Research Questions]] — open dispute-related questions still waiting on investigation.

---

## How to extend this hub

When you add a new research file that touches the dispute window:

1. Place it under the surface it asks about (**Event design** / **Storage architecture** / **Listener** / **Window governance** / **Adjacent fund-release**).
2. Add one line: `- [[relative-path|Title]] — what this file argues, in ≤ 12 words.`
3. Do **not** copy content into this hub.

# Somnia Agentathon

**Hosted by [Encode Club](https://www.encodeclub.com) in partnership with [Somnia](https://somnia.network)**

## Overview

The **Somnia Agentathon** is a hackathon programme run by Encode Club, focused on generating real-world use cases for **Somnia's newly launched Agentic L1 infrastructure**. Participants are challenged to build with Somnia's high-performance, EVM-compatible Layer 1 blockchain — purpose-built for AI agents and real-time decentralised applications — with the ultimate goals of launching startups or landing roles in the Web3/AI space.

## About Somnia

Somnia is the **Agentic L1** — a hyper-performant layer-1 blockchain designed from the ground up for AI agents and real-time decentralised applications. Key technical highlights include:

- **1M+ TPS** throughput via MultiStream consensus
- **Sub-second finality** and ultra-low transaction fees
- **Fully EVM-compatible**, making it accessible to the broad Ethereum developer ecosystem
- Built by the **Virtual Society Foundation (VSF)** with Improbable and MSquared
- Supports smart agents, game bots, AI-driven NPCs, and real-time interactive environments

---

## A Mental Model: Blockchain as a Railway Network

Before the technical primer, here's an analogy that tends to make the rest click.

A blockchain is closer to a **railway network** — or more precisely, the **shipping container standard** — than it is to a brain, a government, or a database.

- **Standard gauge.** Once railways agreed on a track width, any company's train could run on any company's tracks. EVM-compatible chains like Somnia work the same way: standard "gauge" means any app can run on the rails, and apps from different builders compose without bespoke integration.
- **Neutral infrastructure.** The rails don't care whether you're shipping coal, mail, or passengers. The chain doesn't care whether you're moving payments, identity attestations, or agent messages.
- **Permissionless access.** Any operator who follows the standard can put a train on the tracks. Any developer can deploy a contract.
- **Scheduling is the hard part.** Railways need signalling so trains don't crash; chains need consensus so transactions don't conflict. *That's the core job the chain is doing.*
- **Network effects.** One rail line is useless. A thousand interconnected lines is transformative. Same with chains and the apps on top of them.

The shipping-container version sharpens it further: before standard containers, every port had its own equipment and every ship its own loading process. After standardisation, a container could move from a Shenzhen factory to an Indianapolis truck without ever being unpacked. That portability — independent operators interoperating without renegotiating rules — is what blockchains buy you for digital value and state.

**Why this matters for the agentic era:** think of AI agents as **autonomous shipping companies**. They don't have time to negotiate a custom protocol with every counterparty. They need rails. Somnia's pitch is essentially *the container standard for AI agents* — neutral, standardised, fast enough that machine-speed coordination actually works.

> **Why not a brain, government, or distribution?** Brains are great at pattern-matching but have no shared ledger or consensus. Governments rely on trusted institutions to enforce the rules — the opposite of what a blockchain does. Statistical distributions describe how things spread, not how strangers reach agreement. The railway analogy is the one that captures *neutral, standardised, permissionless infrastructure* — the actual core of what a blockchain provides.

---

## Why Blockchain? A Primer

Blockchain is, at its core, a **shared, append-only ledger** maintained by a network of independent computers rather than a single company. A few properties fall out of that design that are hard to replicate any other way:

- **Trust without a trusted party** — counterparties who don't know each other can transact, agree, and settle without a central referee
- **Verifiability** — anyone can independently check what happened, when, and by whom (cryptographic signatures + public history)
- **Programmable money and assets** — value moves at the speed of code via smart contracts; no waiting for banking rails
- **Open composability** — apps and protocols plug into each other like Lego, without needing API permission from a gatekeeper
- **Persistence and censorship resistance** — once committed, records can't quietly disappear or be rewritten by one actor
- **Native digital ownership** — tokens, NFTs, and credentials that belong to a user (or an agent) rather than to a platform's database

Historically, blockchain has been most useful where **coordination between strangers** matters more than raw throughput: payments, settlement, ownership records, identity, and supply-chain provenance.

## Why Blockchain Matters in the Agentic Era

Autonomous AI agents change the equation dramatically. A few reasons blockchain pairs naturally with agents:

1. **Agents need wallets, not credit cards.** Agents act 24/7, often in microtransactions, across many services. Card networks, KYC flows, and human-in-the-loop approval don't scale to a million autonomous actions per day. Onchain accounts give agents native, programmable spending power with **enforceable spending limits and policies**.

2. **Agents need verifiable identity and reputation.** When Agent A hires Agent B for a task, how does A know B isn't a scam or a hallucinating clone? Onchain identity, signed attestations, and persistent reputation history make agent-to-agent trust tractable.

3. **Agents need auditable memory.** A regulator, employer, or counterparty may need to verify *what an agent did and why*. Onchain logs (or hashes anchored onchain) give a tamper-evident record of agent decisions and actions.

4. **Agents need shared coordination state.** Multiple agents acting on the same resource — an inventory, a calendar, a market — need a single source of truth they can all read and write to without one of them being the boss.

5. **Agents need micropayments and machine-native economics.** Per-call payments to data providers, per-token payments to model APIs, per-action payments between agents — all need sub-cent, sub-second settlement that traditional rails simply can't do.

This is exactly the gap an **Agentic L1** like Somnia is built to fill: throughput high enough that agents can transact at machine speed, finality fast enough that one agent's action is *known* by another agent's next action, and EVM compatibility so the existing tooling works.

---

## Project Direction Brainstorm

Here are concrete directions worth exploring for the Agentathon. They're meant as starting points — the strongest submissions usually pick one and go deep.

### 1. Agent-to-Agent (A2A) Communication & Marketplaces

The "agent economy" only works if agents can **find, hire, pay, and verify** each other. Possible builds:

- **An A2A discovery and reputation layer** — a registry where agents publish capabilities (research, scheduling, code review, translation), pricing, and onchain track records. Other agents query it, hire on the spot, and leave signed reviews.
- **Agent escrow contracts** — Agent A pays Agent B for a task, funds are held in a smart contract, and released on verifiable proof of delivery (output hash, signed attestation, oracle check).
- **Negotiation protocols** — onchain message-passing where agents bid, counter-bid, and settle on terms without a human in the middle. Somnia's sub-second finality means a real back-and-forth is possible.
- **Intent-based agent coordination** — a user expresses a high-level intent ("book me a trip under $2k that's beach-adjacent and pet-friendly"), and a swarm of specialist agents (flights, hotels, pet care) bid to fulfill sub-tasks, settling onchain.
- **Sybil-resistant agent identity** — combining proof-of-humanity, stake-based identity, or attestation chains so an agent can't trivially spin up 1,000 fakes to game a marketplace.

### 2. Healthcare

Healthcare is full of coordination problems where blockchain + agents could be transformative — but it's also a regulated, high-stakes domain, so winning ideas usually pair onchain coordination with **off-chain encryption and clear consent flows**. Possible builds:

- **Patient-owned health record vaults** — records live encrypted off-chain (IPFS, Arweave, or a private store); access permissions and audit logs live onchain. The patient's agent grants or revokes access to specialists, insurers, or research studies in real time.
- **Clinical trial recruitment agents** — researcher agents publish trial criteria; patient-side agents (with consent) match against an encrypted profile and surface eligible trials. Payments to participants settle onchain instantly.
- **Insurance claim agents** — claimant's agent assembles documentation, insurer's agent verifies against policy rules in a smart contract, payout executes automatically. Disputes go to a human, but the routine 80% never need one.
- **Verifiable medication supply chains** — every batch of a drug gets an onchain provenance record from manufacture to pharmacy. An agent can verify in milliseconds whether a vial is genuine before administration.
- **Research data marketplaces with consent** — patients license de-identified data to researchers via their agent, with usage-based micropayments and revocable consent, all enforced onchain.
- **Public-health coordination** — during an outbreak, public-health agents from different jurisdictions share aggregated, signed signals (case counts, supply levels) on a neutral ledger no single government controls.

> ⚠️ Healthcare projects need to take **HIPAA/GDPR, PHI handling, and clinical safety** seriously. Even a hackathon prototype should be explicit about what's onchain (pointers, hashes, permissions) vs. off-chain (the actual records).

### 3. Other Strong Directions

- **Autonomous DeFi agents** — agents that rebalance portfolios, hedge risk, or hunt yield on behalf of users, with policy guardrails enforced by smart contracts (max drawdown, allowed protocols, daily spend caps).
- **Agent-driven prediction markets** — agents synthesise news and data, post predictions, stake on them, and build verifiable forecasting reputations over time.
- **Real-time gaming AI** — NPCs, market-maker bots, and dynamic economies in onchain games. This is a natural fit for Somnia given its gaming roots.
- **Supply chain & logistics agents** — agents negotiate freight, track shipments, and settle invoices across companies that don't share databases.
- **Content provenance & IP licensing** — creator's agent registers a work, sets license terms in a smart contract; consumer agents pay per use. Especially relevant as AI-generated content explodes.
- **Decentralised compute & data markets for agents** — agents bid on GPU time, data feeds, or model inference, settling per-call onchain.
- **Personal AI agents with onchain memory** — your agent's long-term memory, preferences, and learned skills are portable and owned by you, not locked in a single provider's servers.

### Picking a Direction — Quick Heuristics

The strongest hackathon projects tend to:

- Solve a problem that **specifically requires both** an agent and a blockchain (if either could be removed, the project is weaker)
- Have a **clear demo loop** — something a judge can watch happen in 90 seconds
- Use Somnia's **performance characteristics** as a real ingredient (high TPS, sub-second finality), not just as a deployment target
- Tell a credible story about the **first 100 users**, not just the architecture

---

## Programme Goals

- Explore and validate **real-world use cases** for Somnia's Agentic L1 infrastructure
- Support participants in building **viable startups** or showcasing skills to get **hired** in the Web3/AI industry
- Bring developers onchain to build the future of the internet through agentic applications

## About Encode Club

Encode Club is a leading Web3 and AI education and community platform that connects developers, entrepreneurs, and innovators. Encode runs hackathons, bootcamps, and accelerator programmes in partnership with top protocols and companies across the blockchain and AI space.

## Links

- **Programme Page:** [encodeclub.com/programmes/agentathon](https://www.encodeclub.com/programmes/agentathon)
- **Somnia Network:** [somnia.network](https://somnia.network)
- **Encode Club:** [encodeclub.com](https://www.encodeclub.com)

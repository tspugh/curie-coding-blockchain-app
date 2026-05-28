# MVP0 Plan — Curie Claims Protocol

**Target:** Somnia Agentathon hackathon — 4-week sprint
**Phase:** MVP0 — End-to-end claim negotiation flow
**Date:** 2026-05-19

---

## Goal

Build the absolute minimum working end-to-end chain flow that demonstrates **Curie Claims Protocol**:

> An agentic claims settlement protocol where provider and payer agents negotiate ICD-10 claim support, anchor audit commitments on Somnia, and settle approved claims without putting PHI on-chain.

MVP0 must deliver a **single deterministic demo loop** — the "90-second mph moment" — where a judge can watch:

1. A **provider agent** ingest a synthetic clinical note and propose ICD-10 codes
2. It creates an off-chain claim bundle and **anchors a SHA-256 hash on Somnia**
3. A **payer agent** checks policy rules, **counts** with a lower amount
4. The smart contract records the counter
5. Provider agent submits **evidence hash**
6. Payer agent **agrees** to the counter-amount
7. Smart contract records **agreement and fires a Settle event**
8. A UI panel shows the **full audit timeline** with transaction hashes

This proves blockchain adds value (shared coordination state, tamper-evident audit, agent identity) without storing PHI.

---

## In Scope

### Smart Contract — `ClaimSettlement.sol`

- States: `Draft`, `Submitted`, `PayerReview`, `Countered`, `EvidenceRequested`, `Agreed`, `Settled`
- Core functions:
  - `submitClaim(providerAgent, payerAgent, claimHash, requestedAmount)` → state → `Submitted`
  - `counterClaim(claimId, counterHash, counterAmount)` → state → `Countered`
  - `requestEvidence(claimId, reason)` → state → `EvidenceRequested`
  - `submitEvidence(claimId, evidenceHash)` → state → `PayerReview`
  - `agreeToClaim(claimId, finalHash, finalAmount)` → state → `Agreed`
  - `settleClaim(claimId)` → state → `Settled`
- Events: `ClaimSubmitted`, `ClaimCountered`, `EvidenceRequested`, `EvidenceSubmitted`, `ClaimAgreed`, `ClaimSettled`
- No payment execution — settlement is simulated (event-only)
- State transitions enforced via `require` guards per state machine

### Agent Registry Integration

- Use **Somnia AgentKit's on-chain `AgentRegistry` contract** (deployed `0xC9f3452090EEB519467DEa4a390976D38C008347` on testnet) for agent identity
- Provider agent and payer agent registered via `registerAgent()` during setup
- Claims reference agent IDs from registry, not raw addresses

### Claim Bundle (Off-Chain)

- JSON structure with `claimId`, `patientRef`, `encounter`, `codes` (ICD-10 with confidence + support spans), `amount`, `evidenceRefs`, `bundleHash`
- No PHI: patient is synthetic (`synthetic-patient-001`), no name/DOB/MRN
- Bundle is stored off-chain (in-memory for demo); the SHA-256 hash is anchored on-chain
- Provider agent can serve reconstructed bundle via `evidenceHash` verification

### Provider Agent

- Ingests synthetic clinical note (TypeScript string input, no LLM for MVP0)
- Outputs structured claim bundle JSON
- Computes SHA-256 hash of bundle
- Calls `submitClaim()` on-chain via `somnia-agent-kit`
- Can `submitEvidence()` with an evidence hash

### Payer Agent

- Receives claim bundle data (off-chain exchange or in-memory reference)
- Applies deterministic policy fixture (e.g., "reimburse 80% of E11.9 outpatient, max $3200")
- Either counter-amount or request evidence
- If evidence provided, evaluate and agree
- Calls `counterClaim()` or `agreeToClaim()` on-chain

### Negotiation Orchestrator

- TypeScript orchestration layer that wires provider agent → contract → payer agent → contract → settle
- Single function call: `runNegotiation(claimScenario: string)` → returns audit timeline
- Deterministic demo scenarios:
  - **Scenario A (Clean Approval):** Provider proposes → Payer agrees immediately → Settle
  - **Scenario B (Counter + Evidence):** Provider proposes → Payer counts → Provider submits evidence → Payer agrees → Settle (MVP0 focus)

### UI — Minimal Audit Dashboard

- Single-page app that shows:
  - "Run Demo Claim" button
  - Audit timeline rendered from contract events
  - State transitions as vertical timeline items
  - Somnia transaction hashes with links to explorer
  - Privacy callout: "Off-chain: clinical bundle | On-chain: hash, state, signatures"

---

## Out of Scope (Deferred to MVP1+)

- **Real LLM integration** — synthetic/deterministic agents for MVP0
- **AgentVault / payment execution** — settlement is event-only, no real payment rail
- **AgentExecutor** — no task execution authorization/gas budgeting
- **Agent Registry custom deployment** — use the existing Somnia deployed `AgentRegistry`
- **Batch claims** — single claim per demo
- **Disputes / Withdrawn states** — not needed for clean demo flow
- **FHIR/X12 integration** — synthetic notes only
- **Real payer policies** — hardcoded fixtures
- **Upgradeable proxy pattern** — simple contract for hackathon
- **ZK proofs** — SHA-256 hashes are sufficient for MVP0
- **Multi-tenant / multi-org** — single demo org
- **Subgraph / indexing service** — direct RPC reads from contract
- **CPT/HCPCS codes** — ICD-10 only
- **Mobile responsive** — desktop demo UI

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DEMO RUNNER / CLI                        │
│  runNegotiation("counter-evidence")                         │
└────────┬───────────────────────────┬────────────────────────┘
         │                           │
         ▼                           ▼
┌──────────────────┐    ┌──────────────────────────┐
│  Provider Agent   │    │     Payer Agent          │
│  (TypeScript)     │    │  (TypeScript)            │
│                   │    │                          │
│  Synthetic Note   │    │  Policy Fixtures         │
│  ↓                │    │  ↓                       │
│  Claim Bundle JSON│    │  Adjudicate → Count/     │
│  SHA-256 Hash     │    │  Agree/Request Evidence  │
└────────┬──────────┘    └──────────┬───────────────┘
         │                          │
         │ send tx                  │ send tx
         ▼                          ▼
┌──────────────────────────────────────────────────────────┐
│              Somnia L1 (Chain ID 50311)                   │
│                                                          │
│  ┌──────────────────────┐    ┌────────────────────────┐ │
│  │ ClaimSettlement.sol   │    │ AgentRegistry.sol      │ │
│  │ (Custom, deployed)   │    │ (Somnia kit, 0xC9f345) │ │
│  │                      │    │                        │ │
│  │ submitClaim(→)       │    │ registerAgent()        │ │
│  │ counterClaim(→)      │    │ getAgent(id)           │ │
│  │ submitEvidence(→)    │    │                        │ │
│  │ agreeToClaim(→)      │    │                        │ │
│  │ settleClaim(→)       │    │                        │ │
│  │                      │    │                        │ │
│  │ Events emitted:      │    │                        │ │
│  │ ClaimSubmitted       │    │                        │ │
│  │ ClaimCountered       │    │                        │ │
│  │ EvidenceSubmitted    │    │                        │ │
│  │ ClaimAgreed          │    │                        │ │
│  │ ClaimSettled         │    │                        │ │
│  └──────────────────────┘    └────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         │
         │ events + view calls
         ▼
┌──────────────────────────────────────────────────────────┐
│                Audit Dashboard (Web)                      │
│                                                          │
│  • Timeline: who proposed what, when, state transitions  │
│  • Somnia tx hash links                                  │
│  • "Off-chain: clinical bundle | On-chain: hash/state"  │
└──────────────────────────────────────────────────────────┘

OFF-CHAIN BOUNDARY ──────────────────────────────────────────
  Stored off-chain:  Synthetic clinical notes
                     Claim bundles (JSON)
                     Evidence documents
                     Policy rules (JSON fixtures)
                     Provider/Payer reasoning (JSON logs)

  On-chain:           Claim state (enum)
                       Amounts (uint256)
                       Hashes (bytes32)
                       Agent IDs (uint256)
                       Timestamps (uint256)
                       Transaction events
```

### Component Responsibilities

| Component | Responsibility | Technology |
|---|---|---|
| `ClaimSettlement.sol` | State machine, hash commitments, events | Solidity, deployed to Somnia testnet |
| `ProviderAgent` | Ingest note, build claim bundle, hash, submit | TypeScript, somnia-agent-kit |
| `PayerAgent` | Policy matching, adjudicate, counter/agree | TypeScript, somnia-agent-kit |
| `Orchestrator` | Wire agents → contract → flow control | TypeScript |
| `DemoRunner CLI` | Single command to run end-to-end demo | TypeScript / CLI |
| `Audit Dashboard` | Display events, state, tx hashes | Next.js or simple HTML+JS |
| `Synthetic Data` | Clinical notes, policy fixtures | JSON files |

---

## Implementation Steps

### Step 0: Repo Scaffold

**File paths:** Create these directories and files
```
curie-claims-protocol/
  contracts/
    ClaimSettlement.sol
    scripts/
      deploy.ts
    tests/
      ClaimSettlement.test.ts
  src/
    index.ts
    types/
      claim.types.ts
    agents/
      provider-agent.ts
      payer-agent.ts
    orchestrator.ts
    utils.ts
  demo-data/
    clinical-notes/
      synthetic-note-001.json
    policies/
      payer-policy-001.json
  web/
    public/
      index.html
  tsconfig.json (update)
  .env.example (update)
```

**Actions:**
1. Create `contracts/`, `demo-data/`, `web/public/` directories
2. Install Foundry: `curl -L https://foundry.paradigm.xyz | bash` then `foundryup`
3. Initialise Hardhat in `contracts/`: `npx hardhat init` (TypeScript + TypeScript + ESLint)
4. Install: `cd contracts && npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts`
5. Update root `tsconfig.json` if needed for project structure
6. Add `contracts/` to root `.gitignore` (contracts have their own `.gitignore`)

### Step 1: Define Data Types (`src/types/claim.types.ts`)

**File:** `src/types/claim.types.ts`

```typescript
/** Claim lifecycle states */
export enum ClaimState {
  Draft = 0,
  Submitted,
  PayerReview,
  Countered,
  EvidenceRequested,
  Agreed,
  Settled,
}

/** Human-readable labels for states */
export const STATE_LABELS: Record<number, string> = {
  0: 'Draft',
  1: 'Submitted',
  2: 'PayerReview',
  3: 'Countered',
  4: 'EvidenceRequested',
  5: 'Agreed',
  6: 'Settled',
};

/** Claim bundle structure — stored off-chain, hash stored on-chain */
export interface ClaimBundle {
  claimId: string;
  patientRef: string;  // e.g., "synthetic-patient-001" — NEVER real PII
  encounter: {
    type: 'outpatient' | 'inpatient';
    date: string;  // ISO date
  };
  codes: Array<{
    system: 'ICD-10-CM';
    code: string;  // e.g., "E11.9"
    description: string;
    support: string[];  // evidence span refs
    confidence: number;
  }>;
  amount: number;  // cents
  evidenceRefs: string[];
  bundleHash: string;  // 0x-prefixed SHA-256
}

/** Adjudication response from payer agent */
export interface AdjudicationResponse {
  claimId: string;
  decision: 'approve' | 'count' | 'requestEvidence';
  counterAmount?: number;  // cents, if count
  counterHash?: string;  // 0x-prefixed SHA-256 of counter offer
  reason?: string;  // plain text reason
  evidenceRequest?: string;  // what evidence is requested
}

/** Audit timeline entry */
export interface AuditEntry {
  step: string;
  timestamp: number;
  party: 'provider' | 'payer' | 'system' | 'contract';
  state: string;
  txHash?: string;
  details?: Record<string, unknown>;
}
```

### Step 2: Smart Contract — `ClaimSettlement.sol`

**File:** `contracts/ClaimSettlement.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ClaimSettlement
 * @notice Agentic claims negotiation and settlement on Somnia.
 * Stores hashes, state, and agent IDs — never PHI.
 */
contract ClaimSettlement {
    // ── States ────────────────────────────────────────────────
    enum ClaimState { Draft, Submitted, PayerReview, Countered, EvidenceRequested, Agreed, Settled }

    // ── Data ──────────────────────────────────────────────────
    struct Claim {
        uint256 providerAgentId;
        uint256 payerAgentId;
        bytes32 claimHash;       // SHA-256 of off-chain claim bundle
        uint256 requestedAmount;
        uint256 finalAmount;
        bytes32 evidenceHash;    // evidence submitted by provider (if requested)
        bytes32 finalHash;       // settled agreement hash
        ClaimState state;
        uint256 createdAt;
        uint256 settledAt;
    }

    // ── Storage ───────────────────────────────────────────────
    mapping(uint256 => Claim) private _claims;
    uint256 private _claimCounter;

    // ── Events ────────────────────────────────────────────────
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed providerAgentId,
        uint256 indexed payerAgentId,
        bytes32 claimHash,
        uint256 requestedAmount
    );

    event ClaimCountered(
        uint256 indexed claimId,
        uint256 indexed payerAgentId,
        bytes32 counterHash,
        uint256 counterAmount
    );

    event EvidenceRequested(
        uint256 indexed claimId,
        uint256 indexed payerAgentId,
        string reason
    );

    event EvidenceSubmitted(
        uint256 indexed claimId,
        uint256 indexed providerAgentId,
        bytes32 evidenceHash
    );

    event ClaimAgreed(
        uint256 indexed claimId,
        bytes32 finalHash,
        uint256 finalAmount
    );

    event ClaimSettled(
        uint256 indexed claimId,
        uint256 finalAmount
    );

    // ── Modifiers ─────────────────────────────────────────────
    modifier onlyState(uint256 claimId, ClaimState expected) {
        require(_claims[claimId].state == expected, "Invalid state transition");
        _;
    }

    // ── Core Functions ────────────────────────────────────────

    function submitClaim(
        uint256 providerAgentId,
        uint256 payerAgentId,
        bytes32 claimHash,
        uint256 requestedAmount
    ) external returns (uint256) {
        _claimCounter++;
        uint256 claimId = _claimCounter;

        _claims[claimId] = Claim({
            providerAgentId: providerAgentId,
            payerAgentId: payerAgentId,
            claimHash: claimHash,
            requestedAmount: requestedAmount,
            finalAmount: 0,
            evidenceHash: bytes32(0),
            finalHash: bytes32(0),
            state: ClaimState.Submitted,
            createdAt: block.timestamp,
            settledAt: 0
        });

        emit ClaimSubmitted(claimId, providerAgentId, payerAgentId, claimHash, requestedAmount);
        return claimId;
    }

    function counterClaim(
        uint256 claimId,
        bytes32 counterHash,
        uint256 counterAmount
    ) external onlyState(claimId, ClaimState.Submitted) {
        Claim storage claim = _claims[claimId];

        claim.state = ClaimState.Countered;
        claim.finalAmount = counterAmount;

        emit ClaimCountered(claimId, claim.payerAgentId, counterHash, counterAmount);
    }

    function requestEvidence(
        uint256 claimId,
        string calldata reason
    ) external onlyState(claimId, ClaimState.Submitted) {
        require(bytes(reason).length > 0, "Reason required");

        Claim storage claim = _claims[claimId];
        claim.state = ClaimState.EvidenceRequested;

        emit EvidenceRequested(claimId, claim.payerAgentId, reason);
    }

    function submitEvidence(
        uint256 claimId,
        bytes32 evidenceHash
    ) external onlyState(claimId, ClaimState.EvidenceRequested) {
        require(evidenceHash != bytes32(0), "Evidence hash required");

        Claim storage claim = _claims[claimId];
        claim.evidenceHash = evidenceHash;
        claim.state = ClaimState.PayerReview;

        emit EvidenceSubmitted(claimId, claim.providerAgentId, evidenceHash);
    }

    function agreeToClaim(
        uint256 claimId,
        bytes32 finalHash,
        uint256 finalAmount
    ) external onlyState(claimId, ClaimState.Countered) {
        require(finalAmount > 0, "Final amount must be greater than zero");

        Claim storage claim = _claims[claimId];
        claim.state = ClaimState.Agreed;
        claim.finalHash = finalHash;
        claim.finalAmount = finalAmount;

        emit ClaimAgreed(claimId, finalHash, finalAmount);
    }

    function settleClaim(uint256 claimId) external onlyState(claimId, ClaimState.Agreed) {
        Claim storage claim = _claims[claimId];
        claim.state = ClaimState.Settled;
        claim.settledAt = block.timestamp;

        emit ClaimSettled(claimId, claim.finalAmount);
    }

    // ── View Functions ────────────────────────────────────────

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return _claims[claimId];
    }

    function getClaimState(uint256 claimId) external view returns (ClaimState) {
        return _claims[claimId].state;
    }

    function getStateName(ClaimState state) external pure returns (string memory) {
        if (state == ClaimState.Draft) return "Draft";
        if (state == ClaimState.Submitted) return "Submitted";
        if (state == ClaimState.PayerReview) return "PayerReview";
        if (state == ClaimState.Countered) return "Countered";
        if (state == ClaimState.EvidenceRequested) return "EvidenceRequested";
        if (state == ClaimState.Agreed) return "Agreed";
        if (state == ClaimState.Settled) return "Settled";
        return "Unknown";
    }

    function totalClaims() external view returns (uint256) {
        return _claimCounter;
    }
}
```

### Step 3: Contract Tests

**File:** `contracts/test/ClaimSettlement.test.ts`

Key test cases (use `chai` + `hardhat` + `ethers` from hardhat-toolbox):

1. **Happy path — Clean approval flow:**
   - Deploy contract
   - `submitClaim()` → state = Submitted ✓
   - `agreeToClaim()` → state = Agreed ✓
   - `settleClaim()` → state = Settled ✓
2. **Counter + Evidence flow:**
   - `submitClaim()` → Submitted
   - `counterClaim()` → Countered
   - `requestEvidence()` → EvidenceRequested
   - `submitEvidence()` → PayerReview
   - `agreeToClaim()` → Agreed (note: this requires changing state logic for evidence path — see Step 5)
   - `settleClaim()` → Settled
3. **State transition guards:** calling `counterClaim()` when state is not `Submitted` reverts
4. **Hash verification:** `claimHash` stored correctly, `bytes32(0)` rejected for evidence
5. **Event emission:** Each function emits the correct event with correct indexed parameters

### Step 4: Deploy to Somnia Testnet

**File:** `contracts/scripts/deploy.ts`

```typescript
import { ethers } from 'hardhat';

async function main() {
  const ClaimSettlement = await ethers.getContractFactory('ClaimSettlement');
  const contract = await ClaimSettlement.deploy();
  await contract.waitForDeployment();
  console.log('ClaimSettlement deployed to:', await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Configure `hardhat.config.ts` for Somnia testnet (Chain ID 50311):
```typescript
export default {
  networks: {
    somnia_testnet: {
      url: process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 50311,
    },
  },
  solidity: { version: '0.8.28' },
};
```

Run: `npx hardhat run scripts/deploy.ts --network somnia_testnet`

Record the deployed address for use in `src/` and `web/`.

### Step 5: Provider Agent (`src/agents/provider-agent.ts`)

```typescript
import { SomniaAgentKit } from 'somnia-agent-kit';
import { ClaimBundle, AuditEntry } from '../types/claim.types.ts';
import { hashBundle, buildAuditEntry } from '../utils.ts';

export class ProviderAgent {
  private kit: SomniaAgentKit;
  private agentId: number;

  constructor(kit: SomniaAgentKit, agentId: number) {
    this.kit = kit;
    this.agentId = agentId;
  }

  /** Generate a synthetic claim bundle from a clinical note */
  async proposeClaim(
    clinicalNote: string,
    payerAgentId: number,
    claimId: string,
    amount: number
  ): Promise<{ bundle: ClaimBundle; bundleHash: string }> {
    const bundle: ClaimBundle = {
      claimId,
      patientRef: 'synthetic-patient-001',
      encounter: { type: 'outpatient', date: '2026-05-01' },
      codes: [
        {
          system: 'ICD-10-CM',
          code: 'E11.9',
          description: 'Type 2 diabetes mellitus without complications',
          support: ['note-span-3'],
          confidence: 0.86,
        },
        {
          system: 'ICD-10-CM',
          code: 'I10',
          description: 'Essential (primary) hypertension',
          support: ['note-span-7'],
          confidence: 0.78,
        },
      ],
      amount,
      evidenceRefs: ['evidence-001'],
      bundleHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // placeholder
    };

    const bundleHash = hashBundle(bundle);
    bundle.bundleHash = bundleHash;

    return { bundle, bundleHash };
  }

  /** Submit claim to chain */
  async submitClaim(
    claimContract: string,
    payerAgentId: number,
    bundleHash: string,
    amount: number
  ): Promise<{ claimId: number; txHash: string }> {
    const contract = new this.kit.getSigner();
    // Use kit.contracts or ethers directly via provider
    // Implementation depends on kit's contract interaction API
    // For MVP, use viethers-compatible call pattern
    throw new Error('Not implemented — wire through kit contract interaction');
  }

  /** Submit evidence hash to chain */
  async submitEvidence(claimContract: string, claimId: number, evidenceHash: string): Promise<string> {
    throw new Error('Not implemented');
  }

  /** Get claim from chain */
  async getClaim(claimContract: string, claimId: number): Promise<any> {
    // View call via kit
    throw new Error('Not implemented');
  }
}
```

**Note:** We'll wire the actual contract interaction using ethers/viem through `kit.getSigner()` and `kit.getProvider()`. The exact API depends on how `somnia-agent-kit` exposes contract interaction — likely through the deployed contract's ABI.

### Step 6: Payer Agent (`src/agents/payer-agent.ts`)

```typescript
import { SomniaAgentKit } from 'somnia-agent-kit';
import { AdjudicationResponse, ClaimBundle } from '../types/claim.types.ts';

export class PayerAgent {
  private kit: SomniaAgentKit;
  private agentId: number;
  private policy: PayerPolicy;

  constructor(kit: SomniaAgentKit, agentId: number, policy: PayerPolicy) {
    this.kit = kit;
    this.agentId = agentId;
    this.policy = policy;
  }

  /** Adjudicate a claim against policy rules */
  adjudicate(bundle: ClaimBundle): AdjudicationResponse {
    const maxAmount = this.policy.maxAmount;
    const reimbursementRate = this.policy.reimbursementRate;

    const shouldCount = bundle.amount > maxAmount;
    const shouldRequestEvidence = !shouldCount && bundle.codes.some(c => c.confidence < 0.8);

    if (shouldRequestEvidence) {
      return {
        claimId: bundle.claimId,
        decision: 'requestEvidence',
        reason: 'Low confidence codes require supporting documentation',
        evidenceRequest: 'Clinical rationale for E11.9',
      };
    }

    const counterAmount = shouldCount
      ? Math.round(maxAmount * reimbursementRate)
      : Math.round(bundle.amount * reimbursementRate);

    if (counterAmount < bundle.amount) {
      return {
        claimId: bundle.claimId,
        decision: 'count',
        counterAmount,
        counterHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // placeholder
        reason: `Claimed amount ${bundle.amount} exceeds policy maximum ${maxAmount}`,
      };
    }

    return {
      claimId: bundle.claimId,
      decision: 'approve',
      counterAmount,
      counterHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      reason: 'Claim matches policy coverage',
    };
  }
}

export interface PayerPolicy {
  policyId: string;
  maxAmount: number;
  reimbursementRate: number;
  coveredCodes: string[];
}
```

**Policy fixture** (`demo-data/policies/payer-policy-001.json`):
```json
{
  "policyId": "payer-policy-001",
  "providerName": "MedInsure Inc.",
  "maxAmount": 50000,
  "reimbursementRate": 0.80,
  "coveredCodes": ["E11.9", "I10", "E78.5", "K21.0"]
}
```

### Step 7: Orchestration Logic (`src/orchestrator.ts`)

```typescript
import { SomniaAgentKit } from 'somnia-agent-kit';
import { ProviderAgent } from './agents/provider-agent.ts';
import { PayerAgent } from './agents/payer-agent.ts';
import { ClaimBundle, AdjudicationResponse, AuditEntry } from './types/claim.types.ts';
import { readFileSync } from 'fs';

export class Orchestrator {
  private kit: SomniaAgentKit;
  private providerAgent: ProviderAgent;
  private payerAgent: PayerAgent;
  private claimContract: string;
  private registryContract: string;
  private audit: AuditEntry[];

  constructor(config: {
    kit: SomniaAgentKit;
    providerAgentId: number;
    payerAgentId: number;
    claimContractAddress: string;
    registryContractAddress: string;
    policyPath: string;
  }) {
    this.kit = config.kit;
    this.claimContract = config.claimContractAddress;
    this.registryContract = config.registryContractAddress;
    const policy = JSON.parse(readFileSync(config.policyPath, 'utf-8')) as PayerPolicy;
    this.providerAgent = new ProviderAgent(this.kit, config.providerAgentId);
    this.payerAgent = new PayerAgent(this.kit, config.payerAgentId, policy);
    this.audit = [];
  }

  /**
   * Run the full negotiation flow for a single claim.
   * Returns the audit timeline.
   */
  async runNegotiation(
    scenario: 'clean-approval' | 'counter-evidence'
  ): Promise<AuditEntry[]> {
    const claimId = `demo-claim-${Date.now().toString(36)}`;
    this.audit = [];

    const clinicalNote = readFileSync(
      'demo-data/clinical-notes/synthetic-note-001.json',
      'utf-8'
    );

    // 1. Provider proposes claim
    const { bundle, bundleHash } = await this.providerAgent.proposeClaim(
      clinicalNote,
      this.payerAgent['agentId'],
      claimId,
      42500 // claimed amount in cents
    );

    this.audit.push({
      step: 'Claim Proposalsubmitted',
      timestamp: Math.floor(Date.now() / 1000),
      party: 'system',
      state: 'Submitted',
      details: { claimId, codes: bundle.codes },
    });

    // Placeholder: submit to chain, get claimId from chain
    // const { claimId: chainClaimId, txHash } = await this.providerAgent.submitClaim(
    //   this.claimContract, this.payerAgent['agentId'], bundleHash, 42500
    // );
    // this.audit[this.audit.length - 1].txHash = txHash;

    // 2. Payer adjudicates
    const response = this.payerAgent.adjudicate(bundle);
    this.audit.push({
      step: 'Payer Adjudication',
      timestamp: Math.floor(Date.now() / 1000),
      party: 'payer',
      state: response.decision === 'count' ? 'Countered' : 'PayerReview',
      details: { decision: response.decision, reason: response.reason },
    });

    if (scenario === 'counter-evidence' || response.decision === 'count') {
      // 3. Payer counters
      this.audit.push({
        step: 'Payer Counter',
        timestamp: Math.floor(Date.now() / 1000),
        party: 'payer',
        state: 'Countered',
        details: { counterAmount: response.counterAmount, reason: response.reason },
      });

      // 4. Provider submits evidence
      const evidenceHash = '0x' + Buffer.from('evidence-' + claimId).toString('hex').padStart(64, '0');
      this.audit.push({
        step: 'Evidence Submitted',
        timestamp: Math.floor(Date.now() / 1000),
        party: 'provider',
        state: 'EvidenceSubmitted',
        details: { evidenceHash },
      });

      // 5. Payer agrees
      this.audit.push({
        step: 'Payer Agreement',
        timestamp: Math.floor(Date.now() / 1000),
        party: 'payer',
        state: 'Agreed',
        details: { finalAmount: response.counterAmount },
      });
    }

    // 6. Settle
    this.audit.push({
      step: 'Settlement',
      timestamp: Math.floor(Date.now() / 1000),
      party: 'system',
      state: 'Settled',
      details: { finalAmount: response.counterAmount ?? bundle.amount },
    });

    return this.audit;
  }
}
```

### Step 8: CLI Entry Point (`src/index.ts`)

```typescript
#!/usr/bin/env tsx
import { SomniaAgentKit } from 'somnia-agent-kit';
import { Orchestrator } from './orchestrator.ts';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const kit = new SomniaAgentKit();
  await kit.initialize();

  const orchestrator = new Orchestrator({
    kit,
    providerAgentId: 1,     // registered in AgentRegistry before demo
    payerAgentId: 2,        // registered in AgentRegistry before demo
    claimContractAddress: process.env.CLAIM_CONTRACT_ADDRESS || '0x...',
    registryContractAddress: process.env.AGENT_REGISTRY_ADDRESS || '0xC9f3452090EEB519467DEa4a390976D38C008347',
    policyPath: 'demo-data/policies/payer-policy-001.json',
  });

  console.log('\n=== Curie Claims Protocol — MVP0 Demo ===\n');

  const result = await orchestrator.runNegotiation('counter-evidence');
  console.log('\nAudit Timeline:');
  result.forEach((entry) => {
    console.log(`  [${entry.step}] ${entry.state} | ${new Date(entry.timestamp * 1000).toISOString()} | ${entry.party}`);
  });

  console.log('\n✅ MVP0 Demo Complete\n');
}

main().catch(console.error);
```

### Step 9: Utility Functions (`src/utils.ts`)

```typescript
import { createHash } from 'crypto';

/** SHA-256 hash of a JSON-serialised claim bundle */
export function hashBundle(bundle: object): string {
  const json = JSON.stringify(bundle, Object.keys(bundle).sort());
  const hash = createHash('sha256').update(json).digest('hex');
  return '0x' + hash;
}

/** Build an audit timeline entry */
export function buildAuditEntry(
  step: string,
  party: 'provider' | 'payer' | 'system' | 'contract',
  state: string,
  details?: Record<string, unknown>
): Record<string, unknown> {
  return {
    step,
    timestamp: Math.floor(Date.now() / 1000),
    party,
    state,
    details: details ?? {},
  };
}
```

### Step 10: Synthetic Demo Data

**File:** `demo-data/clinical-notes/synthetic-note-001.json`

```json
{
  "noteId": "synthetic-note-001",
  "patientRef": "synthetic-patient-001",
  "encounterType": "outpatient",
  "encounterDate": "2026-05-01",
  "text": "A 58-year-old male presents with follow-up for type 2 diabetes management. HbA1c is 7.4%. Patient has been compliant with metformin 1000mg BID. Blood pressure is mildly elevated at 142/88mmHg, consistent with essential hypertension. Plan: continue current medications, schedule repeat HbA1c in 3 months, dietary counseling provided.",
  "evidence": [
    { "spanId": "note-span-3", "text": "type 2 diabetes", "type": "diagnosis" },
    { "spanId": "note-span-7", "text": "hypertension", "type": "diagnosis" }
  ]
}
```

### Step 11: Audit Dashboard (`web/public/index.html`)

Simple HTML/JS page that:
- Has a "Run Demo Claim" button (calls a local API on port 3001)
- After run, renders the audit timeline as a vertical DOM timeline
- Shows transaction hashes (hardcoded for MVP0 if not on chain)
- Has a "Privacy Notice" panel explaining on-chain vs off-chain boundary

For MVP0, this can be served directly by Node.js `http` module — no full Next.js needed unless there's time.

### Step 12: Wire Contract Interaction

Update the provider agent and orchestrator to use `somnia-agent-kit` for actual on-chain calls:

- Use `kit.getSigner()` to send write transactions
- Use `kit.getProvider()` to read contract state
- Import the contract ABI from the Hardhat build artifacts
- Deploy `ClaimSettlement.sol` to testnet, capture address
- Store address in `CLAIM_CONTRACT_ADDRESS` env var

---

## Acceptance Criteria

### End-to-End Demo (must all pass)

- [ ] `ClaimSettlement.sol` compiles with Foundry/Hardhat with zero errors and zero warnings
- [ ] Contract deploys to Somnia testnet (Chain ID 50311) and returns a valid address
- [ ] `submitClaim()` transitions state from `Draft` to `Submitted` and emits `ClaimSubmitted` event
- [ ] `counterClaim()` transitions state from `Submitted` to `Countered` and emits `ClaimCountered` event
- [ ] `requestEvidence()` transitions state from `Submitted` to `EvidenceRequested` and emits `EvidenceRequested` event
- [ ] `submitEvidence()` transitions state from `EvidenceRequested` to `PayerReview` and emits `EvidenceSubmitted` event
- [ ] `agreeToClaim()` transitions state from `Countered` to `Agreed` and emits `ClaimAgreed` event
- [ ] `settleClaim()` transitions state from `Agreed` to `Settled` and emits `ClaimSettled` event
- [ ] Invalid state transitions revert (e.g., calling `settleClaim()` on a `Submitted` claim)
- [ ] Provider agent creates a valid claim bundle with ICD-10 codes and SHA-256 hash
- [ ] Bundle hash contains NO PHI (no patient name, DOB, MRN, or raw clinical text)
- [ ] Payer agent adjudicates against policy fixture and produces a counter or approval
- [ ] `runNegotiation('counter-evidence')` completes the full flow end-to-end
- [ ] Audit timeline is produced with all steps, timestamps, and party attribution
- [ ] `tsx src/index.ts` runs the demo without TypeScript errors on Node >= 20
- [ ] All tests in `contracts/test/` pass

### 90-Second Demo Path

- [ ] Single command (`tsx src/index.ts`) executes the full counter+evidence negotiation
- [ ] Output shows: provider proposal → payer counter → evidence submitted → agreement → settlement
- [ ] Somnia transaction hashes appear in output (from actual testnet tx)
- [ ] Timeline renders in console within 90 seconds total execution time

---

## Dependencies

### External Services

| Service | Used For | Required for MVP0? |
|---|---|---|
| Somnia Testnet RPC (`https://dream-rpc.somnia.network`) | Contract deployment & interaction | **Yes** |
| Somnia AgentKit SDK (`somnia-agent-kit@^3.0.11`) | Agent identity, contract bindings | **Yes** |
| AgentRegistry (deployed `0xC9f3452090EEB519467DEa4a390976D38C008347`) | Agent identity for provider/payer | **Yes** |
| Somnia Testnet Faucet | STT tokens for gas | **Yes** (to deploy) |
| Somnia Explorer (`https://somnia-devnet.socialscan.io`) | Verify txs | Helpful |

### Environment Variables

```bash
# Required
PRIVATE_KEY=                  # Somnia testnet wallet private key
SOMNIA_RPC_URL=               # Default: https://dream-rpc.somnia.network

# After deployment
CLAIM_CONTRACT_ADDRESS=       # Deployed ClaimSettlement.sol address

# Somnia AgentKit defaults (already in kit)
AGENT_REGISTRY_ADDRESS=       # Default: 0xC9f3452090EEB519467DEa4a390976D38C008347
```

### Package Dependencies

```json
{
  "dependencies": {
    "somnia-agent-kit": "^3.0.11",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@openzeppelin/contracts": "^5.0.0",
    "hardhat": "^2.22.0",
    "ethers": "^6.13.0",
    "chai": "^5.1.0",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "foundry-toolchain": "latest"
  }
}
```

---

## File Tree (After MVP0 Complete)

```
curie-claims-protocol/
├── AGENTS.md                     # Existing — hard rules
├── README.md                     # Generated: product description + demo
├── .env.example                  # Updated: add CLAIM_CONTRACT_ADDRESS
├── package.json                  # Updated: add dependencies
├── tsconfig.json                 # TS config
│
├── contracts/                    # Foundry/Hardhat project
│   ├── hardhat.config.ts         # Somnia testnet config
│   ├── ClaimSettlement.sol       # Core smart contract
│   ├── package.json              # Hardhat deps
│   ├── test/
│   │   └── ClaimSettlement.test.ts  # State machine + flow tests
│   └── scripts/
│       └── deploy.ts             # Deploy to testnet
│
├── src/                          # TypeScript application
│   ├── index.ts                  # CLI entry point / demo runner
│   ├── types/
│   │   └── claim.types.ts        # ClaimState, ClaimBundle, etc.
│   ├── agents/
│   │   ├── provider-agent.ts     # Provider coding agent
│   │   └── payer-agent.ts        # Payer adjudication agent
│   ├── orchestrator.ts           # Negotiation flow controller
│   └── utils.ts                  # Hashing, helpers
│
├── demo-data/
│   ├── clinical-notes/
│   │   └── synthetic-note-001.json  # Synthetic clinical note
│   └── policies/
│       └── payer-policy-001.json    # Payer policy fixture
│
├── web/
│   └── public/
│       └── index.html            # Audit dashboard (static)
│
└── docs/
    └── mvp0-plan.md              # This file
```

---

## Assumptions & Decisions

### Assumptions to Validate

1. **somnia-agent-kit contract interaction API:** We assume the kit exposes `getSigner()`, `getProvider()`, and allows creating contract instances from ABI + address via standard ethers v6 patterns. If the kit wraps everything differently, we'll adapt.

2. **AgentRegistry is pre-deployed on testnet:** The existing deployed contract at `0xC9f3452090EEB519467DEa4a390976D38C008347` can be used directly. Provider and payer agents are registered at IDs 1 and 2.

3. **No LLM needed for MVP0:** Synthetic/deterministic agents are sufficient for the demo. The value proposition (blockchain coordination layer + agent identity) works with any agent logic.

4. **Somnia testnet is accessible:** RPC at `https://dream-rpc.somnia.network` returns blocks and accepts transactions. Faucet provides STT for gas.

5. **No real payment settlement needed:** The `ClaimSettled` event is sufficient — judges care about the audit trail, not a real money movement in an MVP0 hackathon demo.

### Decisions

1. **TypeScript only** (per AGENTS.md) — no Solidity-only tooling as primary code language. Tests in TS via Hardhat.

2. **Hashes, not encryption, on-chain** — SHA-256 anchors for claim bundles. No on-chain PHI.

3. **State machine is strict** — each function has a single valid source state. No transitions skipped.

4. **Single contract** — `ClaimSettlement.sol` handles everything. No upgradeable proxy, no separate registry. Registry uses the existing Somnia-deployed one.

5. **Deterministic demo data** — one clinical note, one policy, one scenario. Reproducible.

6. **Agent ID-based (not address-based)** — claims reference `AgentRegistry` IDs rather than raw addresses, showing proper use of the agent framework.

7. **Settlement amount in cents** — integer arithmetic, no floating point. Follows blockchain best practices.

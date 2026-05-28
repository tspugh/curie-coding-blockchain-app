# Session Changes — 2026-05-28

Changes made during this session, derived from git diffs across commits
`64f9c83` → `3aa0259` on `main`.

---

## 1. Contract — `contracts/contracts/CoverageNegotiation.sol`

### Agent switched from custom ID 46 → Somnia LLM Parse Website base agent

The original contract used a custom agent (ID 46) that had no executable code on
testnet, causing every `requestAdjudication` call to revert with `require(false)`.

**Fix:** Switched to the built-in **LLM Parse Website** base agent
(ID `12875401142070969085`) which validators already know how to run. Added a new
interface at the top of the contract:

```solidity
interface IParseWebsiteAgent {
    function ExtractANumber(
        string memory key,
        string memory description,
        uint256 min,
        uint256 max,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages
    ) external returns (uint256);
}
```

### `_fireAgent` payload updated

Changed from a custom 7-field ruling tuple to `ExtractANumber` — the agent fetches
a public URL (MedlinePlus Humira page) and returns `1` (approve) or `0` (deny).
The prompt instructs it to return 1 if the drug is FDA-indicated for the submitted
condition, 0 otherwise.

Added storage variable:

```solidity
string public agentEvidenceUrl =
    "https://medlineplus.gov/druginfo/meds/a603010.html";
```

And a setter so the evidence URL can be updated post-deploy without redeploying:

```solidity
function setAgentEvidenceUrl(string calldata url) external onlyOwner
```

### `handleResponse` decoding simplified

Old: decoded a 7-field tuple `(decision, costPlusUnitPrice, nadacUnitPrice, …)`.

New: decodes a single `uint256` from `responses[0].result`:

```solidity
uint256 approvedVal = abi.decode(responses[0].result, (uint256));
Decision decision = approvedVal >= 1 ? Decision.Approve : Decision.Deny;
```

### `submitEvidence` — fix written (not yet deployed)

Root cause of `submitEvidence` reverting: calling `_fireAgent` inside it triggered
a second `platform.createRequest` on the real Somnia AgentExecutor, which reverted
(platform does not allow concurrent requests on the same slot).

Fix: `submitEvidence` now stores evidence and returns state to `Ready` without
calling `_fireAgent`. The provider then clicks "Request AI Decision" to fire the
agent as a separate explicit step.

```solidity
function submitEvidence(uint256 reqId, bytes32 evidenceUri) external {
    Negotiation storage n = _get(reqId);
    require(n.state == State.EvidenceRequested, "evidence: wrong state");
    require(msg.sender == n.providerAddr, "auth: not provider");
    require(evidenceUri != bytes32(0), "evidence: empty");
    n.evidenceUri = evidenceUri;
    n.round += 1;
    n.state = State.Ready;
    emit EvidenceSubmitted(reqId, evidenceUri);
    emit ContractReady(reqId);
}
```

**Status: compiled locally, not deployed** — deployer wallet has insufficient STT.
The live contract at `0x461aeC3384e45CAEC49a2FBf099416d7BED659b4` still has the old
`submitEvidence` that calls `_fireAgent`.

---

## 2. Contract — platform and agent fee configuration

### Real Somnia AgentExecutor address corrected

`.env` had the wrong platform address (`0x157C56…`). Corrected to:

```
AGENT_PLATFORM_ADDRESS=0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776
```

This is the real Somnia AgentExecutor on Shannon testnet.

### Agent reward set to 0.30 STT

Fee structure for the LLM Parse Website agent:
- Platform floor deposit: **0.03 STT** (`platform.getRequestDeposit()`)
- Agent reward: **0.30 STT** (0.10 STT × 3 validators, Somnia default subcommittee)
- **Total per adjudication: 0.33 STT**

Set in `.env`:
```
VITE_AGENT_FEE_WEI=330000000000000000
```

---

## 3. New Hardhat scripts — `contracts/scripts/`

| Script | npm task | Purpose |
|---|---|---|
| `admin.ts` | `admin:somnia` | Queries platform deposit floor, sets `agentReward` to 0.30 STT |
| `deploy-mock.ts` | `deploy:mock` | Deploys `MockAgentPlatform` (for local dev, not for hackathon) |
| `trigger-ruling.ts` | `trigger-ruling:somnia` | Fires a mock Approve ruling via `MockAgentPlatform.triggerRuling` |
| `restore-real-platform.ts` | `restore-real:somnia` | Restores contract to real Somnia AgentExecutor + 0.30 STT reward after mock testing |
| `switch-to-mock.ts` | `switch-mock:somnia` | Switches contract to mock platform for local testing (sets reward to 0) |

> Note: `switch-to-mock.ts` was run during this session by mistake and broke the
> live contract. `restore-real-platform.ts` was immediately run to undo it.

---

## 4. Web — `web/src/client.ts`

Added `agentFeeValue` to the real-mode contract options so writes that fire the
agent send the correct `msg.value`:

```typescript
contract: {
  real: {
    contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
    agentFeeValue: BigInt(import.meta.env.VITE_AGENT_FEE_WEI ?? "330000000000000000"),
  },
},
```

---

## 5. Backend — `src/contract/real.ts`

`submitEvidence` no longer sends `{ value: this.agentFeeValue }` because the fixed
contract version doesn't call the agent from that function. The fee is only needed
for `requestAdjudication`.

```typescript
async submitEvidence(reqId: bigint, evidenceUri: string): Promise<void> {
    const tx = await this.contract.submitEvidence(reqId, evidenceUri);
    await tx.wait();
}
```

---

## 6. Web — demo UX additions

### `web/src/sampleCase.ts`

Added `additionalEvidenceRef` field to `SAMPLE_CASE` — a pre-filled Phase 3 RCT
reference the provider can load as demo evidence:

```
"https://pubmed.ncbi.nlm.nih.gov/16952715/ — REVEAL Phase 3 RCT:
adalimumab achieved PASI 75 in 71% of patients at week 16 vs 7% placebo (p<0.001)
in adults with moderate-to-severe chronic plaque psoriasis.
Step-therapy exception criteria met: prior methotrexate failure documented
(intolerance: transaminitis). Patient meets FDA-approved indication."
```

### `web/src/views/Detail.tsx`

Two demo fill-in additions:

1. **Non-compliant policy card auto-sets decision to NeedMoreEvidence**
   Clicking the "Non-Compliant Policy" card on the insurer screen now automatically
   sets the decision dropdown to "Request Evidence" — no extra click needed.

2. **"Load Demo Evidence →" button** on the provider's evidence submission screen
   (`canSubmitEvidence` section). Clicking it pre-fills the evidence textarea with
   the `SAMPLE_CASE.additionalEvidenceRef` PubMed/RCT citation above.
   `data-testid="load-demo-evidence"` for Playwright targeting.

---

## 7. `.env.example` updated

Added all new env vars with explanations:

```
VITE_WALLET_MODE=real
VITE_PRIVATE_KEY=
VITE_SOMNIA_NETWORK=testnet
VITE_CONTRACT_ADDRESS=0x461aeC3384e45CAEC49a2FBf099416d7BED659b4
COVERAGE_CONTRACT_ADDRESS=0x461aeC3384e45CAEC49a2FBf099416d7BED659b4
AGENT_PLATFORM_ADDRESS=0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776
AGENT_ID=12875401142070969085
VITE_AGENT_FEE_WEI=330000000000000000
```

---

## Current live state

| Item | Value |
|---|---|
| Contract address | `0x461aeC3384e45CAEC49a2FBf099416d7BED659b4` |
| Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` (real Somnia AgentExecutor) |
| Agent ID | `12875401142070969085` (LLM Parse Website base agent) |
| `agentReward` | 0.30 STT |
| `submitEvidence` fix | Written + compiled, **not deployed** (need more STT) |

## Pending

- Get STT from Somnia Discord `#faucet` or Google Cloud faucet (Shannon testnet)
- Deploy fixed contract: `npm --prefix contracts run deploy:somnia`
- Update `VITE_CONTRACT_ADDRESS` + `COVERAGE_CONTRACT_ADDRESS` in `.env`
- Rebuild web: `npm run web:build`
- Hard refresh browser to clear stale React state

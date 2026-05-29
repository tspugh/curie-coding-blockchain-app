import { expect } from "chai";
import { ethers } from "hardhat";
import { CoverageNegotiation, MockAgentPlatform } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// State enum mirror (must match CoverageNegotiation.State order).
const State = {
  Open: 0n,
  Ready: 1n,
  UnderReview: 2n,
  EvidenceRequested: 3n,
  Approved: 4n,
  Denied: 5n,
  Settled: 6n,
  Deadlocked: 7n,
  PolicyInvalidated: 8n,
  ProviderRefused: 9n,
  Withdrawn: 10n,
} as const;

// Decision enum mirror (in the agent result tuple).
const Decision = { Approve: 0, Deny: 1, NeedMoreEvidence: 2, PolicyInvalid: 3 } as const;

// ResponseStatus mirror (ISomniaAgent.sol).
const ResponseStatus = { None: 0, Pending: 1, Success: 2, Failed: 3, TimedOut: 4 } as const;

// App-level party ids.
const PROVIDER_ID = 11n;
const INSURER_ID = 22n;
const AGENT_ID = 7n;

// Opaque refs / hashes — never raw content (R3/R4).
const DRUG_REF = ethers.id("DRUG:semaglutide");
const JUSTIFICATION_HASH = ethers.id("de-identified-justification");
const EVIDENCE_URI = ethers.id("ipfs://evidence-v1");
const EVIDENCE_URI_2 = ethers.id("ipfs://evidence-v2");
const POLICY_HASH = ethers.id("policy-body");
const POLICY_URI = ethers.id("ipfs://policy");
const RATIONALE_HASH = ethers.id("rationale:necessary");
const CLAUSE_REF = ethers.id("policy:clause:3b");
const STANDARD_REF = ethers.id("FDA:label:semaglutide");
const REASON_HASH = ethers.id("appeal:reason");

const REQUESTED = 2000n;
const QUANTITY = 10n; // dispensed units — drives the deterministic cap (R6a)
const DAYS_SUPPLY = 30n; // clinical-utilization context — NEVER affects price (R6a)
const NADAC_UNIT = 80n; // NADAC per-unit acquisition-cost floor reference
const RECEIPT_ID = 999n;
const FEE = ethers.parseEther("0.01"); // > mock deposit (0.001 ether)

/** Build the MockAgentPlatform.Ruling struct (ethers v6 takes a plain object). */
function ruling(
  decision: number,
  costPlusUnitPrice: bigint,
  nadacUnitPrice: bigint = NADAC_UNIT
) {
  return {
    decision,
    costPlusUnitPrice,
    nadacUnitPrice,
    rationaleHash: RATIONALE_HASH,
    clauseRef: CLAUSE_REF,
    standardRef: STANDARD_REF,
    receiptId: RECEIPT_ID,
  };
}

/** Deploy a fresh mock platform + contract. Deployer (signer[0]) is owner. */
async function deploy() {
  const Mock = await ethers.getContractFactory("MockAgentPlatform");
  const platform = (await Mock.deploy()) as unknown as MockAgentPlatform;
  await platform.waitForDeployment();

  const Factory = await ethers.getContractFactory("CoverageNegotiation");
  const contract = (await Factory.deploy(await platform.getAddress(), AGENT_ID)) as unknown as CoverageNegotiation;
  await contract.waitForDeployment();

  return { platform, contract };
}

/** Create a request as `provider` (the caller MUST be the provider addr — R11). */
async function createAs(
  contract: CoverageNegotiation,
  provider: HardhatEthersSigner,
  insurerAddr: string,
  requestedAmount = REQUESTED,
  quantity = QUANTITY,
  daysSupply = DAYS_SUPPLY
) {
  await contract
    .connect(provider)
    .createContract(
      PROVIDER_ID,
      INSURER_ID,
      provider.address,
      insurerAddr,
      DRUG_REF,
      requestedAmount,
      quantity,
      daysSupply,
      JUSTIFICATION_HASH,
      EVIDENCE_URI,
      0 /* payerLine: PartD */
    );
  return contract.count();
}

/** Create → engage (insurer) → adjudicate (provider). Returns { reqId, requestId }. */
async function createEngageAdjudicate(
  contract: CoverageNegotiation,
  platform: MockAgentPlatform,
  provider: HardhatEthersSigner,
  insurer: HardhatEthersSigner,
  requestedAmount = REQUESTED,
  quantity = QUANTITY,
  daysSupply = DAYS_SUPPLY
) {
  const reqId = await createAs(contract, provider, insurer.address, requestedAmount, quantity, daysSupply);
  await contract.connect(insurer).insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  await contract.connect(provider).requestAdjudication(reqId, { value: FEE });
  const requestId = await platform.lastRequestId();
  return { reqId, requestId };
}

describe("CoverageNegotiation", () => {
  it("T1/T2/T3: createContract is provider-only, stores only hashes/refs; engage→Ready; adjudicate gated to Ready", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();

    // T2: provider files; ContractCreated carries both addresses.
    await expect(
      contract
        .connect(provider)
        .createContract(
          PROVIDER_ID,
          INSURER_ID,
          provider.address,
          insurer.address,
          DRUG_REF,
          REQUESTED,
          QUANTITY,
          DAYS_SUPPLY,
          JUSTIFICATION_HASH,
          EVIDENCE_URI,
          0 /* payerLine: PartD */
        )
    )
      .to.emit(contract, "ContractCreated")
      .withArgs(1n, PROVIDER_ID, INSURER_ID, provider.address, insurer.address, DRUG_REF, REQUESTED, QUANTITY, DAYS_SUPPLY);

    // T1: getter exposes only hashes/refs/amounts — no raw-content field exists.
    const n = await contract.getNegotiation(1n);
    expect(n.justificationHash).to.equal(JUSTIFICATION_HASH);
    expect(n.drugRef).to.equal(DRUG_REF);
    expect(n.evidenceUri).to.equal(EVIDENCE_URI);
    expect(n.requestedAmount).to.equal(REQUESTED);
    expect(n.quantity).to.equal(QUANTITY);
    expect(n.daysSupply).to.equal(DAYS_SUPPLY);
    expect(n.state).to.equal(State.Open);

    // createContract requires quantity > 0.
    await expect(
      contract
        .connect(provider)
        .createContract(
          PROVIDER_ID,
          INSURER_ID,
          provider.address,
          insurer.address,
          DRUG_REF,
          REQUESTED,
          0n,
          DAYS_SUPPLY,
          JUSTIFICATION_HASH,
          EVIDENCE_URI,
          0 /* payerLine: PartD */
        )
    ).to.be.revertedWith("qty: zero");

    // T3: adjudication reverts before engage (still Open / not Ready).
    await expect(
      contract.connect(provider).requestAdjudication(1n, { value: FEE })
    ).to.be.revertedWith("adjudicate: not Ready");

    // policyHash must be non-zero.
    await expect(
      contract.connect(insurer).insurerEngage(1n, ethers.ZeroHash, POLICY_URI)
    ).to.be.revertedWith("policy: empty");

    // T3: insurer engages → Ready; InsurerEngaged emitted.
    await expect(contract.connect(insurer).insurerEngage(1n, POLICY_HASH, POLICY_URI))
      .to.emit(contract, "InsurerEngaged")
      .withArgs(1n, POLICY_HASH, POLICY_URI)
      .and.to.emit(contract, "ContractReady")
      .withArgs(1n);
    expect(await contract.stateOf(1n)).to.equal(State.Ready);
    const policy = await contract.policyOf(1n);
    expect(policy.policyHash).to.equal(POLICY_HASH);
    expect(policy.policyUri).to.equal(POLICY_URI);

    // engage again reverts (not Open).
    await expect(
      contract.connect(insurer).insurerEngage(1n, POLICY_HASH, POLICY_URI)
    ).to.be.revertedWith("engage: not Open");

    expect(await platform.createRequestCalls()).to.equal(0n);
  });

  it("R2b (SPEC-0004 §2.1 AC-6): createContract reverts when providerAddr == insurerAddr (self-contract)", async () => {
    const { contract } = await deploy();
    const [provider] = await ethers.getSigners();
    await expect(
      contract.connect(provider).createContract(
        PROVIDER_ID, INSURER_ID,
        provider.address, provider.address,  // SAME address → self-contract
        DRUG_REF, REQUESTED, QUANTITY, DAYS_SUPPLY,
        JUSTIFICATION_HASH, EVIDENCE_URI,
        0 /* payerLine: PartD */
      )
    ).to.be.revertedWith("create: self-contract");
  });

  it("UNIT-2-followup-B: createContract guards order — addr: zero precedes create: self-contract", async () => {
    // Pins the ordering of the createContract require chain. If a future refactor
    // swaps the `addr: zero` and `create: self-contract` lines, the (zero, zero)
    // case would silently change revert string and downstream consumers parsing
    // revert messages would degrade. SPEC-0004 §2.1 AC-6 + structural invariant.
    const { contract } = await deploy();
    const [provider] = await ethers.getSigners();
    const ZERO_ADDR = ethers.ZeroAddress;
    const args = (providerAddr: string, insurerAddr: string) =>
      [PROVIDER_ID, INSURER_ID, providerAddr, insurerAddr, DRUG_REF, REQUESTED,
       QUANTITY, DAYS_SUPPLY, JUSTIFICATION_HASH, EVIDENCE_URI, 0] as const;

    // provider == 0, insurer != 0 → addr: zero
    await expect(
      contract.connect(provider).createContract(...args(ZERO_ADDR, provider.address))
    ).to.be.revertedWith("addr: zero");

    // provider != 0, insurer == 0 → addr: zero
    await expect(
      contract.connect(provider).createContract(...args(provider.address, ZERO_ADDR))
    ).to.be.revertedWith("addr: zero");

    // provider == insurer == 0 → addr: zero (NOT "create: self-contract" — ordering matters)
    await expect(
      contract.connect(provider).createContract(...args(ZERO_ADDR, ZERO_ADDR))
    ).to.be.revertedWith("addr: zero");

    // provider == insurer != 0 → create: self-contract (already covered above; restated
    // here so the ordering invariant is documented in one place).
    await expect(
      contract.connect(provider).createContract(...args(provider.address, provider.address))
    ).to.be.revertedWith("create: self-contract");
  });

  it("T4 (R6/R9): adjudication fires the agent → UnderReview; mock records the createRequest", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const reqId = await createAs(contract, provider, insurer.address);
    await contract.connect(insurer).insurerEngage(reqId, POLICY_HASH, POLICY_URI);

    await expect(contract.connect(provider).requestAdjudication(reqId, { value: FEE }))
      .to.emit(contract, "AdjudicationRequested")
      .withArgs(reqId)
      .and.to.emit(contract, "RulingRequested");

    expect(await contract.stateOf(reqId)).to.equal(State.UnderReview);
    expect(await contract.roundOf(reqId)).to.equal(1n);
    expect(await platform.createRequestCalls()).to.equal(1n);
    expect(await platform.lastAgentId()).to.equal(AGENT_ID);
    expect(await platform.lastCallbackAddress()).to.equal(await contract.getAddress());
    // The forwarded selector is handleResponse's (the real Somnia callback).
    const sel = contract.interface.getFunction("handleResponse").selector;
    expect(await platform.lastCallbackSelector()).to.equal(sel);
  });

  it("SPEC-0004 §3.5: PacketSubmitted emitted on every agent fire (requestAdjudication, submitEvidence, appeal)", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();
    const reqId = await createAs(contract, provider, insurer.address);
    await contract.connect(insurer).insurerEngage(reqId, POLICY_HASH, POLICY_URI);
    // initial requestAdjudication — round 1
    await expect(contract.connect(provider).requestAdjudication(reqId, { value: FEE }))
      .to.emit(contract, "PacketSubmitted")
      .withArgs(reqId, 1n, EVIDENCE_URI, EVIDENCE_URI);
    const rid1 = await platform.lastRequestId();
    // NeedMoreEvidence → submitEvidence re-fire emits PacketSubmitted with round 2
    await platform.triggerRuling(target, rid1, ruling(Decision.NeedMoreEvidence, 0n));
    await expect(contract.connect(provider).submitEvidence(reqId, EVIDENCE_URI_2, { value: FEE }))
      .to.emit(contract, "PacketSubmitted")
      .withArgs(reqId, 2n, EVIDENCE_URI_2, EVIDENCE_URI_2);
    const rid2 = await platform.lastRequestId();
    // Deny → appeal re-fire emits PacketSubmitted with round 3
    await platform.triggerRuling(target, rid2, ruling(Decision.Deny, 0n));
    await expect(contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE }))
      .to.emit(contract, "PacketSubmitted")
      .withArgs(reqId, 3n, EVIDENCE_URI, EVIDENCE_URI);
  });

  it("T4 (R6a): deny → 0; refs surfaced & stored; need_more_evidence & failure & timeout → EvidenceRequested", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();

    // approve: refs stored on the negotiation; lastDecision/hasRuling set.
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n);
      await platform.triggerRuling(target, requestId, ruling(Decision.Approve, 150n));
      expect(await contract.stateOf(reqId)).to.equal(State.Approved);
      const n = await contract.getNegotiation(reqId);
      expect(n.rationaleHash).to.equal(RATIONALE_HASH);
      expect(n.clauseRef).to.equal(CLAUSE_REF);
      expect(n.standardRef).to.equal(STANDARD_REF);
      expect(n.lastDecision).to.equal(BigInt(Decision.Approve));
      expect(n.hasRuling).to.equal(true);
      // Per-unit price lookups are stored (cap basis + NADAC floor reference).
      expect(n.costPlusUnitPrice).to.equal(150n);
      expect(n.nadacUnitPrice).to.equal(NADAC_UNIT);
    }

    // deny → Denied, covered 0
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await expect(platform.triggerRuling(target, requestId, ruling(Decision.Deny, 150n)))
        .to.emit(contract, "Ruled")
        .withArgs(reqId, requestId, Decision.Deny, 0n, RATIONALE_HASH, CLAUSE_REF, RECEIPT_ID);
      expect(await contract.stateOf(reqId)).to.equal(State.Denied);
      expect(await contract.coveredAmountOf(reqId)).to.equal(0n);
    }

    // need_more_evidence → EvidenceRequested; submitEvidence re-fires (round++) → UnderReview
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await expect(platform.triggerRuling(target, requestId, ruling(Decision.NeedMoreEvidence, 0n)))
        .to.emit(contract, "EvidenceRequested");
      expect(await contract.stateOf(reqId)).to.equal(State.EvidenceRequested);

      // empty evidence reverts
      await expect(
        contract.connect(provider).submitEvidence(reqId, ethers.ZeroHash, { value: FEE })
      ).to.be.revertedWith("evidence: empty");

      await expect(contract.connect(provider).submitEvidence(reqId, EVIDENCE_URI_2, { value: FEE }))
        .to.emit(contract, "EvidenceSubmitted")
        .withArgs(reqId, EVIDENCE_URI_2);
      expect(await contract.stateOf(reqId)).to.equal(State.UnderReview);
      expect(await contract.roundOf(reqId)).to.equal(2n);
    }

    // platform Failed → EvidenceRequested (retriable)
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await expect(platform.triggerFailure(target, requestId, ResponseStatus.Failed))
        .to.emit(contract, "RulingTimedOut")
        .and.to.emit(contract, "EvidenceRequested");
      expect(await contract.stateOf(reqId)).to.equal(State.EvidenceRequested);
    }

    // onRulingTimeout → EvidenceRequested after the deadline
    {
      const { reqId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await expect(contract.onRulingTimeout(reqId)).to.be.revertedWith("timeout: too early");
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await expect(contract.onRulingTimeout(reqId)).to.emit(contract, "RulingTimedOut");
      expect(await contract.stateOf(reqId)).to.equal(State.EvidenceRequested);
    }
  });

  it("T4/R6a (deterministic cap): covered = min(requested, costPlusUnitPrice × quantity), both directions; quantity drives the cap; priceBasisOf; daysSupply is price-neutral", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();

    // --- Cap binds: requested=2000, qty=10, costPlus/unit=150 → cap=1500 → covered=1500 ---
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n, 10n);
      await expect(platform.triggerRuling(target, requestId, ruling(Decision.Approve, 150n)))
        .to.emit(contract, "Ruled")
        .withArgs(reqId, requestId, Decision.Approve, 1500n, RATIONALE_HASH, CLAUSE_REF, RECEIPT_ID);
      expect(await contract.coveredAmountOf(reqId)).to.equal(1500n);
      expect((await contract.getNegotiation(reqId)).coveredAmount).to.equal(1500n);

      // priceBasisOf: requested / qty / costPlusTotal / nadacFloorTotal / covered.
      const basis = await contract.priceBasisOf(reqId);
      expect(basis.requestedAmount).to.equal(2000n);
      expect(basis.quantity).to.equal(10n);
      expect(basis.costPlusTotal).to.equal(1500n); // 150 × 10
      expect(basis.nadacFloorTotal).to.equal(NADAC_UNIT * 10n); // 80 × 10 = 800
      expect(basis.coveredAmount).to.equal(1500n);
    }

    // --- Requested binds: requested=2000, qty=10, costPlus/unit=500 → cap=5000 → covered=2000 ---
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n, 10n);
      await expect(platform.triggerRuling(target, requestId, ruling(Decision.Approve, 500n)))
        .to.emit(contract, "Ruled")
        .withArgs(reqId, requestId, Decision.Approve, 2000n, RATIONALE_HASH, CLAUSE_REF, RECEIPT_ID);
      expect(await contract.coveredAmountOf(reqId)).to.equal(2000n);
      const basis = await contract.priceBasisOf(reqId);
      expect(basis.costPlusTotal).to.equal(5000n); // 500 × 10
      expect(basis.coveredAmount).to.equal(2000n);
    }

    // --- quantity drives the cap: same per-unit price (150), different quantity → different cap ---
    {
      // qty=4 → cap=600 (binds, < requested 2000) → covered=600
      const a = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n, 4n);
      await platform.triggerRuling(target, a.requestId, ruling(Decision.Approve, 150n));
      expect(await contract.coveredAmountOf(a.reqId)).to.equal(600n);

      // qty=20 → cap=3000 (>= requested 2000) → covered=2000
      const b = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n, 20n);
      await platform.triggerRuling(target, b.requestId, ruling(Decision.Approve, 150n));
      expect(await contract.coveredAmountOf(b.reqId)).to.equal(2000n);
    }

    // --- daysSupply is price-neutral: two requests identical except daysSupply → identical covered ---
    {
      const x = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n, 10n, 30n);
      const y = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n, 10n, 90n);
      await platform.triggerRuling(target, x.requestId, ruling(Decision.Approve, 150n));
      await platform.triggerRuling(target, y.requestId, ruling(Decision.Approve, 150n));
      const covX = await contract.coveredAmountOf(x.reqId);
      const covY = await contract.coveredAmountOf(y.reqId);
      expect(covX).to.equal(1500n);
      expect(covY).to.equal(covX); // daysSupply changed (30 vs 90) but covered identical
      expect((await contract.getNegotiation(x.reqId)).daysSupply).to.equal(30n);
      expect((await contract.getNegotiation(y.reqId)).daysSupply).to.equal(90n);
    }
  });

  it("Finding-4 (cap domain): an extreme costPlusUnitPrice saturates the cap instead of bricking the callback", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();

    // costPlusUnitPrice near uint256 max with quantity > 1 would overflow a checked
    // multiply and REVERT the whole callback (leaving the request stuck UnderReview).
    // The saturating cap must instead bind `requestedAmount`.
    const HUGE = (1n << 255n); // × quantity(10) overflows uint256
    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n, 10n);
    await expect(platform.triggerRuling(target, requestId, ruling(Decision.Approve, HUGE)))
      .to.emit(contract, "Ruled")
      .withArgs(reqId, requestId, Decision.Approve, 2000n, RATIONALE_HASH, CLAUSE_REF, RECEIPT_ID);
    expect(await contract.stateOf(reqId)).to.equal(State.Approved);
    expect(await contract.coveredAmountOf(reqId)).to.equal(2000n); // requested binds (cap saturated)

    // priceBasisOf must not revert either: costPlusTotal saturates at uint256 max.
    const basis = await contract.priceBasisOf(reqId);
    expect(basis.costPlusTotal).to.equal(ethers.MaxUint256);
    expect(basis.coveredAmount).to.equal(2000n);
  });

  it("T5 (R6b): policy_invalid → PolicyFlagged + Ruled + terminal PolicyInvalidated", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();
    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);

    await expect(
      platform.triggerRuling(target, requestId, ruling(Decision.PolicyInvalid, 150n))
    )
      .to.emit(contract, "PolicyFlagged")
      .withArgs(reqId, CLAUSE_REF, STANDARD_REF)
      .and.to.emit(contract, "Ruled")
      .withArgs(reqId, requestId, Decision.PolicyInvalid, 0n, RATIONALE_HASH, CLAUSE_REF, RECEIPT_ID)
      .and.to.emit(contract, "PolicyInvalidated")
      .withArgs(reqId, CLAUSE_REF, STANDARD_REF);

    expect(await contract.stateOf(reqId)).to.equal(State.PolicyInvalidated);
    expect(await contract.coveredAmountOf(reqId)).to.equal(0n);
    const n = await contract.getNegotiation(reqId);
    expect(n.standardRef).to.equal(STANDARD_REF);
    expect(n.clauseRef).to.equal(CLAUSE_REF);

    // Terminal: withdraw reverts.
    await expect(contract.connect(provider).withdraw(reqId)).to.be.revertedWith("withdraw: terminal");
  });

  it("T6 (R6c): appeal with evidence re-fires + round++; empty-evidence appeal reverts; N rounds → Deadlocked", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();

    // Shrink the round cap to make deadlock concise (owner == deployer == provider/signer[0]).
    await contract.setMaxRounds(2n);
    expect(await contract.maxRounds()).to.equal(2n);

    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
    expect(await contract.roundOf(reqId)).to.equal(1n); // initial round

    // First ruling: deny.
    await platform.triggerRuling(target, requestId, ruling(Decision.Deny, 0n));
    expect(await contract.stateOf(reqId)).to.equal(State.Denied);

    // price-only / empty-evidence appeal reverts.
    await expect(
      contract.connect(insurer).appeal(reqId, INSURER_ID, ethers.ZeroHash, REASON_HASH, { value: FEE })
    ).to.be.revertedWith("appeal: needs evidence");

    // appeal with new evidence (round 1 < maxRounds 2) → re-fires, round becomes 2.
    expect((await contract.getNegotiation(reqId)).appealRound).to.equal(0); // before bump
    await expect(contract.connect(provider).appeal(reqId, PROVIDER_ID, EVIDENCE_URI_2, REASON_HASH, { value: FEE }))
      .to.emit(contract, "Appealed")
      .withArgs(reqId, PROVIDER_ID, EVIDENCE_URI_2, 2n);
    expect(await contract.stateOf(reqId)).to.equal(State.UnderReview);
    expect(await contract.roundOf(reqId)).to.equal(2n);
    // SPEC-0004 R13: appealRound advances the LADDER position on each successful appeal.
    expect((await contract.getNegotiation(reqId)).appealRound).to.equal(1);

    // Resolve the re-fired round (deny again), then a further appeal at round>=maxRounds → Deadlocked.
    const rid2 = await platform.lastRequestId();
    await platform.triggerRuling(target, rid2, ruling(Decision.Deny, 0n));
    expect(await contract.stateOf(reqId)).to.equal(State.Denied);

    await expect(contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE }))
      .to.emit(contract, "Deadlocked")
      .withArgs(reqId, 2n);
    expect(await contract.stateOf(reqId)).to.equal(State.Deadlocked);
  });

  it("R14a (SPEC-0004 §2.4): appeal from Approved reverts — only Deny justifies advancing the ladder", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();
    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
    await platform.triggerRuling(target, requestId, ruling(Decision.Approve, 0n));
    expect(await contract.stateOf(reqId)).to.equal(State.Approved);
    await expect(
      contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI_2, REASON_HASH, { value: FEE })
    ).to.be.revertedWith("appeal: prior ruling not Deny");
  });

  it("T6/T8 (R6c/R8): both accept → settle emits Settled(coveredAmount, feePerParty 50/50)", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();
    // requested=2000, qty=10, costPlus/unit=120 → cap=1200 (binds) → covered=1200.
    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n, 10n);

    await platform.triggerRuling(target, requestId, ruling(Decision.Approve, 120n));
    expect(await contract.stateOf(reqId)).to.equal(State.Approved);
    expect(await contract.coveredAmountOf(reqId)).to.equal(1200n);

    // settle before mutual accept reverts.
    await expect(contract.connect(provider).settle(reqId)).to.be.revertedWith("settle: not both accepted");

    await expect(contract.connect(provider).accept(reqId, PROVIDER_ID))
      .to.emit(contract, "Accepted")
      .withArgs(reqId, PROVIDER_ID);
    await expect(contract.connect(insurer).accept(reqId, INSURER_ID))
      .to.emit(contract, "Accepted")
      .withArgs(reqId, INSURER_ID);

    // totalFees accumulated one fire (the mock deposit). feePerParty == totalFees/2.
    const n = await contract.getNegotiation(reqId);
    const expectedFeePerParty = n.totalFees / 2n;
    await expect(contract.connect(insurer).settle(reqId))
      .to.emit(contract, "Settled")
      .withArgs(reqId, 1200n, expectedFeePerParty);
    expect(await contract.stateOf(reqId)).to.equal(State.Settled);
    expect(await contract.coveredAmountOf(reqId)).to.equal(1200n);
  });

  it("T7 (R7): provider refuse from Ready → ProviderRefused; refuse from Open reverts; insurer cannot refuse", async () => {
    const { contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();

    // From Open: refuse reverts (no terms attached yet).
    const reqId = await createAs(contract, provider, insurer.address);
    await expect(contract.connect(provider).refuse(reqId, REASON_HASH)).to.be.revertedWith("refuse: not refusable");

    // Engage → Ready.
    await contract.connect(insurer).insurerEngage(reqId, POLICY_HASH, POLICY_URI);

    // Insurer cannot refuse (provider-only).
    await expect(contract.connect(insurer).refuse(reqId, REASON_HASH)).to.be.revertedWith("auth: not provider");

    // Provider refuses from Ready → ProviderRefused.
    await expect(contract.connect(provider).refuse(reqId, REASON_HASH))
      .to.emit(contract, "ProviderRefused")
      .withArgs(reqId, REASON_HASH);
    expect(await contract.stateOf(reqId)).to.equal(State.ProviderRefused);
  });

  it("T9 (R11/R12/R13): third wallet reverts on every party action; reads open; single shared wallet works", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer, attacker] = await ethers.getSigners();
    const target = await contract.getAddress();

    // --- createContract with a mismatched providerAddr reverts (caller must be provider) ---
    await expect(
      contract
        .connect(attacker)
        .createContract(
          PROVIDER_ID,
          INSURER_ID,
          provider.address, // claims to be provider but caller is attacker
          insurer.address,
          DRUG_REF,
          REQUESTED,
          QUANTITY,
          DAYS_SUPPLY,
          JUSTIFICATION_HASH,
          EVIDENCE_URI,
          0 /* payerLine: PartD */
        )
    ).to.be.revertedWith("auth: not provider");

    // Build a live request and drive it to a ruled state for the broad gating sweep.
    const reqId = await createAs(contract, provider, insurer.address);

    // attacker (not insurer) cannot engage.
    await expect(
      contract.connect(attacker).insurerEngage(reqId, POLICY_HASH, POLICY_URI)
    ).to.be.revertedWith("auth: not insurer");
    await contract.connect(insurer).insurerEngage(reqId, POLICY_HASH, POLICY_URI);

    // attacker cannot adjudicate / refuse / withdraw / feedback.
    await expect(
      contract.connect(attacker).requestAdjudication(reqId, { value: FEE })
    ).to.be.revertedWith("auth: not a party");
    await expect(contract.connect(attacker).refuse(reqId, REASON_HASH)).to.be.revertedWith("auth: not provider");
    await expect(contract.connect(attacker).withdraw(reqId)).to.be.revertedWith("auth: not a party");
    await expect(
      contract.connect(attacker).postFeedback(reqId, RATIONALE_HASH, EVIDENCE_URI)
    ).to.be.revertedWith("auth: not a party");

    // A party CAN post feedback (no state change).
    await expect(contract.connect(provider).postFeedback(reqId, RATIONALE_HASH, EVIDENCE_URI)).to.emit(
      contract,
      "FeedbackPosted"
    );

    await contract.connect(provider).requestAdjudication(reqId, { value: FEE });
    const requestId = await platform.lastRequestId();

    // attacker cannot submitEvidence even when applicable — first drive to EvidenceRequested.
    await platform.triggerRuling(target, requestId, ruling(Decision.NeedMoreEvidence, 0n));
    await expect(
      contract.connect(attacker).submitEvidence(reqId, EVIDENCE_URI_2, { value: FEE })
    ).to.be.revertedWith("auth: not provider");
    await contract.connect(provider).submitEvidence(reqId, EVIDENCE_URI_2, { value: FEE });
    const rid2 = await platform.lastRequestId();
    await platform.triggerRuling(target, rid2, ruling(Decision.Deny, 0n));

    // attacker cannot appeal / accept / settle on a ruled request.
    await expect(
      contract.connect(attacker).appeal(reqId, PROVIDER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
    ).to.be.revertedWith("auth: not a party");
    await expect(contract.connect(attacker).accept(reqId, PROVIDER_ID)).to.be.revertedWith("auth: not a party");
    await expect(contract.connect(attacker).settle(reqId)).to.be.revertedWith("auth: not a party");

    // --- Reads are public: the attacker (and anyone) can read. ---
    expect(await contract.connect(attacker).stateOf(reqId)).to.equal(State.Denied);
    expect(await contract.connect(attacker).coveredAmountOf(reqId)).to.equal(0n);
    const n = await contract.connect(attacker).getNegotiation(reqId);
    expect(n.providerAddr).to.equal(provider.address);

    // --- SPEC-0004 R2b (supersedes SPEC-0001 R13): providerAddr == insurerAddr is now
    //     rejected at createContract. The single-shared-wallet scenario that was valid
    //     under R13 is no longer supported; the demo explicitly rejects self-contracting. ---
    await expect(
      contract
        .connect(provider)
        .createContract(PROVIDER_ID, INSURER_ID, provider.address, provider.address, DRUG_REF, REQUESTED, QUANTITY, DAYS_SUPPLY, JUSTIFICATION_HASH, EVIDENCE_URI, 0 /* payerLine: PartD */)
    ).to.be.revertedWith("create: self-contract");
  });

  it("R9 (fee model): underfunded reverts; exact fee forwarded; overpayment refunded; no trapped caller ETH", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();
    const deposit = await platform.deposit(); // 0.001 ether; fee == deposit (agentReward 0)

    const reqId = await createAs(contract, provider, insurer.address);
    await contract.connect(insurer).insurerEngage(reqId, POLICY_HASH, POLICY_URI);

    // --- Underfunded: msg.value < fee reverts; no agent fires. ---
    await expect(
      contract.connect(provider).requestAdjudication(reqId, { value: deposit - 1n })
    ).to.be.revertedWith("fee: underfunded");
    expect(await platform.createRequestCalls()).to.equal(0n);
    expect(await contract.stateOf(reqId)).to.equal(State.Ready); // unchanged

    // --- Exact fee: forwards exactly `fee`, traps nothing, contract balance stays 0. ---
    await expect(contract.connect(provider).requestAdjudication(reqId, { value: deposit }))
      .to.emit(contract, "RulingRequested");
    expect(await platform.lastValue()).to.equal(deposit); // mock received exactly the fee
    expect(await ethers.provider.getBalance(target)).to.equal(0n); // nothing trapped

    // --- Overpayment: excess (msg.value - fee) refunded to the caller; contract keeps 0. ---
    const reqId2 = await createAs(contract, provider, insurer.address);
    await contract.connect(insurer).insurerEngage(reqId2, POLICY_HASH, POLICY_URI);
    const overpay = ethers.parseEther("0.05");
    const balBefore = await ethers.provider.getBalance(provider.address);
    const tx = await contract.connect(provider).requestAdjudication(reqId2, { value: overpay });
    const rc = await tx.wait();
    const gas = rc!.gasUsed * rc!.gasPrice;
    const balAfter = await ethers.provider.getBalance(provider.address);
    // Net cost to caller is exactly the fee + gas (excess fully refunded).
    expect(balBefore - balAfter).to.equal(deposit + gas);
    expect(await platform.lastValue()).to.equal(deposit); // still exactly the fee forwarded
    expect(await ethers.provider.getBalance(target)).to.equal(0n); // no trapped caller ETH

    // --- submitEvidence / appeal honour the same fee model (overpayment refunded). ---
    const { reqId: r3, requestId: rq3 } = await createEngageAdjudicate(contract, platform, provider, insurer);
    await platform.triggerRuling(target, rq3, ruling(Decision.NeedMoreEvidence, 0n));
    await expect(
      contract.connect(provider).submitEvidence(r3, EVIDENCE_URI_2, { value: deposit - 1n })
    ).to.be.revertedWith("fee: underfunded");
    await contract.connect(provider).submitEvidence(r3, EVIDENCE_URI_2, { value: FEE });
    expect(await ethers.provider.getBalance(target)).to.equal(0n);

    const { reqId: r4, requestId: rq4 } = await createEngageAdjudicate(contract, platform, provider, insurer);
    await platform.triggerRuling(target, rq4, ruling(Decision.Deny, 0n));
    await expect(
      contract.connect(provider).appeal(r4, PROVIDER_ID, EVIDENCE_URI_2, REASON_HASH, { value: deposit - 1n })
    ).to.be.revertedWith("fee: underfunded");
    await contract.connect(provider).appeal(r4, PROVIDER_ID, EVIDENCE_URI_2, REASON_HASH, { value: FEE });
    expect(await ethers.provider.getBalance(target)).to.equal(0n);
  });

  it("R9 (deadlock appeal): an appeal at the round cap refunds the full msg.value (no agent fires)", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();
    await contract.setMaxRounds(1n); // first ruling already at the cap

    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
    await platform.triggerRuling(target, requestId, ruling(Decision.Deny, 0n));
    expect(await contract.roundOf(reqId)).to.equal(1n); // round == maxRounds

    const value = ethers.parseEther("0.02");
    const balBefore = await ethers.provider.getBalance(insurer.address);
    const tx = await contract
      .connect(insurer)
      .appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value });
    const rc = await tx.wait();
    const gas = rc!.gasUsed * rc!.gasPrice;
    const balAfter = await ethers.provider.getBalance(insurer.address);
    // Deadlocked: no fee charged, full value refunded → net cost is just gas.
    expect(balBefore - balAfter).to.equal(gas);
    expect(await contract.stateOf(reqId)).to.equal(State.Deadlocked);
    expect(await ethers.provider.getBalance(target)).to.equal(0n);
    // SPEC-0004 R13: `appealRound` MUST NOT bump on the deadlock-cap short-circuit
    // path — the ladder advances only when an appeal actually fires the agent.
    const n = await contract.getNegotiation(reqId);
    expect(n.appealRound).to.equal(0);
  });

  it("R9 (deadlock submitEvidence): submitEvidence at the round cap deadlocks and refunds the full msg.value (no agent fires)", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();
    await contract.setMaxRounds(1n); // first ruling already at the cap

    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
    // NeedMoreEvidence ruling routes to EvidenceRequested with round == maxRounds.
    await platform.triggerRuling(target, requestId, ruling(Decision.NeedMoreEvidence, 0n));
    expect(await contract.stateOf(reqId)).to.equal(State.EvidenceRequested);
    expect(await contract.roundOf(reqId)).to.equal(1n); // round == maxRounds

    const value = ethers.parseEther("0.02");
    const balBefore = await ethers.provider.getBalance(provider.address);
    const tx = await contract.connect(provider).submitEvidence(reqId, EVIDENCE_URI_2, { value });
    const rc = await tx.wait();
    const gas = rc!.gasUsed * rc!.gasPrice;
    const balAfter = await ethers.provider.getBalance(provider.address);
    // Deadlocked: no fee charged, full value refunded → net cost is just gas.
    expect(balBefore - balAfter).to.equal(gas);
    expect(await contract.stateOf(reqId)).to.equal(State.Deadlocked);
    expect(await ethers.provider.getBalance(target)).to.equal(0n);
  });

  it("T10 (guards): invalid transitions revert; handleResponse rejects non-platform caller; unknown id reverts", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer, attacker] = await ethers.getSigners();
    const reqId = await createAs(contract, provider, insurer.address);

    // From Open: ruling-dependent actions revert.
    await expect(contract.connect(provider).requestAdjudication(reqId, { value: FEE })).to.be.revertedWith(
      "adjudicate: not Ready"
    );
    await expect(contract.connect(provider).settle(reqId)).to.be.revertedWith("settle: not ruled");
    await expect(contract.connect(provider).accept(reqId, PROVIDER_ID)).to.be.revertedWith("accept: not ruled");
    await expect(
      contract.connect(provider).appeal(reqId, PROVIDER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
    ).to.be.revertedWith("appeal: prior ruling not Deny");
    // submitEvidence reverts on the state guard before the fee check — no value needed here.
    await expect(
      contract.connect(provider).submitEvidence(reqId, EVIDENCE_URI)
    ).to.be.revertedWith("evidence: wrong state");

    // Non-platform caller cannot invoke the callback. Encode the new arbiter tuple.
    const fakeResult = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8", "uint256", "uint256", "bytes32", "bytes32", "bytes32", "uint256"],
      [Decision.Approve, 150n, NADAC_UNIT, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID]
    );
    const fakeResponses = [
      {
        validator: attacker.address,
        result: fakeResult,
        status: ResponseStatus.Success,
        receipt: RECEIPT_ID,
        timestamp: 0n,
        executionCost: 0n,
      },
    ];
    const fakeReq = {
      id: 1n,
      requester: attacker.address,
      callbackAddress: attacker.address,
      callbackSelector: "0x00000000",
      subcommittee: [],
      responses: [],
      responseCount: 0n,
      failureCount: 0n,
      threshold: 0n,
      createdAt: 0n,
      deadline: 0n,
      status: ResponseStatus.Success,
      consensusType: 0,
      remainingBudget: 0n,
      perAgentBudget: 0n,
    };
    await expect(
      contract.connect(attacker).handleResponse(1n, fakeResponses, ResponseStatus.Success, fakeReq)
    ).to.be.revertedWith("callback: not platform");

    // Unknown contract id reverts on reads.
    await expect(contract.getNegotiation(999n)).to.be.revertedWith("unknown contract");
    expect(await platform.createRequestCalls()).to.equal(0n);
  });

  it("Security: CEI (UnderReview during createRequest); withdraw clears in-flight request; withdrawFunds owner-gated", async () => {
    const { platform, contract } = await deploy();
    const [owner, insurer, attacker] = await ethers.getSigners();
    const provider = owner; // deployer is owner and acts as provider here
    const target = await contract.getAddress();

    // --- CEI: the negotiation is already UnderReview WHILE createRequest runs. ---
    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
    expect(await platform.observedStateDuringCreate()).to.equal(Number(State.UnderReview));

    // --- withdraw during UnderReview clears the pending request; a late ruling can no
    //     longer mutate the (now Withdrawn) negotiation. ---
    await expect(contract.connect(provider).withdraw(reqId)).to.emit(contract, "Withdrawn").withArgs(reqId);
    expect(await contract.stateOf(reqId)).to.equal(State.Withdrawn);
    await expect(
      platform.triggerRuling(target, requestId, ruling(Decision.Approve, 1n))
    ).to.be.revertedWith("callback: unknown request");
    expect(await contract.stateOf(reqId)).to.equal(State.Withdrawn);

    // --- withdrawFunds: owner-only, bounded by balance, transfers out. ---
    await owner.sendTransaction({ to: target, value: ethers.parseEther("1") });
    const bal = await ethers.provider.getBalance(target);
    expect(bal).to.be.greaterThan(0n);

    await expect(
      contract.connect(attacker).withdrawFunds(attacker.address, 1n)
    ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    await expect(contract.withdrawFunds(owner.address, bal + 1n)).to.be.revertedWith("funds: insufficient");

    await expect(contract.withdrawFunds(owner.address, bal))
      .to.emit(contract, "FundsWithdrawn")
      .withArgs(owner.address, bal);
    expect(await ethers.provider.getBalance(target)).to.equal(0n);
  });

  // -----------------------------------------------------------------------
  // UNIT-2-followup-A: appeal() reverts from every non-Denied state.
  //
  // The contract checks `require(n.state == State.Denied, "appeal: prior ruling
  // not Deny")` as its FIRST guard — before auth — so ALL nine non-Denied states
  // produce exactly that revert string.  `Open` is already covered by T10
  // (~line 757 above); `Denied` is the only state from which appeal succeeds
  // (T6 R6c).  This suite drives a FRESH deploy for each target state and
  // asserts the unanimous revert.
  // -----------------------------------------------------------------------
  describe("UNIT-2-followup-A: appeal reverts from every non-Denied state", () => {
    /**
     * Drive a fresh deploy to the named state, then assert that calling
     * appeal() reverts with "appeal: prior ruling not Deny".
     *
     * State-driving notes:
     *  - Ready           : createAs + insurerEngage
     *  - UnderReview     : createEngageAdjudicate (agent in flight, no ruling yet)
     *  - EvidenceRequested: createEngageAdjudicate + triggerRuling(NeedMoreEvidence)
     *  - Approved        : createEngageAdjudicate + triggerRuling(Approve)
     *  - Settled         : Approved + both accept + settle
     *  - Deadlocked      : setMaxRounds(1) + createEngageAdjudicate + triggerRuling(Deny)
     *                      + appeal() deadlocks at cap → second appeal attempt from Deadlocked
     *  - PolicyInvalidated: createEngageAdjudicate + triggerRuling(PolicyInvalid)
     *  - ProviderRefused : createAs + insurerEngage + provider.refuse(reqId, reasonHash)
     *  - Withdrawn       : createAs + provider.withdraw(reqId)
     */

    it("Ready: appeal reverts with 'appeal: prior ruling not Deny'", async () => {
      const { contract } = await deploy();
      const [provider, insurer] = await ethers.getSigners();
      const reqId = await createAs(contract, provider, insurer.address);
      await contract.connect(insurer).insurerEngage(reqId, POLICY_HASH, POLICY_URI);
      expect(await contract.stateOf(reqId)).to.equal(State.Ready);
      await expect(
        contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
      ).to.be.revertedWith("appeal: prior ruling not Deny");
    });

    it("UnderReview: appeal reverts with 'appeal: prior ruling not Deny'", async () => {
      const { platform, contract } = await deploy();
      const [provider, insurer] = await ethers.getSigners();
      const { reqId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      expect(await contract.stateOf(reqId)).to.equal(State.UnderReview);
      await expect(
        contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
      ).to.be.revertedWith("appeal: prior ruling not Deny");
    });

    it("EvidenceRequested: appeal reverts with 'appeal: prior ruling not Deny'", async () => {
      const { platform, contract } = await deploy();
      const [provider, insurer] = await ethers.getSigners();
      const target = await contract.getAddress();
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await platform.triggerRuling(target, requestId, ruling(Decision.NeedMoreEvidence, 0n));
      expect(await contract.stateOf(reqId)).to.equal(State.EvidenceRequested);
      await expect(
        contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
      ).to.be.revertedWith("appeal: prior ruling not Deny");
    });

    it("Approved: appeal reverts with 'appeal: prior ruling not Deny'", async () => {
      const { platform, contract } = await deploy();
      const [provider, insurer] = await ethers.getSigners();
      const target = await contract.getAddress();
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await platform.triggerRuling(target, requestId, ruling(Decision.Approve, 150n));
      expect(await contract.stateOf(reqId)).to.equal(State.Approved);
      await expect(
        contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
      ).to.be.revertedWith("appeal: prior ruling not Deny");
    });

    it("Settled: appeal reverts with 'appeal: prior ruling not Deny'", async () => {
      const { platform, contract } = await deploy();
      const [provider, insurer] = await ethers.getSigners();
      const target = await contract.getAddress();
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n, 10n);
      await platform.triggerRuling(target, requestId, ruling(Decision.Approve, 120n));
      await contract.connect(provider).accept(reqId, PROVIDER_ID);
      await contract.connect(insurer).accept(reqId, INSURER_ID);
      await contract.connect(insurer).settle(reqId);
      expect(await contract.stateOf(reqId)).to.equal(State.Settled);
      // Settled is terminal; the state guard fires before any other check.
      await expect(
        contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
      ).to.be.revertedWith("appeal: prior ruling not Deny");
    });

    it("Deadlocked: appeal reverts with 'appeal: prior ruling not Deny'", async () => {
      const { platform, contract } = await deploy();
      const [provider, insurer] = await ethers.getSigners();
      const target = await contract.getAddress();
      // setMaxRounds(1) so the first appeal immediately deadlocks.
      await contract.setMaxRounds(1n);
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await platform.triggerRuling(target, requestId, ruling(Decision.Deny, 0n));
      // This appeal at round == maxRounds transitions to Deadlocked (no second fire).
      await contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE });
      expect(await contract.stateOf(reqId)).to.equal(State.Deadlocked);
      // Now attempt a second appeal from Deadlocked.
      await expect(
        contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
      ).to.be.revertedWith("appeal: prior ruling not Deny");
    });

    it("PolicyInvalidated: appeal reverts with 'appeal: prior ruling not Deny'", async () => {
      const { platform, contract } = await deploy();
      const [provider, insurer] = await ethers.getSigners();
      const target = await contract.getAddress();
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await platform.triggerRuling(target, requestId, ruling(Decision.PolicyInvalid, 0n));
      expect(await contract.stateOf(reqId)).to.equal(State.PolicyInvalidated);
      await expect(
        contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
      ).to.be.revertedWith("appeal: prior ruling not Deny");
    });

    it("ProviderRefused: appeal reverts with 'appeal: prior ruling not Deny'", async () => {
      const { contract } = await deploy();
      const [provider, insurer] = await ethers.getSigners();
      const reqId = await createAs(contract, provider, insurer.address);
      await contract.connect(insurer).insurerEngage(reqId, POLICY_HASH, POLICY_URI);
      await contract.connect(provider).refuse(reqId, REASON_HASH);
      expect(await contract.stateOf(reqId)).to.equal(State.ProviderRefused);
      // appeal() checks state first (before auth), so even this terminal state
      // reverts with the state guard message.
      await expect(
        contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
      ).to.be.revertedWith("appeal: prior ruling not Deny");
    });

    it("Withdrawn: appeal reverts with 'appeal: prior ruling not Deny'", async () => {
      const { contract } = await deploy();
      const [provider, insurer] = await ethers.getSigners();
      const reqId = await createAs(contract, provider, insurer.address);
      await contract.connect(provider).withdraw(reqId);
      expect(await contract.stateOf(reqId)).to.equal(State.Withdrawn);
      await expect(
        contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE })
      ).to.be.revertedWith("appeal: prior ruling not Deny");
    });
  });
});

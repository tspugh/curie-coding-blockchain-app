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
const RECEIPT_ID = 999n;
const FEE = ethers.parseEther("0.01"); // > mock deposit (0.001 ether)

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
  requestedAmount = REQUESTED
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
      JUSTIFICATION_HASH,
      EVIDENCE_URI
    );
  return contract.count();
}

/** Create → engage (insurer) → adjudicate (provider). Returns { reqId, requestId }. */
async function createEngageAdjudicate(
  contract: CoverageNegotiation,
  platform: MockAgentPlatform,
  provider: HardhatEthersSigner,
  insurer: HardhatEthersSigner,
  requestedAmount = REQUESTED
) {
  const reqId = await createAs(contract, provider, insurer.address, requestedAmount);
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
          JUSTIFICATION_HASH,
          EVIDENCE_URI
        )
    )
      .to.emit(contract, "ContractCreated")
      .withArgs(1n, PROVIDER_ID, INSURER_ID, provider.address, insurer.address, DRUG_REF, REQUESTED);

    // T1: getter exposes only hashes/refs/amounts — no raw-content field exists.
    const n = await contract.getNegotiation(1n);
    expect(n.justificationHash).to.equal(JUSTIFICATION_HASH);
    expect(n.drugRef).to.equal(DRUG_REF);
    expect(n.evidenceUri).to.equal(EVIDENCE_URI);
    expect(n.requestedAmount).to.equal(REQUESTED);
    expect(n.state).to.equal(State.Open);

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

  it("T4 (R6a): approve covers min(requested,cap) both ways; deny → 0; refs surfaced & stored; need_more_evidence & failure → EvidenceRequested", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();

    // cap < requested → covered == cap
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n);
      await expect(
        platform.triggerRuling(target, requestId, Decision.Approve, 1500n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID)
      )
        .to.emit(contract, "Ruled")
        .withArgs(reqId, requestId, Decision.Approve, 1500n, RATIONALE_HASH, CLAUSE_REF, RECEIPT_ID);
      expect(await contract.stateOf(reqId)).to.equal(State.Approved);
      expect(await contract.coveredAmountOf(reqId)).to.equal(1500n);
      // Refs are stored on the negotiation.
      const n = await contract.getNegotiation(reqId);
      expect(n.rationaleHash).to.equal(RATIONALE_HASH);
      expect(n.clauseRef).to.equal(CLAUSE_REF);
      expect(n.standardRef).to.equal(STANDARD_REF);
      expect(n.lastDecision).to.equal(BigInt(Decision.Approve));
      expect(n.hasRuling).to.equal(true);
    }

    // cap >= requested → covered == requested
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n);
      await platform.triggerRuling(target, requestId, Decision.Approve, 5000n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID);
      expect(await contract.stateOf(reqId)).to.equal(State.Approved);
      expect(await contract.coveredAmountOf(reqId)).to.equal(2000n);
    }

    // deny → Denied, covered 0
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await expect(
        platform.triggerRuling(target, requestId, Decision.Deny, 1500n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID)
      )
        .to.emit(contract, "Ruled")
        .withArgs(reqId, requestId, Decision.Deny, 0n, RATIONALE_HASH, CLAUSE_REF, RECEIPT_ID);
      expect(await contract.stateOf(reqId)).to.equal(State.Denied);
      expect(await contract.coveredAmountOf(reqId)).to.equal(0n);
    }

    // need_more_evidence → EvidenceRequested; submitEvidence re-fires (round++) → UnderReview
    {
      const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
      await expect(
        platform.triggerRuling(target, requestId, Decision.NeedMoreEvidence, 0n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID)
      ).to.emit(contract, "EvidenceRequested");
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

  it("T5 (R6b): policy_invalid → PolicyFlagged + Ruled + terminal PolicyInvalidated", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();
    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);

    await expect(
      platform.triggerRuling(target, requestId, Decision.PolicyInvalid, 1500n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID)
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
    await platform.triggerRuling(target, requestId, Decision.Deny, 0n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID);
    expect(await contract.stateOf(reqId)).to.equal(State.Denied);

    // price-only / empty-evidence appeal reverts.
    await expect(
      contract.connect(insurer).appeal(reqId, INSURER_ID, ethers.ZeroHash, REASON_HASH, { value: FEE })
    ).to.be.revertedWith("appeal: needs evidence");

    // appeal with new evidence (round 1 < maxRounds 2) → re-fires, round becomes 2.
    await expect(contract.connect(provider).appeal(reqId, PROVIDER_ID, EVIDENCE_URI_2, REASON_HASH, { value: FEE }))
      .to.emit(contract, "Appealed")
      .withArgs(reqId, PROVIDER_ID, EVIDENCE_URI_2, 2n);
    expect(await contract.stateOf(reqId)).to.equal(State.UnderReview);
    expect(await contract.roundOf(reqId)).to.equal(2n);

    // Resolve the re-fired round (deny again), then a further appeal at round>=maxRounds → Deadlocked.
    const rid2 = await platform.lastRequestId();
    await platform.triggerRuling(target, rid2, Decision.Deny, 0n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID);
    expect(await contract.stateOf(reqId)).to.equal(State.Denied);

    await expect(contract.connect(insurer).appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH, { value: FEE }))
      .to.emit(contract, "Deadlocked")
      .withArgs(reqId, 2n);
    expect(await contract.stateOf(reqId)).to.equal(State.Deadlocked);
  });

  it("T6/T8 (R6c/R8): both accept → settle emits Settled(coveredAmount, feePerParty 50/50)", async () => {
    const { platform, contract } = await deploy();
    const [provider, insurer] = await ethers.getSigners();
    const target = await contract.getAddress();
    const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer, 2000n);

    await platform.triggerRuling(target, requestId, Decision.Approve, 1200n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID);
    expect(await contract.stateOf(reqId)).to.equal(State.Approved);

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
          JUSTIFICATION_HASH,
          EVIDENCE_URI
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
    await platform.triggerRuling(target, requestId, Decision.NeedMoreEvidence, 0n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID);
    await expect(
      contract.connect(attacker).submitEvidence(reqId, EVIDENCE_URI_2, { value: FEE })
    ).to.be.revertedWith("auth: not provider");
    await contract.connect(provider).submitEvidence(reqId, EVIDENCE_URI_2, { value: FEE });
    const rid2 = await platform.lastRequestId();
    await platform.triggerRuling(target, rid2, Decision.Deny, 0n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID);

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

    // --- Single shared wallet (R12/R13): providerAddr == insurerAddr; one signer does both
    //     sides, parties distinguished by partyId. ---
    const solo = provider; // one wallet plays both roles
    await contract
      .connect(solo)
      .createContract(PROVIDER_ID, INSURER_ID, solo.address, solo.address, DRUG_REF, REQUESTED, JUSTIFICATION_HASH, EVIDENCE_URI);
    const soloId = await contract.count();
    // same wallet engages (insurer side) and adjudicates (provider side).
    await contract.connect(solo).insurerEngage(soloId, POLICY_HASH, POLICY_URI);
    await contract.connect(solo).requestAdjudication(soloId, { value: FEE });
    const soloReq = await platform.lastRequestId();
    await platform.triggerRuling(target, soloReq, Decision.Approve, 1000n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID);
    // same wallet accepts BOTH sides (distinguished by partyId), then settles.
    await contract.connect(solo).accept(soloId, PROVIDER_ID);
    await contract.connect(solo).accept(soloId, INSURER_ID);
    await expect(contract.connect(solo).settle(soloId)).to.emit(contract, "Settled");
    expect(await contract.stateOf(soloId)).to.equal(State.Settled);
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
    ).to.be.revertedWith("appeal: not ruled");
    await expect(
      contract.connect(provider).submitEvidence(reqId, EVIDENCE_URI, { value: FEE })
    ).to.be.revertedWith("evidence: wrong state");

    // Non-platform caller cannot invoke the callback. Encode the new arbiter tuple.
    const fakeResult = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8", "uint256", "bytes32", "bytes32", "bytes32", "uint256"],
      [Decision.Approve, 1500n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID]
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
      platform.triggerRuling(target, requestId, Decision.Approve, 1n, RATIONALE_HASH, CLAUSE_REF, STANDARD_REF, RECEIPT_ID)
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
});

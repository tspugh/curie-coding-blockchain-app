import { expect } from "chai";
import { ethers } from "hardhat";
import { CoverageNegotiation, MockAgentPlatform } from "../typechain-types";

// State enum mirror (must match CoverageNegotiation.State order).
const State = {
  Open: 0n,
  Ready: 1n,
  UnderReview: 2n,
  EvidenceRequested: 3n,
  Approved: 4n,
  Denied: 5n,
  Appealed: 6n,
  Settled: 7n,
  Withdrawn: 8n,
} as const;

// ResponseStatus mirror.
const ResponseStatus = { None: 0, Pending: 1, Success: 2, Failed: 3, TimedOut: 4 } as const;

const INITIATOR = 11n;
const DESTINATION = 22n;
const DRUG_REF = ethers.id("DRUG:semaglutide");
const NOTE_HASH = ethers.id("sample-case-note-content");
const EVIDENCE_URI = ethers.id("ipfs://evidence");
const FLOOR = 1000n;
const CEIL = 2000n;
const FEE = ethers.parseEther("0.01"); // > mock deposit

/** Deploy a fresh mock platform + contract. */
async function deploy() {
  const Mock = await ethers.getContractFactory("MockAgentPlatform");
  const platform = (await Mock.deploy()) as unknown as MockAgentPlatform;
  await platform.waitForDeployment();

  const Factory = await ethers.getContractFactory("CoverageNegotiation");
  const contract = (await Factory.deploy(await platform.getAddress(), 7n)) as unknown as CoverageNegotiation;
  await contract.waitForDeployment();

  return { platform, contract };
}

/** Create a contract and return its id (== count after creation). */
async function createDefault(
  contract: CoverageNegotiation,
  initiatorId = INITIATOR,
  destinationId = DESTINATION
) {
  await contract.createContract(initiatorId, destinationId, DRUG_REF, NOTE_HASH, FLOOR, CEIL, EVIDENCE_URI);
  return contract.count();
}

/** Drive a contract from Open to Ready by submitting both positions. */
async function makeReady(contract: CoverageNegotiation, reqId: bigint) {
  await contract.submitPosition(reqId, INITIATOR, 1200n, ethers.ZeroHash, ethers.ZeroHash);
  await contract.submitPosition(reqId, DESTINATION, 1800n, ethers.ZeroHash, ethers.ZeroHash);
}

describe("CoverageNegotiation", () => {
  it("T1/T2: createContract emits ContractCreated, stores only hashes/refs, self-contract accepted", async () => {
    const { contract } = await deploy();

    await expect(contract.createContract(INITIATOR, DESTINATION, DRUG_REF, NOTE_HASH, FLOOR, CEIL, EVIDENCE_URI))
      .to.emit(contract, "ContractCreated")
      .withArgs(1n, INITIATOR, DESTINATION, DRUG_REF, FLOOR, CEIL);

    // Getter exposes only hashes/refs/amounts — no raw-content field exists.
    const n = await contract.getNegotiation(1n);
    expect(n.noteHash).to.equal(NOTE_HASH);
    expect(n.drugRef).to.equal(DRUG_REF);
    expect(await contract.noteHashOf(1n)).to.equal(NOTE_HASH);
    expect(n.state).to.equal(State.Open);

    // Self-contract (initiator == destination) is permitted.
    await expect(contract.createContract(INITIATOR, INITIATOR, DRUG_REF, NOTE_HASH, FLOOR, CEIL, EVIDENCE_URI))
      .to.emit(contract, "ContractCreated");
    expect((await contract.getNegotiation(2n)).initiatorId).to.equal(INITIATOR);
  });

  it("T3: one position keeps Open; both -> Ready (ContractReady); dispute reverts before Ready", async () => {
    const { contract } = await deploy();
    const reqId = await createDefault(contract);

    await expect(contract.submitDispute(reqId, INITIATOR, { value: FEE })).to.be.revertedWith("dispute: not Ready");

    await expect(contract.submitPosition(reqId, INITIATOR, 1200n, ethers.ZeroHash, ethers.ZeroHash))
      .to.emit(contract, "PositionSubmitted")
      .withArgs(reqId, INITIATOR, 1200n);
    expect(await contract.stateOf(reqId)).to.equal(State.Open);

    await expect(contract.submitPosition(reqId, DESTINATION, 1800n, ethers.ZeroHash, ethers.ZeroHash))
      .to.emit(contract, "ContractReady")
      .withArgs(reqId);
    expect(await contract.stateOf(reqId)).to.equal(State.Ready);

    // Second submit by same party reverts.
    await expect(
      contract.submitPosition(reqId, INITIATOR, 1n, ethers.ZeroHash, ethers.ZeroHash)
    ).to.be.revertedWith("not Open");
  });

  it("T4a: submitDispute fires the agent -> UnderReview; mock records the createRequest", async () => {
    const { platform, contract } = await deploy();
    const reqId = await createDefault(contract);
    await makeReady(contract, reqId);

    await expect(contract.submitDispute(reqId, INITIATOR, { value: FEE }))
      .to.emit(contract, "DisputeSubmitted")
      .and.to.emit(contract, "RulingRequested");

    expect(await contract.stateOf(reqId)).to.equal(State.UnderReview);
    expect(await platform.createRequestCalls()).to.equal(1n);
    // The selector forwarded is handleResponse's (the real Somnia callback).
    const sel = contract.interface.getFunction("handleResponse").selector;
    expect(await platform.lastCallbackSelector()).to.equal(sel);
    expect(await platform.lastCallbackAddress()).to.equal(await contract.getAddress());
    expect(await platform.lastAgentId()).to.equal(7n);
  });

  it("T4b: ruling routes approve/deny/need_more_evidence; failure/timeout -> EvidenceRequested; evidence & appeal re-fire", async () => {
    const { platform, contract } = await deploy();
    const target = await contract.getAddress();

    // approve -> Approved
    let reqId = await createDefault(contract);
    await makeReady(contract, reqId);
    await contract.submitDispute(reqId, INITIATOR, { value: FEE });
    let rid = await platform.lastRequestId();
    await expect(platform.triggerRuling(target, rid, "approve", 99n))
      .to.emit(contract, "Ruled")
      .withArgs(reqId, rid, "approve", 99n);
    expect(await contract.stateOf(reqId)).to.equal(State.Approved);

    // deny -> Denied, then appeal re-fires the agent -> UnderReview
    reqId = await createDefault(contract);
    await makeReady(contract, reqId);
    await contract.submitDispute(reqId, INITIATOR, { value: FEE });
    rid = await platform.lastRequestId();
    await platform.triggerRuling(target, rid, "deny", 1n);
    expect(await contract.stateOf(reqId)).to.equal(State.Denied);
    await expect(contract.appeal(reqId, EVIDENCE_URI, { value: FEE })).to.emit(contract, "Appealed");
    expect(await contract.stateOf(reqId)).to.equal(State.UnderReview);

    // need_more_evidence -> EvidenceRequested, then submitEvidence re-fires -> UnderReview
    reqId = await createDefault(contract);
    await makeReady(contract, reqId);
    await contract.submitDispute(reqId, INITIATOR, { value: FEE });
    rid = await platform.lastRequestId();
    await platform.triggerRuling(target, rid, "need_more_evidence", 2n);
    expect(await contract.stateOf(reqId)).to.equal(State.EvidenceRequested);
    await expect(contract.submitEvidence(reqId, EVIDENCE_URI, { value: FEE })).to.emit(contract, "EvidenceSubmitted");
    expect(await contract.stateOf(reqId)).to.equal(State.UnderReview);

    // platform Failed -> EvidenceRequested (retriable)
    reqId = await createDefault(contract);
    await makeReady(contract, reqId);
    await contract.submitDispute(reqId, INITIATOR, { value: FEE });
    rid = await platform.lastRequestId();
    await platform.triggerFailure(target, rid, ResponseStatus.Failed);
    expect(await contract.stateOf(reqId)).to.equal(State.EvidenceRequested);

    // onRulingTimeout -> EvidenceRequested after the deadline
    reqId = await createDefault(contract);
    await makeReady(contract, reqId);
    await contract.submitDispute(reqId, INITIATOR, { value: FEE });
    await expect(contract.onRulingTimeout(reqId)).to.be.revertedWith("timeout: too early");
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);
    await expect(contract.onRulingTimeout(reqId)).to.emit(contract, "RulingTimedOut");
    expect(await contract.stateOf(reqId)).to.equal(State.EvidenceRequested);
  });

  it("T5: settle within band emits Settled; out-of-band reverts (event marker only)", async () => {
    const { platform, contract } = await deploy();
    const target = await contract.getAddress();
    const reqId = await createDefault(contract);
    await makeReady(contract, reqId);
    await contract.submitDispute(reqId, INITIATOR, { value: FEE });
    const rid = await platform.lastRequestId();
    await platform.triggerRuling(target, rid, "approve", 5n);

    await expect(contract.settle(reqId, 999n)).to.be.revertedWith("settle: out of band");
    await expect(contract.settle(reqId, 2001n)).to.be.revertedWith("settle: out of band");

    await expect(contract.settle(reqId, 1500n)).to.emit(contract, "Settled").withArgs(reqId, 1500n);
    expect(await contract.stateOf(reqId)).to.equal(State.Settled);
    expect((await contract.getNegotiation(reqId)).agreedAmount).to.equal(1500n);
  });

  it("T6: invalid transitions revert; callback rejects non-platform caller; withdraw works", async () => {
    const { platform, contract } = await deploy();
    const [, attacker] = await ethers.getSigners();
    const reqId = await createDefault(contract);

    // settle/appeal/evidence invalid from Open
    await expect(contract.settle(reqId, 1500n)).to.be.revertedWith("settle: not Approved");
    await expect(contract.appeal(reqId, EVIDENCE_URI, { value: FEE })).to.be.revertedWith("appeal: not Denied");
    await expect(contract.submitEvidence(reqId, EVIDENCE_URI, { value: FEE })).to.be.revertedWith(
      "evidence: wrong state"
    );

    // Non-platform caller cannot invoke the callback.
    const fakeResponses = [
      {
        validator: attacker.address,
        result: ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["approve"]),
        status: ResponseStatus.Success,
        receipt: 1n,
        timestamp: 0n,
        executionCost: 0n,
      },
    ];
    const fakeReq = {
      id: 1n, requester: attacker.address, callbackAddress: attacker.address, callbackSelector: "0x00000000",
      subcommittee: [], responses: [], responseCount: 0n, failureCount: 0n, threshold: 0n, createdAt: 0n,
      deadline: 0n, status: ResponseStatus.Success, consensusType: 0, remainingBudget: 0n, perAgentBudget: 0n,
    };
    await expect(
      contract.connect(attacker).handleResponse(1n, fakeResponses, ResponseStatus.Success, fakeReq)
    ).to.be.revertedWith("callback: not platform");

    // Withdraw from a pre-Settled state.
    await expect(contract.withdraw(reqId)).to.emit(contract, "Withdrawn").withArgs(reqId);
    expect(await contract.stateOf(reqId)).to.equal(State.Withdrawn);
    await expect(contract.withdraw(reqId)).to.be.revertedWith("withdraw: terminal");

    // Unknown contract id reverts.
    await expect(contract.getNegotiation(999n)).to.be.revertedWith("unknown contract");
    expect(await platform.createRequestCalls()).to.equal(0n);
  });

  it("T7: security hardening — CEI (state set before external call), withdraw clears in-flight request, withdrawFunds owner-gated", async () => {
    const { platform, contract } = await deploy();
    const target = await contract.getAddress();
    const [owner, attacker] = await ethers.getSigners();

    // --- CEI: the negotiation is already UnderReview WHILE createRequest runs ---
    let reqId = await createDefault(contract);
    await makeReady(contract, reqId);
    await contract.submitDispute(reqId, INITIATOR, { value: FEE });
    // The mock read stateOf(reqId) during createRequest; effects precede interaction.
    expect(await platform.observedStateDuringCreate()).to.equal(Number(State.UnderReview));

    // --- withdraw during UnderReview clears the pending request; a late ruling
    //     callback can no longer mutate the (now Withdrawn) negotiation ---
    const staleRid = await platform.lastRequestId();
    await expect(contract.withdraw(reqId)).to.emit(contract, "Withdrawn").withArgs(reqId);
    expect(await contract.stateOf(reqId)).to.equal(State.Withdrawn);
    // The cleared mapping makes the requestId unknown -> callback reverts, no mutation.
    await expect(platform.triggerRuling(target, staleRid, "approve", 1n)).to.be.revertedWith(
      "callback: unknown request"
    );
    expect(await contract.stateOf(reqId)).to.equal(State.Withdrawn);

    // --- withdrawFunds: owner-only, bounded by balance, transfers out ---
    // The contract already holds the dispute fee SURPLUS (submitDispute forwarded only
    // the deposit and kept the rest) — exactly the float withdrawFunds reclaims (R9).
    await owner.sendTransaction({ to: target, value: ethers.parseEther("1") });
    const bal = await ethers.provider.getBalance(target);
    expect(bal).to.be.greaterThan(ethers.parseEther("1"));

    await expect(
      contract.connect(attacker).withdrawFunds(attacker.address, 1n)
    ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    await expect(
      contract.withdrawFunds(owner.address, bal + 1n)
    ).to.be.revertedWith("funds: insufficient");

    await expect(contract.withdrawFunds(owner.address, bal))
      .to.emit(contract, "FundsWithdrawn")
      .withArgs(owner.address, bal);
    expect(await ethers.provider.getBalance(target)).to.equal(0n);
  });
});

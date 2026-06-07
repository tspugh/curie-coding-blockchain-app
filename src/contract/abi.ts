/**
 * Minimal ethers-compatible ABI for `CoverageNegotiation.sol`, hand-mirrored
 * from the deployed contract's function/event signatures (SPEC-0001 §3, revised
 * 2026-05-27 — necessity-arbiter model). Kept inline (rather than importing the
 * Hardhat artifact JSON, which lives outside `src/` and the TS `rootDir`) so the
 * library stays self-contained.
 *
 * The `Negotiation` struct tuple ordering matches the Solidity struct field
 * order EXACTLY so `getNegotiation` decodes correctly.
 */
export const COVERAGE_NEGOTIATION_ABI = [
  // --- Lifecycle (writes) ---
  "function createContract(uint256 providerId, uint256 insurerId, address providerAddr, address insurerAddr, bytes32 drugRef, uint256 requestedAmount, uint256 quantity, uint256 daysSupply, bytes32 justificationHash, bytes32 evidenceUri, uint8 payerLine, string agentEvidenceUrl, string agentPromptHint) external returns (uint256 reqId)",
  "function insurerEngage(uint256 reqId, bytes32 policyHash, bytes32 policyUri) external payable",
  "function requestAdjudication(uint256 reqId) external payable",
  // A0012 / SPEC-0007 R13: provider-only overload carrying de-identified attestations.
  "function requestAdjudication(uint256 reqId, tuple(bytes32 clauseId, bool attested, bytes32 evidenceUriHash)[] attestations) external payable",
  // A0009: evidence arg is now a public URL string (the re-scrape target); the
  // contract derives + emits its keccak audit hash, so the *event* sigs below
  // keep bytes32 evidenceUri.
  "function submitEvidence(uint256 reqId, string newEvidenceUrl) external payable",
  "function appeal(uint256 reqId, uint256 partyId, string newEvidenceUrl, bytes32 reasonHash) external payable",
  "function accept(uint256 reqId, uint256 partyId) external",
  "function settle(uint256 reqId) external",
  "function refuse(uint256 reqId, bytes32 reasonHash) external",
  "function withdraw(uint256 reqId) external",
  "function onRulingTimeout(uint256 reqId) external",
  "function postFeedback(uint256 reqId, bytes32 msgHash, bytes32 uri) external",
  "function commitRationale(uint256 reqId, string calldata rationale, string calldata clauseReference, string calldata standardReference) external",

  // --- Views (reads) ---
  // Negotiation tuple: order matches struct Negotiation field order exactly.
  "function getNegotiation(uint256 reqId) external view returns (tuple(uint256 providerId, uint256 insurerId, address providerAddr, address insurerAddr, bytes32 drugRef, uint256 requestedAmount, uint256 quantity, uint256 daysSupply, bytes32 justificationHash, bytes32 evidenceUri, bytes32 policyHash, bytes32 policyUri, uint256 coveredAmount, uint256 escrowAmount, uint256 costPlusUnitPrice, uint256 nadacUnitPrice, bytes32 rationaleHash, bytes32 clauseRef, bytes32 standardRef, uint8 lastDecision, uint256 lastRequestId, bool hasRuling, string agentEvidenceUrl, string agentPromptHint, uint256 round, uint8 payerLine, uint8 appealRound, bool providerAccepted, bool insurerAccepted, uint256 totalFees, uint8 state, uint256 pendingRequestId, uint256 createdAt, uint256 rulingDeadline, bool exists, uint8 agentPhase, uint256 pendingDecideFee, address pendingFeePayer))",
  "function getAttestations(uint256 reqId) external view returns (tuple(bytes32 clauseId, bool attested, bytes32 evidenceUriHash)[])",
  "function stateOf(uint256 reqId) external view returns (uint8)",
  "function coveredAmountOf(uint256 reqId) external view returns (uint256)",
  "function priceBasisOf(uint256 reqId) external view returns (uint256 requestedAmount, uint256 quantity, uint256 costPlusTotal, uint256 nadacFloorTotal, uint256 coveredAmount)",
  "function roundOf(uint256 reqId) external view returns (uint256)",
  "function policyOf(uint256 reqId) external view returns (bytes32 policyHash, bytes32 policyUri)",
  "function count() external view returns (uint256)",
  "function maxRounds() external view returns (uint256)",

  // --- Events ---
  "event ContractCreated(uint256 indexed reqId, uint256 indexed providerId, uint256 indexed insurerId, address providerAddr, address insurerAddr, bytes32 drugRef, uint256 requestedAmount, uint256 quantity, uint256 daysSupply)",
  "event ContentCommitted(uint256 indexed reqId, bytes32 contentHash, bytes32 uri)",
  "event InsurerEngaged(uint256 indexed reqId, bytes32 policyHash, bytes32 policyUri)",
  "event ContractReady(uint256 indexed reqId)",
  "event AdjudicationRequested(uint256 indexed reqId)",
  "event PacketSubmitted(uint256 indexed reqId, uint256 indexed round, bytes32 packetRoot, bytes32 packetUrl)",
  "event RulingRequested(uint256 indexed reqId, uint256 indexed requestId, uint256 fee)",
  "event Ruled(uint256 indexed reqId, uint256 indexed requestId, uint8 decision, uint256 coveredAmount)",
  "event RulingRationale(uint256 indexed reqId, uint256 indexed requestId, uint8 indexed decision, string rationale, string clauseReference, string standardReference)",
  "event PolicyInvalidated(uint256 indexed reqId, bytes32 clauseRef, bytes32 standardRef)",
  "event EvidenceRequested(uint256 indexed reqId)",
  "event EvidenceSubmitted(uint256 indexed reqId, bytes32 evidenceUri)",
  "event Appealed(uint256 indexed reqId, uint256 indexed partyId, bytes32 evidenceUri, uint256 round)",
  "event Accepted(uint256 indexed reqId, uint256 indexed partyId)",
  "event Settled(uint256 indexed reqId, uint256 coveredAmount, uint256 refundedToInsurer)",
  "event Deadlocked(uint256 indexed reqId, uint256 rounds)",
  "event ProviderRefused(uint256 indexed reqId, bytes32 reasonHash)",
  "event Withdrawn(uint256 indexed reqId)",
  "event RulingTimedOut(uint256 indexed reqId, uint256 indexed requestId)",
  "event FeedbackPosted(uint256 indexed reqId, bytes32 msgHash, bytes32 uri)",
] as const;

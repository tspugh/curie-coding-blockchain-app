/**
 * Minimal ethers-compatible ABI for `CoverageNegotiation.sol`, hand-mirrored
 * from the deployed contract's function/event signatures (SPEC-0001 §3). Kept
 * inline (rather than importing the Hardhat artifact JSON, which lives outside
 * `src/` and the TS `rootDir`) so the library stays self-contained.
 *
 * Only the functions and events the {@link RealBackend} reads/writes/subscribes
 * to are declared. The `Negotiation` struct tuple ordering matches the Solidity
 * struct field order EXACTLY so `getNegotiation` decodes correctly.
 */
export const COVERAGE_NEGOTIATION_ABI = [
  // --- Lifecycle (writes) ---
  "function createContract(uint256 initiatorId, uint256 destinationId, bytes32 drugRef, bytes32 noteHash, uint256 priceFloor, uint256 priceCeil, bytes32 evidenceUri) external returns (uint256 reqId)",
  "function attachContent(uint256 reqId, bytes32 contentHash, bytes32 uri) external",
  "function submitPosition(uint256 reqId, uint256 partyId, uint256 proposedAmount, bytes32 contentHash, bytes32 uri) external",
  "function submitDispute(uint256 reqId, uint256 byPartyId) external payable",
  "function submitEvidence(uint256 reqId, bytes32 evidenceUri) external payable",
  "function appeal(uint256 reqId, bytes32 evidenceUri) external payable",
  "function postFeedback(uint256 reqId, bytes32 msgHash, bytes32 uri) external",
  "function settle(uint256 reqId, uint256 agreedAmount) external",
  "function withdraw(uint256 reqId) external",
  "function onRulingTimeout(uint256 reqId) external",

  // --- Views (reads) ---
  // Negotiation tuple: order matches struct Negotiation field order exactly.
  "function getNegotiation(uint256 reqId) external view returns (tuple(uint256 initiatorId, uint256 destinationId, bytes32 drugRef, bytes32 noteHash, uint256 priceFloor, uint256 priceCeil, bytes32 evidenceUri, tuple(uint256 proposedAmount, bool submitted) initiatorPosition, tuple(uint256 proposedAmount, bool submitted) destinationPosition, uint256 agreedAmount, uint8 state, uint256 pendingRequestId, uint256 createdAt, uint256 rulingDeadline, bool exists))",
  "function stateOf(uint256 reqId) external view returns (uint8)",
  "function noteHashOf(uint256 reqId) external view returns (bytes32)",
  "function count() external view returns (uint256)",

  // --- Events ---
  "event ContractCreated(uint256 indexed reqId, uint256 indexed initiatorId, uint256 indexed destinationId, bytes32 drugRef, uint256 priceFloor, uint256 priceCeil)",
  "event ContentCommitted(uint256 indexed reqId, bytes32 contentHash, bytes32 uri)",
  "event PositionSubmitted(uint256 indexed reqId, uint256 indexed partyId, uint256 proposedAmount)",
  "event ContractReady(uint256 indexed reqId)",
  "event DisputeSubmitted(uint256 indexed reqId, uint256 indexed byPartyId)",
  "event RulingRequested(uint256 indexed reqId, uint256 indexed requestId, uint256 fee)",
  "event Ruled(uint256 indexed reqId, uint256 indexed requestId, string verdict, uint256 receiptId)",
  "event RulingTimedOut(uint256 indexed reqId, uint256 indexed requestId)",
  "event FeedbackPosted(uint256 indexed reqId, bytes32 msgHash, bytes32 uri)",
  "event EvidenceSubmitted(uint256 indexed reqId, bytes32 evidenceUri)",
  "event Appealed(uint256 indexed reqId, bytes32 evidenceUri)",
  "event Settled(uint256 indexed reqId, uint256 agreedAmount)",
  "event Withdrawn(uint256 indexed reqId)",
] as const;

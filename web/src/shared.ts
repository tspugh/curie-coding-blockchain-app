/** Small presentational helpers shared across views (no chain logic here). */
import { DECISION_NAMES, type CoverageEvent } from "@lib";

/** Truncate a long 0x-hex value to `0x1234…abcd` for compact display. */
export function shortHex(hex: string, lead = 6, tail = 4): string {
  if (hex.length <= lead + tail + 2) return hex;
  return `${hex.slice(0, lead)}…${hex.slice(-tail)}`;
}

/** Format a bigint amount for display (plain decimal; these are demo dollars). */
export function fmtAmount(v: bigint): string {
  return v.toString();
}

/** One-line human summary of an event for the timeline (every event — R16). */
export function describeEvent(e: CoverageEvent): string {
  switch (e.name) {
    case "ContractCreated":
      return `Filed — provider ${e.providerId} → insurer ${e.insurerId}, requested ${e.requestedAmount}, drug ${shortHex(e.drugRef)}`;
    case "ContentCommitted":
      return `Justification committed — hash ${shortHex(e.contentHash)} (body stays off-chain)`;
    case "InsurerEngaged":
      return `Insurer attached policy — hash ${shortHex(e.policyHash)}`;
    case "ContractReady":
      return "Policy attached — contract Ready (adjudicable)";
    case "AdjudicationRequested":
      return "Adjudication requested — firing the necessity arbiter";
    case "RulingRequested":
      return `Ruling requested — request ${e.requestId}, fee ${e.fee}`;
    case "Ruled":
      return `Arbiter ruled "${DECISION_NAMES[e.decision]}" — covered ${e.coveredAmount}, clause ${shortHex(e.clauseRef)}, receipt ${e.receiptId}`;
    case "PolicyFlagged":
      return `Policy clause flagged non-compliant — clause ${shortHex(e.clauseRef)} vs standard ${shortHex(e.standardRef)}`;
    case "PolicyInvalidated":
      return `Contract voided — clause ${shortHex(e.clauseRef)} contradicts standard ${shortHex(e.standardRef)} (R6b)`;
    case "EvidenceRequested":
      return "Arbiter requested more public evidence of necessity";
    case "EvidenceSubmitted":
      return `Evidence submitted — ${shortHex(e.evidenceUri)} (re-firing arbiter)`;
    case "Appealed":
      return `Appealed by party ${e.partyId} with new evidence ${shortHex(e.evidenceUri)} — round ${e.round}`;
    case "Accepted":
      return `Ruling accepted by party ${e.partyId}`;
    case "Settled":
      return `Settled — covered ${e.coveredAmount}, fee per party ${e.feePerParty} (50/50 marker)`;
    case "Deadlocked":
      return `Deadlocked after ${e.rounds} round(s) — no mutual acceptance`;
    case "ProviderRefused":
      return `Provider refused the insurer's terms — reason ${shortHex(e.reasonHash)}`;
    case "Withdrawn":
      return "Withdrawn";
    case "RulingTimedOut":
      return `Ruling timed out — request ${e.requestId} (routed to EvidenceRequested)`;
    case "FeedbackPosted":
      return `Feedback posted — msg ${shortHex(e.msgHash)}`;
  }
}

/** Parse a non-negative integer string to bigint, or null if invalid. */
export function parseAmount(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

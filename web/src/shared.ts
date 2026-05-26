/** Small presentational helpers shared across views (no chain logic here). */
import type { CoverageEvent } from "@lib";

/** Truncate a long 0x-hex value to `0x1234…abcd` for compact display. */
export function shortHex(hex: string, lead = 6, tail = 4): string {
  if (hex.length <= lead + tail + 2) return hex;
  return `${hex.slice(0, lead)}…${hex.slice(-tail)}`;
}

/** Format a bigint amount for display (plain decimal; these are demo dollars). */
export function fmtAmount(v: bigint): string {
  return v.toString();
}

/** One-line human summary of an event for the timeline. */
export function describeEvent(e: CoverageEvent): string {
  switch (e.name) {
    case "ContractCreated":
      return `Created — initiator ${e.initiatorId} → destination ${e.destinationId}, band [${e.priceFloor}, ${e.priceCeil}]`;
    case "ContentCommitted":
      return `Content committed — hash ${shortHex(e.contentHash)}`;
    case "PositionSubmitted":
      return `Position submitted by party ${e.partyId} — amount ${e.proposedAmount}`;
    case "ContractReady":
      return "Both positions in — contract Ready (disputable)";
    case "DisputeSubmitted":
      return `Dispute raised by party ${e.byPartyId} — agent firing`;
    case "RulingRequested":
      return `Ruling requested — request ${e.requestId}, fee ${e.fee}`;
    case "Ruled":
      return `Agent ruled "${e.verdict}" — receipt ${e.receiptId}`;
    case "RulingTimedOut":
      return `Ruling timed out — request ${e.requestId}`;
    case "FeedbackPosted":
      return `Feedback posted — msg ${shortHex(e.msgHash)}`;
    case "EvidenceSubmitted":
      return `Evidence submitted — ${shortHex(e.evidenceUri)}`;
    case "Appealed":
      return `Appealed — ${shortHex(e.evidenceUri)}`;
    case "Settled":
      return `Settled — agreed amount ${e.agreedAmount}`;
    case "Withdrawn":
      return "Withdrawn";
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

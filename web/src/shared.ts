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
    case "PacketSubmitted":
      return `Evidence packet pinned — round ${e.round}, root ${shortHex(e.packetRoot)} (${e.packetUrl})`;
    case "Ruled":
      // SPEC-0006 R24: Ruled event carries only (requestId, decision, coveredAmount).
      // clauseRef / receiptId were removed; rationale is now in RulingRationale.
      return `Arbiter ruled "${DECISION_NAMES[e.decision]}" — covered ${e.coveredAmount}`;
    case "RulingRationale":
      return `Ruling rationale committed — decision ${DECISION_NAMES[e.decision]}`;
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
      // A0008 §2: refundedToInsurer is the real released amount, not a fee marker.
      return `Settled — covered ${e.coveredAmount}, refunded to insurer ${e.refundedToInsurer}`;
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

/**
 * Map a CoverageEvent name to a UI tone token for color highlighting.
 *
 * Used by the Network tx-stream rows to tint the event-name cell by semantic
 * meaning. Tones map to existing project palette tokens:
 *   ok     → terminal success (Accepted, Settled)
 *   warn   → needs attention (EvidenceRequested, EvidenceSubmitted)
 *   danger → terminal failure (Denied paths)
 *   purple → procedural mid-flight (Filed / ContentCommitted / InsurerEngaged
 *            / Appealed / PacketSubmitted)
 *   accent → AI-action transitions (AdjudicationRequested / RulingRequested /
 *            Ruled / ContractReady / FeedbackPosted / RulingTimedOut)
 *
 * Mirrors the prototype's EVENT_META intent at data.jsx:305 but uses tokens
 * that actually exist in our stylesheet.
 */
export function eventTone(name: CoverageEvent["name"]): "ok" | "warn" | "danger" | "purple" | "accent" {
  switch (name) {
    case "Accepted":
    case "Settled":
      return "ok";
    case "EvidenceRequested":
    case "EvidenceSubmitted":
      return "warn";
    case "Deadlocked":
    case "PolicyInvalidated":
    case "ProviderRefused":
    case "Withdrawn":
      return "danger";
    case "ContractCreated":
    case "ContentCommitted":
    case "InsurerEngaged":
    case "Appealed":
    case "PacketSubmitted":
      return "purple";
    case "ContractReady":
    case "AdjudicationRequested":
    case "RulingRequested":
    case "Ruled":
    case "RulingRationale":
    case "RulingTimedOut":
    case "FeedbackPosted":
      return "accent";
  }
}

/**
 * Best-effort attribution label for a CoverageEvent — which actor on the
 * protocol made this event happen. Used by the Detail timeline's per-row
 * attribution chip (SPEC-0003 §2.3 R20 conformance with prototype EventLog).
 *
 * Some events carry an explicit `partyId` (Appealed, Accepted) — those route
 * "provider" vs "insurer" by id. Others are inferred from semantics:
 *   - provider-class:   ContractCreated, ContentCommitted, EvidenceSubmitted,
 *                       ProviderRefused, Withdrawn
 *   - insurer-class:    InsurerEngaged
 *   - arbiter-class:    AdjudicationRequested, RulingRequested, Ruled,
 *                       PolicyFlagged, PolicyInvalidated, EvidenceRequested,
 *                       PacketSubmitted, RulingTimedOut
 *   - system / contract: ContractReady, Settled, Deadlocked, FeedbackPosted
 */
export function eventAttribution(e: CoverageEvent): string {
  switch (e.name) {
    case "Appealed":
    case "Accepted":
      // partyId is 1 (provider), 2 (insurer), 99 (observer) per ProfileRegistry.
      return e.partyId === 1n ? "provider" : e.partyId === 2n ? "insurer" : "party " + e.partyId.toString();
    case "ContractCreated":
    case "ContentCommitted":
    case "EvidenceSubmitted":
    case "ProviderRefused":
    case "Withdrawn":
      return "provider";
    case "InsurerEngaged":
      return "insurer";
    case "AdjudicationRequested":
    case "RulingRequested":
    case "Ruled":
    case "RulingRationale":
    case "PolicyInvalidated":
    case "EvidenceRequested":
    case "PacketSubmitted":
    case "RulingTimedOut":
      return "arbiter";
    case "ContractReady":
    case "Settled":
    case "Deadlocked":
    case "FeedbackPosted":
      return "system";
  }
}

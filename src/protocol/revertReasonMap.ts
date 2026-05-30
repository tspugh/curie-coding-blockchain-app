// SPEC-0003 R16 — mapping from contract revert strings to plain-English user copy.

/** Known revert string literals emitted by CoverageNegotiation.sol. */
export type RevertReason =
  // createContract guards
  | "addr: zero"
  | "auth: not provider"
  | "qty: zero"
  | "create: self-contract"
  // engage guards
  | "engage: not Open"
  | "auth: not insurer"
  | "policy: empty"
  // adjudicate guards
  | "adjudicate: not Ready"
  // submitEvidence guards
  | "evidence: wrong state"
  | "evidence: empty"
  // appeal guards
  | "appeal: prior ruling not Deny"
  | "appeal: unknown party"
  | "appeal: needs evidence"
  // accept / settle guards
  | "accept: not ruled"
  | "settle: not ruled"
  | "settle: not both accepted"
  // refuse / withdraw / feedback guards
  | "refuse: not refusable"
  | "withdraw: terminal"
  | "feedback: terminal"
  // timeout guard
  | "timeout: not UnderReview"
  | "timeout: too early"
  // platform callback guards (internal)
  | "callback: not platform"
  | "callback: unknown request"
  | "callback: not UnderReview"
  // fee guards
  | "fee: underfunded"
  | "fee: refund failed"
  // general auth guard (used by feedback / other party-scoped functions)
  | "auth: not a party"
  // internal fund-transfer guards (owner-only)
  | "funds: zero addr"
  | "funds: insufficient"
  | "funds: transfer failed"
  // lookup guard
  | "unknown contract"
  // constructor guard
  | "maxRounds: < 1";

/** Plain-English copy for a single revert reason (SPEC-0003 R16). */
export interface RevertReasonEntry {
  /** One-line headline shown prominently in the error card (R21). */
  readonly headline: string;
  /**
   * 1-2 sentence explanation of why this happened and what the user can do.
   * Shown in the "What to do" area of the error card.
   */
  readonly details: string;
}

/**
 * Frozen map from every known contract revert string to a RevertReasonEntry.
 * Add new entries here whenever the contract gains a new revert path.
 */
export const REVERT_REASON_MAP: Readonly<Record<RevertReason, RevertReasonEntry>> =
  Object.freeze({
    // ── createContract ────────────────────────────────────────────────────────
    "addr: zero": {
      headline: "Invalid address",
      details:
        "The provider or insurer address is the zero address. Make sure both addresses are valid wallet addresses before submitting.",
    },
    "auth: not provider": {
      headline: "Only the provider can perform this action",
      details:
        "Your connected wallet is not the provider address on this contract. Switch to the provider wallet and try again.",
    },
    "qty: zero": {
      headline: "Quantity must be greater than zero",
      details:
        "The requested quantity cannot be zero. Enter a positive quantity before submitting.",
    },
    "create: self-contract": {
      headline: "Provider and insurer cannot be the same address",
      details:
        "A coverage negotiation requires two distinct parties. Use different wallet addresses for the provider and the insurer.",
    },

    // ── engage ────────────────────────────────────────────────────────────────
    "engage: not Open": {
      headline: "This request is no longer open for engagement",
      details:
        "The negotiation has already moved past the Open state — the insurer may have already attached a policy. Refresh to see the current state.",
    },
    "auth: not insurer": {
      headline: "Only the insurer can attach a policy",
      details:
        "Your connected wallet is not the insurer address on this contract. Switch to the insurer wallet and try again.",
    },
    "policy: empty": {
      headline: "Policy hash is required",
      details:
        "A policy must be selected or entered before engaging. Choose a policy and try again.",
    },

    // ── adjudicate ────────────────────────────────────────────────────────────
    "adjudicate: not Ready": {
      headline: "This request is not ready for adjudication",
      details:
        "Adjudication can only be requested once the insurer has attached a policy (state: Ready). Refresh to see the current state.",
    },

    // ── submitEvidence ────────────────────────────────────────────────────────
    "evidence: wrong state": {
      headline: "Evidence cannot be submitted right now",
      details:
        "The contract must be in the EvidenceRequested state before evidence can be submitted. Refresh to see the current state.",
    },
    "evidence: empty": {
      headline: "Evidence URI is required",
      details:
        "An evidence document must be attached before submitting. Upload or enter an evidence URI and try again.",
    },

    // ── appeal ────────────────────────────────────────────────────────────────
    "appeal: prior ruling not Deny": {
      headline: "An appeal requires a prior Denied ruling",
      details:
        "Appeals can only be filed after the contract has been denied. The current state does not support an appeal.",
    },
    "appeal: unknown party": {
      headline: "Only a party to the contract can file an appeal",
      details:
        "Your connected wallet is neither the provider nor the insurer on this contract. Switch to a party wallet and try again.",
    },
    "appeal: needs evidence": {
      headline: "Evidence is required to file an appeal",
      details:
        "An appeal must include at least one piece of supporting evidence. Attach an evidence document and try again.",
    },

    // ── accept / settle ───────────────────────────────────────────────────────
    "accept: not ruled": {
      headline: "Cannot accept — no ruling has been issued yet",
      details:
        "Acceptance is only available after the contract has been Approved or Denied by the adjudicator.",
    },
    "settle: not ruled": {
      headline: "Cannot settle — no ruling has been issued yet",
      details:
        "Settlement requires an Approved or Denied ruling. Wait for the adjudicator to rule before settling.",
    },
    "settle: not both accepted": {
      headline: "Both parties must accept before settling",
      details:
        "Settlement requires both the provider and the insurer to accept the ruling. Check whether both acceptances are recorded and try again.",
    },

    // ── refuse / withdraw / feedback ──────────────────────────────────────────
    "refuse: not refusable": {
      headline: "This contract cannot be refused in its current state",
      details:
        "Refusal is only available for contracts in a refusable state (e.g. Open or Ready). Refresh to see the current state.",
    },
    "withdraw: terminal": {
      headline: "This contract has already reached a terminal state",
      details:
        "Withdrawal is only possible while the contract is still active. The contract is already settled, refused, or otherwise finalized.",
    },
    "feedback: terminal": {
      headline: "Feedback cannot be submitted — contract is finalized",
      details:
        "Feedback can only be submitted while the contract is still active. The contract has already reached a terminal state.",
    },

    // ── timeout ───────────────────────────────────────────────────────────────
    "timeout: not UnderReview": {
      headline: "Timeout is only available while the contract is under review",
      details:
        "The timeout action requires the contract to be in the UnderReview state. Refresh to confirm the current state.",
    },
    "timeout: too early": {
      headline: "The ruling deadline has not passed yet",
      details:
        "A timeout can only be triggered after the adjudicator's ruling deadline has elapsed. Try again later.",
    },

    // ── platform callback (internal — not user-initiated) ─────────────────────
    "callback: not platform": {
      headline: "Unauthorized callback",
      details:
        "This action can only be performed by the platform contract. This is an internal error — please contact support.",
    },
    "callback: unknown request": {
      headline: "Unknown adjudication request",
      details:
        "The platform callback referenced a request ID that does not exist on this contract. This is an internal error — please contact support.",
    },
    "callback: not UnderReview": {
      headline: "Callback received for a contract not under review",
      details:
        "The adjudication result arrived for a contract that is no longer in the UnderReview state. This may be a duplicate callback — please contact support.",
    },

    // ── general party auth guard ──────────────────────────────────────────────
    "auth: not a party": {
      headline: "Only a party to this contract can perform this action",
      details:
        "Your connected wallet is neither the provider nor the insurer on this contract. Switch to a party wallet and try again.",
    },

    // ── fee ───────────────────────────────────────────────────────────────────
    "fee: underfunded": {
      headline: "Insufficient STT sent to cover the adjudication fee",
      details:
        "The transaction value is less than the required fee. Ensure your wallet has enough STT and that the fee estimate is up to date before retrying.",
    },
    "fee: refund failed": {
      headline: "Fee refund failed",
      details:
        "The contract attempted to refund excess fee but the transfer failed. This is an internal error — please contact support.",
    },

    // ── owner-only fund management (non-user-facing, included for completeness) ─
    "funds: zero addr": {
      headline: "Invalid withdrawal address",
      details:
        "The destination address for fund withdrawal cannot be the zero address. This is an admin action — use a valid wallet address.",
    },
    "funds: insufficient": {
      headline: "Insufficient contract balance for withdrawal",
      details:
        "The requested withdrawal amount exceeds the contract's current balance. This is an admin action.",
    },
    "funds: transfer failed": {
      headline: "Fund transfer failed",
      details:
        "The ETH transfer out of the contract failed. This is an admin action — please contact support.",
    },

    // ── lookup ────────────────────────────────────────────────────────────────
    "unknown contract": {
      headline: "Contract not found",
      details:
        "No negotiation exists with the provided ID. The request ID may be incorrect or the contract may not have been created yet.",
    },

    // ── constructor (deploy-time, non-user-facing) ─────────────────────────────
    "maxRounds: < 1": {
      headline: "Invalid configuration: maxRounds must be at least 1",
      details:
        "This is a contract deployment configuration error and cannot be triggered by user actions.",
    },
  } satisfies Record<RevertReason, RevertReasonEntry>);

/** Generic fallback returned when the raw revert string does not match any known entry. */
const FALLBACK_HEADLINE = "Transaction reverted";

/**
 * Substring-matched entries for RPC / wallet wrapper errors that DON'T come
 * from the contract's `require`/`revert` strings but still need a friendly
 * surface (SPEC-0005 R17). The patterns are scanned AFTER the exact-string
 * map below misses, so any explicit contract revert wins.
 */
const WRAPPER_REASON_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly entry: RevertReasonEntry;
}> = Object.freeze([
  {
    // Somnia testnet's RPC rejects writes from addresses with zero on-chain
    // history with this exact code. ethers v6 surfaces it inside a wrapping
    // "could not coalesce error" envelope. Both forms route here.
    pattern: /account does not exist|could not coalesce error/i,
    entry: {
      headline: "Wallet has no funds on Somnia testnet",
      details:
        "Your wallet has never received any STT, so the chain treats it " +
        'as "not existing" yet. Top it up at the Somnia testnet faucet ' +
        "(https://testnet.somnia.network/) and try again.",
    },
  },
  {
    // Generic insufficient-funds — common form across providers.
    pattern: /insufficient funds for (gas|intrinsic transaction cost)/i,
    entry: {
      headline: "Wallet balance too low to pay gas",
      details:
        "The wallet has some STT but not enough to cover the gas + agent " +
        "fee for this transaction. Top it up at the Somnia testnet faucet " +
        "(https://testnet.somnia.network/) and try again.",
    },
  },
]);

/**
 * Map a raw revert string from a wallet error to a {@link RevertReasonEntry}.
 *
 * If `reasonRaw` matches a key in {@link REVERT_REASON_MAP} exactly, returns
 * that entry. Otherwise returns a generic fallback whose `details` field
 * includes the original raw reason so no information is lost.
 *
 * @param reasonRaw - The raw revert string extracted from the wallet error
 *   (e.g. `err.message`, `err.reason`, or the decoded `Error(string)` payload).
 *   Pass `undefined` when no reason string is available.
 */
export function mapRevertReason(reasonRaw: string | undefined): RevertReasonEntry {
  if (reasonRaw !== undefined) {
    const entry = REVERT_REASON_MAP[reasonRaw as RevertReason];
    if (entry !== undefined) {
      return entry;
    }
    // SPEC-0005 R17 fall-through: scan for RPC/wallet-wrapper substrings.
    for (const { pattern, entry: wrapperEntry } of WRAPPER_REASON_PATTERNS) {
      if (pattern.test(reasonRaw)) {
        return wrapperEntry;
      }
    }
  }
  return {
    headline: FALLBACK_HEADLINE,
    details: `The contract rejected the transaction. The technical reason is shown below.${
      reasonRaw !== undefined ? ` Raw reason: ${reasonRaw}` : ""
    }`,
  };
}

/**
 * Extract the most informative revert-reason string from an unknown thrown
 * value. Probe order (cleanest copy wins):
 *  1. `.reason` — ethers v6 `CallExceptionError`, already-decoded `Error(string)`.
 *  2. `.shortMessage` — viem/wagmi, cleaner than `.message`.
 *  3. `.message` — last-resort, carries raw stack noise.
 * Returns `undefined` when nothing extractable is present.
 *
 * Pair with {@link mapRevertReason} to get a {@link RevertReasonEntry}.
 */
export function extractRevertReason(err: unknown): string | undefined {
  if (err == null || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;

  if (typeof e["reason"] === "string" && e["reason"]) return e["reason"];
  if (typeof e["shortMessage"] === "string" && e["shortMessage"]) return e["shortMessage"];
  if (typeof e["message"] === "string" && e["message"]) return e["message"];

  return undefined;
}

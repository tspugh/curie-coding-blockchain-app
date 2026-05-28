/**
 * Single shared {@link CurieClient} for the whole UI.
 *
 * Mode is determined by VITE_WALLET_MODE (build-time env var, default "simulated"):
 *   - "simulated": fully local, no chain, AI ruling mocked — dev loop and CI.
 *   - "real":      ethers v6 against the deployed CoverageNegotiation contract on
 *                  Somnia Shannon testnet (chainId 50312). Requires VITE_PRIVATE_KEY
 *                  and VITE_CONTRACT_ADDRESS in .env.
 *
 * Simulated mode: the mocked necessity arbiter's ruling is fixed at client
 * construction, but the demo can flip it per adjudication via the module-level
 * mutables read by `decision`/`costPlusUnitPrice`/`nadacUnitPrice` functions.
 *
 * Per the 2026-05-27 SPEC-0001 cap-resolution, the covered amount on approve is
 * `min(requested, costPlusUnitPrice × quantity)`. The clause + public-standard refs
 * are tied to demo fixtures (clause PD-ADA-09 vs. the FDA HUMIRA label) so the R3
 * gotcha panel can match them against `demo-data/`.
 */
import {
  createClient,
  Decision,
  hashContent,
  DEFAULT_PROFILES,
  type CurieClient,
  type Negotiation,
} from "@lib";

// ---------------------------------------------------------------------------
// Build-time mode detection (Vite exposes VITE_* from the root .env)
// ---------------------------------------------------------------------------
const IS_REAL = import.meta.env.VITE_WALLET_MODE === "real";

// ---------------------------------------------------------------------------
// Simulated-mode mutable arbiter state (no-op in real mode — on-chain decides)
// ---------------------------------------------------------------------------

/** Decision the next fired adjudication will resolve to (read by the arbiter fn). */
let nextDecision: Decision = Decision.Approve;

/**
 * Mark Cuban Cost Plus PER-UNIT price fed into the deterministic
 * `min(requested, unit × quantity)` on approve (R6a). `null` means "let the
 * backend default it" (a per-unit price that makes the cap non-binding, i.e.
 * covered === requested) unless the demo overrides it to show the cap binding.
 */
let nextCostPlusUnitPrice: bigint | null = null;

/** NADAC PER-UNIT acquisition-cost floor reference (recorded, never the cap). */
let nextNadacUnitPrice: bigint | null = null;

/**
 * Clause ref the arbiter cites (R6). Tied to the demo's non-compliant clause
 * PD-ADA-09 so the R3 gotcha panel can match it to `demo-data/policy-noncompliant.md`.
 */
export const CLAUSE_REF = hashContent("clause:PD-ADA-09");

/**
 * Public standard ref cited when a clause is flagged non-compliant (R6b). Tied
 * to the FDA HUMIRA plaque-psoriasis label fixture
 * (`demo-data/fda-indication-adalimumab.json`).
 */
export const STANDARD_REF = hashContent(
  "standard:fda-label-indication:HUMIRA:plaque-psoriasis",
);

/** Set the {@link Decision} the simulated arbiter returns for the next adjudication. */
export function setNextDecision(d: Decision): void {
  nextDecision = d;
}

/** The current pending decision (for showing the selected value in the UI). */
export function getNextDecision(): Decision {
  return nextDecision;
}

/** Set the Mark Cuban Cost Plus per-unit price for the next approve ruling (R6a). */
export function setNextCostPlusUnitPrice(p: bigint): void {
  nextCostPlusUnitPrice = p;
}

/** The current pending Cost Plus per-unit price, or `null` to use the backend default. */
export function getNextCostPlusUnitPrice(): bigint | null {
  return nextCostPlusUnitPrice;
}

/** Set the NADAC per-unit floor reference for the next ruling (R6a/R10). */
export function setNextNadacUnitPrice(p: bigint): void {
  nextNadacUnitPrice = p;
}

/** The current pending NADAC per-unit floor reference, or `null` for the default. */
export function getNextNadacUnitPrice(): bigint | null {
  return nextNadacUnitPrice;
}

// ---------------------------------------------------------------------------
// Client construction — switches on IS_REAL at module load (build-time constant)
// ---------------------------------------------------------------------------

/**
 * The one client the UI holds.
 *
 * Real mode: ethers v6 signer on Somnia Shannon testnet; the on-chain AI arbiter
 * (registered via AgentRegistry) issues the necessity ruling as a contract callback.
 *
 * Simulated mode: no funds/keys needed; `autoResolveMs` mimics agent latency so
 * the timeline visibly transitions Ready → UnderReview → Ruled. A third Observer
 * profile (party 99) is registered for the R6 role/wallet-gating demo.
 */
export const client: CurieClient = IS_REAL
  ? createClient({
      wallet: {
        mode: "real",
        privateKey: import.meta.env.VITE_PRIVATE_KEY,
        rpcUrl: import.meta.env.VITE_RPC_URL,
        network:
          (import.meta.env.VITE_SOMNIA_NETWORK as "testnet" | "mainnet" | undefined) ??
          "testnet",
      },
      profiles: {
        profiles: [
          ...DEFAULT_PROFILES,
          { id: "observer", label: "Observer", partyId: 99n },
        ],
      },
      contract: {
        real: {
          contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
        },
      },
    })
  : createClient({
      wallet: { mode: "simulated" },
      profiles: {
        profiles: [
          ...DEFAULT_PROFILES,
          { id: "observer", label: "Observer", partyId: 99n },
        ],
      },
      contract: {
        simulated: {
          autoResolveMs: 1200,
          decision: () => nextDecision,
          // Deterministic covered amount = min(requested, costPlusUnitPrice × quantity)
          // — never AI-chosen (R6a). When the demo hasn't set a price the backend
          // defaults the per-unit price so the cap is non-binding (covered == requested);
          // setting a lower per-unit price demonstrates the cap binding via min().
          costPlusUnitPrice: (n: Negotiation) =>
            nextCostPlusUnitPrice ??
            (n.quantity > 0n
              ? (n.requestedAmount + n.quantity - 1n) / n.quantity
              : n.requestedAmount),
          // NADAC per-unit acquisition-cost FLOOR reference (recorded; never the cap).
          nadacUnitPrice: () => nextNadacUnitPrice ?? 0n,
          clauseRef: CLAUSE_REF,
          standardRef: STANDARD_REF,
        },
      },
    });

// Acceptable only because this is a no-funds dev wallet (testnet / simulated):
// expose the client for debugging and agent-browser tests.
(window as unknown as { __curie: CurieClient }).__curie = client;

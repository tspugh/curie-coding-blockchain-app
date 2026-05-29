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
 * Build one CurieClient bound to `privateKey`. Used to construct distinct
 * provider/insurer clients so the active profile can be paired with a real
 * signing key (UNIT-7a-two-wallet-demo).
 *
 * In simulated mode the privateKey is ignored; both clients are equivalent
 * mocks (the SimulatedBackend has no signer).
 */
function makeClient(privateKey: string | undefined): CurieClient {
  const profileConfig = {
    profiles: [
      ...DEFAULT_PROFILES,
      { id: "observer", label: "Observer", partyId: 99n },
    ],
  };
  if (IS_REAL) {
    if (!privateKey) {
      throw new Error(
        "Real mode requires a private key — set VITE_PRIVATE_KEY (provider) and VITE_PRIVATE_KEY_INSURER (insurer) in .env.",
      );
    }
    return createClient({
      wallet: {
        mode: "real",
        privateKey,
        rpcUrl: import.meta.env.VITE_RPC_URL,
        network:
          (import.meta.env.VITE_SOMNIA_NETWORK as "testnet" | "mainnet" | undefined) ??
          "testnet",
      },
      profiles: profileConfig,
      contract: {
        real: {
          contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
          // = platform.getRequestDeposit() (0.03 STT) + 0.10 STT × 3 validators = 0.33 STT.
          agentFeeValue: BigInt(import.meta.env.VITE_AGENT_FEE_WEI ?? "330000000000000000"),
        },
      },
    });
  }
  return createClient({
    wallet: { mode: "simulated" },
    profiles: profileConfig,
    contract: {
      simulated: {
        autoResolveMs: 1200,
        decision: () => nextDecision,
        costPlusUnitPrice: (n: Negotiation) =>
          nextCostPlusUnitPrice ??
          (n.quantity > 0n
            ? (n.requestedAmount + n.quantity - 1n) / n.quantity
            : n.requestedAmount),
        nadacUnitPrice: () => nextNadacUnitPrice ?? 0n,
        clauseRef: CLAUSE_REF,
        standardRef: STANDARD_REF,
      },
    },
  });
}

// Two concrete clients, one per signing key. Insurer key is optional; if not
// set, `insurerClient` falls back to the provider key so the app still runs
// (the engage path will revert "auth: not insurer" as it did pre-UNIT-7a).
/**
 * Read a private-key env var with a localStorage override (SPEC-0003 R30 —
 * runtime wallet configurability). The Settings UI writes overrides under the
 * `curie:VITE_PRIVATE_KEY*` keys. localStorage wins so the user's UI edit
 * survives across page loads without an .env rebuild. Empty strings are
 * treated as not-set so a cleared field reverts to the env value.
 *
 * Note: localStorage is plaintext and per-origin. Don't paste a real-funds
 * key — these are testnet keys only.
 */
function keyOverride(envName: "VITE_PRIVATE_KEY" | "VITE_PRIVATE_KEY_INSURER"): string | undefined {
  try {
    const stored = window.localStorage.getItem(`curie:${envName}`);
    if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) return stored;
  } catch {
    /* localStorage unavailable (private mode, SSR) — fall through to env. */
  }
  const fromEnv = import.meta.env[envName];
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : undefined;
}

const providerClient = makeClient(keyOverride("VITE_PRIVATE_KEY"));
const insurerClient = makeClient(
  keyOverride("VITE_PRIVATE_KEY_INSURER") ?? keyOverride("VITE_PRIVATE_KEY"),
);

// Module-level "which client should `client.*` dispatch to" pointer. App.tsx
// flips this whenever the user switches profile in the UI.
let activeClient: CurieClient = providerClient;

/**
 * Tell the proxy which concrete client to dispatch to for chain writes. App
 * calls this on every profile change. "insurer" → insurerClient (signs as the
 * second wallet); anything else → providerClient. Idempotent.
 */
export function setActiveClientProfile(profileId: string): void {
  activeClient = profileId === "insurer" ? insurerClient : providerClient;
}

/**
 * Address of the second-wallet signer. Create.tsx reads this to populate the
 * insurer field of the new negotiation so R2b (provider ≠ insurer) is
 * satisfied and the insurer's engage() can subsequently sign successfully.
 */
export const INSURER_ADDRESS: string = insurerClient.wallet.address;

/**
 * The one `client` the UI holds. A Proxy that dispatches every property
 * access to whichever concrete client `activeClient` currently points to.
 * View code keeps using `import { client }` unchanged.
 */
export const client: CurieClient = new Proxy({} as CurieClient, {
  get(_target, prop) {
    return activeClient[prop as keyof CurieClient];
  },
});

// Acceptable only because these are no-funds dev wallets (testnet / simulated):
// expose both concrete clients for debugging and agent-browser tests.
(window as unknown as { __curie: { provider: CurieClient; insurer: CurieClient } }).__curie = {
  provider: providerClient,
  insurer: insurerClient,
};

// SPEC-0003 §2.2. Wire the tx-confirmed event bus on BOTH concrete clients so
// the in-UI monitor + JSONL sink see events regardless of which signer fired
// them. No-op in simulated mode (the helper type-guards on RealBackend).
import { wireTxLogger } from "./txLogger.js";
wireTxLogger(providerClient.negotiation);
if (insurerClient !== providerClient) wireTxLogger(insurerClient.negotiation);

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
  loadUsers,
  setNextPolicyVoidedClauseIndices,
  setNextUsedReferenceIndices,
  setNextUsedLeafHashes,
  type CurieClient,
  type DemoRole,
  type DemoUser,
  type Negotiation,
} from "@lib";
import { KEY_STORAGE_PREFIX, isValidHexKey } from "./walletKeys.js";

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
/** SPEC-0005 R12 — map a DemoRole onto its ProfileRegistry partyId. */
function partyIdFor(role: DemoRole): bigint {
  switch (role) {
    case "provider":
      return 1n;
    case "insurer":
      return 2n;
    case "observer":
      return 99n;
  }
}

/**
 * Convert a localStorage-persisted {@link DemoUser} to a Profile entry the
 * ProfileRegistry can hold. The address isn't yet plumbed into the registry
 * (the registry binds profiles to ONE wallet), so we only carry the
 * label/partyId pair; T75c will extend this to per-user signers when the
 * underlying registry surface grows multi-wallet support.
 */
function userToProfile(u: DemoUser): { id: string; label: string; partyId: bigint } {
  return { id: u.id, label: u.label, partyId: partyIdFor(u.role) };
}

function makeClient(privateKey: string | undefined): CurieClient {
  // SPEC-0005 R10/R11/R12: seed the registry with the curated defaults, then
  // append any localStorage-persisted DemoUser entries. Saved entries that
  // collide with a seed id (e.g. a user the operator added named "provider")
  // are dropped here so the seed semantics stay stable; the Settings UI can
  // surface a future warning when collisions occur.
  const seeds = [
    ...DEFAULT_PROFILES,
    { id: "observer", label: "Observer", partyId: 99n },
  ];
  const seedIds = new Set(seeds.map((p) => p.id));
  const persisted = loadUsers()
    .filter((u) => !seedIds.has(u.id))
    .map(userToProfile);
  const profileConfig = {
    profiles: [...seeds, ...persisted],
  };
  if (IS_REAL) {
    if (!privateKey) {
      // Don't throw at module-init: that bricks React before the user can
      // reach the Settings panel that exists precisely to fix this case
      // (MEDIUM 2, tick 25 strict-review). Fall back to a simulated backend
      // and let `walletSetupRequired` flag the App to render an onboarding
      // banner pointing to Settings → Wallet keys.
      walletSetupRequired = true;
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
 * True when real mode is selected but no usable private key was found in
 * either localStorage or .env — the app falls back to simulated and the UI
 * renders an onboarding banner pointing to Settings → Wallet keys.
 */
export let walletSetupRequired = false;

/**
 * Read a private-key env var with a localStorage override (SPEC-0003 R42 —
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
    const stored = window.localStorage.getItem(KEY_STORAGE_PREFIX + envName);
    if (stored && isValidHexKey(stored)) return stored;
  } catch {
    /* localStorage unavailable (private mode, SSR) — fall through to env. */
  }
  const fromEnv = import.meta.env[envName];
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : undefined;
}

const providerClient = makeClient(keyOverride("VITE_PRIVATE_KEY"));
// In simulated mode the two backends would be independent in-memory state
// machines — profile-switch would lose the negotiation list (MEDIUM 1, tick 25
// strict-review). Share the same instance so the simulated demo survives
// profile flips. Real mode keeps two distinct clients with distinct signers.
const insurerClient: CurieClient = IS_REAL
  ? makeClient(
      keyOverride("VITE_PRIVATE_KEY_INSURER") ?? keyOverride("VITE_PRIVATE_KEY"),
    )
  : providerClient;

// Module-level "which client should `client.*` dispatch to" pointer. App.tsx
// flips this whenever the user switches profile in the UI.
let activeClient: CurieClient = providerClient;

/**
 * Tell the proxy which concrete client to dispatch to for chain writes. App
 * calls this on every profile change. "insurer" → insurerClient (signs as the
 * second wallet); anything else → providerClient. Idempotent.
 *
 * In simulated mode the two clients share a single SimulatedBackend instance
 * (tick-25 MEDIUM 1: state survives profile flips). The backend gates auth on
 * its `caller` field — the simulated `msg.sender` — defaulting to
 * `wallet.address` at construction. Without flipping `caller` on profile
 * switch, the insurer-acting branches (insurerEngage, etc.) revert
 * "auth: not insurer". So in sim mode we tell the backend who's calling now.
 * Real mode is unaffected: each client has its own wallet + signer.
 */
export function setActiveClientProfile(profileId: string): void {
  activeClient = profileId === "insurer" ? insurerClient : providerClient;
  if (!IS_REAL) {
    const sim = activeClient.negotiation as unknown as {
      setCaller?: (address: string) => unknown;
    };
    sim.setCaller?.(
      profileId === "insurer"
        ? SIMULATED_INSURER_ADDRESS
        : providerClient.wallet.address,
    );
  }
}

/**
 * Address of the second-wallet signer. Create.tsx reads this to populate the
 * insurer field of the new negotiation so SPEC-0004 R2b (provider ≠ insurer)
 * is satisfied and the insurer's engage() can subsequently sign successfully.
 *
 * In real mode this is the genuine `insurerClient.wallet.address` (a second
 * EOA whose key lives in `VITE_PRIVATE_KEY_INSURER`). In simulated mode the
 * two clients are the SAME instance so their state-machine survives profile
 * flips (tick-25 MEDIUM 1 closure) — which means their wallet addresses are
 * identical, which would trip R2b's `providerAddr == insurerAddr` revert.
 * Hand back a fixed synthetic distinct counterparty address; the simulated
 * backend's `caller` is then flipped to match this address on profile switch
 * (see {@link setActiveClientProfile}), so SPEC-0001 R11 auth gates pass
 * symmetrically with the real contract's `require(msg.sender == insurerAddr)`.
 */
const SIMULATED_INSURER_ADDRESS = "0x0000000000000000000000000000000000c0c0c0";
export const INSURER_ADDRESS: string = IS_REAL
  ? insurerClient.wallet.address
  : SIMULATED_INSURER_ADDRESS;

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

// Window export for the agent-browser tests and DevTools. Gated behind
// `import.meta.env.DEV` (dev server) OR `VITE_EXPOSE_TEST_API=1` (opt-in for
// production preview builds the e2e harness drives) so a normal production
// bundle does NOT leak the second signer onto window (tick-25 LOW 5 closure).
//
// Shape matches what `web/tests/agent-browser/run.sh` queries
// (window.__curie.{negotiation,content,wallet,profiles}). Each top-level
// accessor delegates to `client`, the Proxy that forwards to whichever signer
// the user has selected via Settings — so profile-switching during a scenario
// transparently changes the on-chain identity the harness reads from.
if (import.meta.env.DEV || import.meta.env.VITE_EXPOSE_TEST_API === "1") {
  (window as unknown as {
    __curie: {
      provider: CurieClient;
      insurer: CurieClient;
      negotiation: CurieClient["negotiation"];
      content: CurieClient["content"];
      wallet: CurieClient["wallet"];
      profiles: CurieClient["profiles"];
      // Simulated-arbiter overrides for the e2e harness. These wire the
      // module-level next* mutables that the SimulatedBackend reads at
      // adjudication time. The harness uses these instead of UI inputs
      // because the redesigned UI lacks the price-pegging fields (the
      // simulation overrides are demo-runtime concerns, not user-facing).
      setNextDecision: typeof setNextDecision;
      setNextCostPlusUnitPrice: typeof setNextCostPlusUnitPrice;
      setNextNadacUnitPrice: typeof setNextNadacUnitPrice;
      // SPEC-0004 §3.5 R11/R23 sim-arbiter one-shot prime helpers — let the
      // e2e harness drive the populated `usedReferenceIndices` /
      // `usedLeafHashes` / `policyVoidedClauseIndices` paths the Detail
      // ruling-meta panel now surfaces (tick 51).
      setNextPolicyVoidedClauseIndices: typeof setNextPolicyVoidedClauseIndices;
      setNextUsedReferenceIndices: typeof setNextUsedReferenceIndices;
      setNextUsedLeafHashes: typeof setNextUsedLeafHashes;
    };
  }).__curie = {
    provider: providerClient,
    insurer: insurerClient,
    get negotiation() { return client.negotiation; },
    get content() { return client.content; },
    get wallet() { return client.wallet; },
    get profiles() { return client.profiles; },
    setNextDecision,
    setNextCostPlusUnitPrice,
    setNextNadacUnitPrice,
    setNextPolicyVoidedClauseIndices,
    setNextUsedReferenceIndices,
    setNextUsedLeafHashes,
  };
}

// SPEC-0003 §2.2. Wire the tx-confirmed event bus on BOTH concrete clients so
// the in-UI monitor + JSONL sink see events regardless of which signer fired
// them. No-op in simulated mode (the helper type-guards on RealBackend).
import { wireTxLogger } from "./txLogger.js";
wireTxLogger(providerClient.negotiation);
if (insurerClient !== providerClient) wireTxLogger(insurerClient.negotiation);

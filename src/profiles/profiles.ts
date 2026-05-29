/**
 * App-level profile registry + active-profile switching (SPEC-0001 R12/R13).
 *
 * A "profile" is an app-level identity (a provider or insurer persona) that maps
 * to a numeric on-chain party id. The MVP supports a SINGLE wallet shared by
 * MULTIPLE profiles: switching the active profile changes the on-chain identity
 * used for the next action, while the underlying wallet stays the same. Because
 * two profiles can share one wallet (or be the same id), self-claim (provider ==
 * insurer) is naturally supported (R13).
 *
 * This layer holds no keys and touches no chain — it is pure identity state the
 * UI reads to show the active profile and the contract client reads to know
 * which `partyId` to act as.
 */
import type { Wallet } from "../wallet/index.js";

/** An app-level identity that maps to an on-chain party id. */
export interface Profile {
  /** Stable key used to select this profile (e.g. "provider", "insurer"). */
  readonly id: string;
  /** Display name for the UI. */
  readonly label: string;
  /** On-chain party id used for `appeal` / `accept` / `createContract` etc. */
  readonly partyId: bigint;
  /**
   * Short one-line summary of what this role does in the demo. Surfaced in the
   * Settings profile picker (`web/src/views/Settings.tsx`) as the sub-line.
   * Optional so legacy callers passing custom profiles don't break.
   */
  readonly description?: string;
}

/** Options for {@link ProfileRegistry}. */
export interface ProfileRegistryOptions {
  /** Initial profiles. Defaults to a provider/payer pair if omitted. */
  readonly profiles?: readonly Profile[];
  /** Profile id to activate initially; defaults to the first profile. */
  readonly activeId?: string;
}

/** Two sensible default identities for the demo loop (provider + insurer). */
export const DEFAULT_PROFILES: readonly Profile[] = [
  {
    id: "provider",
    label: "Provider",
    partyId: 1n,
    description: "Files coverage-exception requests with attached clinical evidence.",
  },
  {
    id: "insurer",
    label: "Insurer",
    partyId: 2n,
    description: "Attaches the coverage policy and accepts or appeals the arbiter ruling.",
  },
];

/**
 * In-memory registry of profiles bound to one shared {@link Wallet}. Tracks the
 * active profile and exposes its party id + wallet.
 */
export class ProfileRegistry {
  private readonly wallet: Wallet;
  private readonly profiles: Map<string, Profile>;
  private activeId: string;

  /**
   * @param wallet  The single shared wallet all profiles act through (R12).
   * @param options Initial profiles + active profile.
   */
  constructor(wallet: Wallet, options: ProfileRegistryOptions = {}) {
    this.wallet = wallet;
    const initial = options.profiles ?? DEFAULT_PROFILES;
    if (initial.length === 0) {
      throw new Error("ProfileRegistry requires at least one profile.");
    }
    this.profiles = new Map(initial.map((p) => [p.id, p]));

    const wanted = options.activeId ?? initial[0]!.id;
    if (!this.profiles.has(wanted)) {
      throw new Error(`Unknown initial activeId "${wanted}".`);
    }
    this.activeId = wanted;
  }

  /** The shared wallet backing every profile. */
  getWallet(): Wallet {
    return this.wallet;
  }

  /** All known profiles, in insertion order. */
  listProfiles(): Profile[] {
    return [...this.profiles.values()];
  }

  /** The currently active profile. */
  getActiveProfile(): Profile {
    return this.profiles.get(this.activeId)!;
  }

  /** Convenience: the active profile's on-chain party id. */
  getActivePartyId(): bigint {
    return this.getActiveProfile().partyId;
  }

  /**
   * Switch the active identity (R12). Throws if `id` is not registered.
   * @returns the now-active profile.
   */
  setActiveProfile(id: string): Profile {
    if (!this.profiles.has(id)) {
      throw new Error(`Unknown profile "${id}".`);
    }
    this.activeId = id;
    return this.getActiveProfile();
  }

  /** Register (or replace) a profile. */
  addProfile(profile: Profile): void {
    this.profiles.set(profile.id, profile);
  }

  /** Look up a profile by id, or `undefined`. */
  getProfile(id: string): Profile | undefined {
    return this.profiles.get(id);
  }
}

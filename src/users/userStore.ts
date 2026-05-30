/**
 * SPEC-0005 R10/R11 — runtime-configurable user registry.
 *
 * The legacy app shipped with two hardcoded profiles (provider + insurer) plus
 * an observer. SPEC-0005 generalises that to **arbitrary N users** managed at
 * runtime: the demo profiles become seed data, not the whole set.
 *
 * Each `DemoUser` carries:
 *  - `id`     — stable kebab-case identifier (used as the React key + the
 *               ProfileRegistry id).
 *  - `label`  — human-readable display name.
 *  - `role`   — `provider` | `insurer` | `observer`. Drives the partyId
 *               mapping and the action-panel gates.
 *  - `address`— 0x-prefixed 20-byte hex (the wallet that signs writes for
 *               this user). In simulated mode this is the same synthetic
 *               address across all users; in real mode it's the on-chain
 *               address derived from the user's private key.
 *
 * Persistence: `curie:users` under `localStorage` as a JSON-serialised array.
 * `loadUsers()` is defensive — a malformed value (corrupt JSON, wrong shape,
 * missing required fields) falls back to an empty array so the app still
 * boots. `saveUsers()` always writes the canonical shape.
 *
 * The module is dependency-free (no React imports) so unit tests + the eventual
 * Settings UI can both consume it.
 */

/** localStorage key the user registry persists to. */
export const USERS_STORAGE_KEY = "curie:users";

/** Roles a demo user can be assigned. Extensible later, frozen for v0. */
export type DemoRole = "provider" | "insurer" | "observer";

/** A single user in the runtime registry. */
export interface DemoUser {
  readonly id: string;
  readonly label: string;
  readonly role: DemoRole;
  readonly address: string;
}

const ROLE_SET: ReadonlySet<DemoRole> = new Set([
  "provider",
  "insurer",
  "observer",
]);

/** True when `s` is one of the v0 roles. */
export function isDemoRole(s: unknown): s is DemoRole {
  return typeof s === "string" && ROLE_SET.has(s as DemoRole);
}

/**
 * Type-narrow a candidate object to a {@link DemoUser}. Used by the load path
 * to defend against corrupt / out-of-shape persisted values without crashing
 * the app at boot.
 */
export function isDemoUser(u: unknown): u is DemoUser {
  if (u === null || typeof u !== "object") return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o["id"] === "string" && o["id"].length > 0 &&
    typeof o["label"] === "string" && o["label"].length > 0 &&
    isDemoRole(o["role"]) &&
    typeof o["address"] === "string" && /^0x[0-9a-fA-F]{40}$/.test(o["address"])
  );
}

/**
 * Lazy resolver for the browser's localStorage when no explicit storage is
 * provided. Returns null in non-browser environments (Node tsx tests, SSR)
 * so callers degrade gracefully. This module is consumed by BOTH the
 * Node-side tsc build (the `src/` lib, where `window` isn't in lib) AND
 * the Vite-bundled web layer (where `window.localStorage` IS available);
 * using `globalThis` plus a type guard lets the same code path serve both.
 */
function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    const g = globalThis as { localStorage?: Storage };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read the user registry from `localStorage`. Returns an empty array when the
 * key is unset, when the JSON parse fails, or when the persisted value isn't
 * an array of valid {@link DemoUser}s.
 */
export function loadUsers(
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): DemoUser[] {
  if (storage === null) return [];
  let raw: string | null;
  try {
    raw = storage.getItem(USERS_STORAGE_KEY);
  } catch {
    // Storage access failed entirely (private mode, SSR, etc.).
    return [];
  }
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  // Keep only entries that pass the shape check; drop the rest silently so a
  // partial corruption doesn't lose the rest of the registry.
  return parsed.filter(isDemoUser);
}

/**
 * Write the user registry to `localStorage`. Caller is responsible for any
 * domain-level validation; this writes whatever array it's given as-is.
 */
export function saveUsers(
  users: ReadonlyArray<DemoUser>,
  storage: Pick<Storage, "setItem"> | null = defaultStorage(),
): void {
  if (storage === null) return;
  try {
    storage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // Silently swallow storage-quota / access errors — losing the persistence
    // round-trip is preferable to crashing on every save.
  }
}

/**
 * Append a user to the registry, replacing any existing entry that shares
 * the same `id` (so callers can use addUser as both create and update). The
 * returned array is a fresh allocation — callers that need referential
 * stability should compare by id.
 */
export function addUser(
  users: ReadonlyArray<DemoUser>,
  user: DemoUser,
): DemoUser[] {
  const next = users.filter((u) => u.id !== user.id);
  next.push(user);
  return next;
}

/**
 * Remove a user from the registry by id. No-op (returns a shallow copy) when
 * the id isn't present.
 */
export function removeUser(
  users: ReadonlyArray<DemoUser>,
  id: string,
): DemoUser[] {
  return users.filter((u) => u.id !== id);
}

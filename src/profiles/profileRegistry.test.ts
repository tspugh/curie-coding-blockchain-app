/**
 * Tests for `ProfileRegistry` in `src/profiles/profiles.ts`.
 *
 * Pins SPEC-0001 R11/R12: profiles bind a logical party id to the shared
 * wallet; the active id can flip; `addProfile` replaces by id; lookups handle
 * miss cleanly. Existing `profiles.test.ts` pins the `DEFAULT_PROFILES`
 * metadata; this file covers the `ProfileRegistry` class API.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { ProfileRegistry, DEFAULT_PROFILES, type Profile } from "./profiles.js";
import { createWallet } from "../wallet/wallet.js";

function wallet() {
  return createWallet({ mode: "simulated", seed: "test-seed-1" });
}

const extra: Profile = {
  id: "observer",
  label: "Observer",
  partyId: 99n,
  description: "Read-only viewer used in demo walkthroughs.",
};

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

test("ProfileRegistry defaults to DEFAULT_PROFILES + first id active", () => {
  const reg = new ProfileRegistry(wallet());
  assert.deepEqual(
    reg.listProfiles().map((p) => p.id),
    DEFAULT_PROFILES.map((p) => p.id),
  );
  assert.equal(reg.getActiveProfile().id, DEFAULT_PROFILES[0]!.id);
});

test("ProfileRegistry honors a custom initial profile list + activeId", () => {
  const reg = new ProfileRegistry(wallet(), {
    profiles: [extra, ...DEFAULT_PROFILES],
    activeId: "insurer",
  });
  assert.deepEqual(reg.listProfiles().map((p) => p.id), [
    "observer",
    "provider",
    "insurer",
  ]);
  assert.equal(reg.getActiveProfile().id, "insurer");
});

test("ProfileRegistry constructor throws when the initial profile list is empty", () => {
  assert.throws(
    () => new ProfileRegistry(wallet(), { profiles: [] }),
    /requires at least one profile/,
  );
});

test("ProfileRegistry constructor throws when activeId is not in the list", () => {
  assert.throws(
    () => new ProfileRegistry(wallet(), { activeId: "ghost" }),
    /Unknown initial activeId "ghost"/,
  );
});

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

test("getWallet returns the wallet passed at construction (identity)", () => {
  const w = wallet();
  const reg = new ProfileRegistry(w);
  assert.equal(reg.getWallet(), w);
});

test("getActivePartyId delegates to the active profile's partyId", () => {
  const reg = new ProfileRegistry(wallet());
  // Provider is the default-first profile with partyId 1n.
  assert.equal(reg.getActivePartyId(), 1n);
});

test("listProfiles returns a fresh array (caller mutation does not leak in)", () => {
  const reg = new ProfileRegistry(wallet());
  const a = reg.listProfiles();
  a.push(extra);
  // The registry's internal state is unaffected.
  assert.equal(reg.listProfiles().length, DEFAULT_PROFILES.length);
});

// ---------------------------------------------------------------------------
// setActiveProfile
// ---------------------------------------------------------------------------

test("setActiveProfile flips the active id and returns the new active profile", () => {
  const reg = new ProfileRegistry(wallet());
  const result = reg.setActiveProfile("insurer");
  assert.equal(result.id, "insurer");
  assert.equal(reg.getActiveProfile().id, "insurer");
  assert.equal(reg.getActivePartyId(), 2n);
});

test("setActiveProfile throws on an unknown id", () => {
  const reg = new ProfileRegistry(wallet());
  assert.throws(
    () => reg.setActiveProfile("ghost"),
    /Unknown profile "ghost"/,
  );
  // Active id is unchanged after a failed flip.
  assert.equal(reg.getActiveProfile().id, "provider");
});

// ---------------------------------------------------------------------------
// addProfile + getProfile
// ---------------------------------------------------------------------------

test("addProfile registers a new profile and getProfile returns it", () => {
  const reg = new ProfileRegistry(wallet());
  reg.addProfile(extra);
  assert.deepEqual(reg.getProfile("observer"), extra);
  assert.equal(reg.listProfiles().length, DEFAULT_PROFILES.length + 1);
});

test("addProfile replaces an existing profile with the same id", () => {
  const reg = new ProfileRegistry(wallet());
  const replacement: Profile = {
    id: "provider",
    label: "Replaced Provider",
    partyId: 7n,
    description: "Replaced for the registry-replacement test.",
  };
  reg.addProfile(replacement);
  assert.equal(reg.getProfile("provider")?.label, "Replaced Provider");
  // The registry size doesn't grow on a replace.
  assert.equal(reg.listProfiles().length, DEFAULT_PROFILES.length);
});

test("getProfile returns undefined on a miss", () => {
  const reg = new ProfileRegistry(wallet());
  assert.equal(reg.getProfile("ghost"), undefined);
});

// ---------------------------------------------------------------------------
// removeProfile (SPEC-0005 R12 — reactive removal from Settings)
// ---------------------------------------------------------------------------

test("removeProfile drops a registered non-active entry and returns true", () => {
  const reg = new ProfileRegistry(wallet());
  reg.addProfile(extra);
  assert.equal(reg.listProfiles().length, DEFAULT_PROFILES.length + 1);
  assert.equal(reg.removeProfile("observer"), true);
  assert.equal(reg.getProfile("observer"), undefined);
  assert.equal(reg.listProfiles().length, DEFAULT_PROFILES.length);
});

test("removeProfile throws on an unknown id", () => {
  const reg = new ProfileRegistry(wallet());
  assert.throws(() => reg.removeProfile("ghost"), /Unknown profile "ghost"/);
});

test("removeProfile refuses to drop the active profile", () => {
  const reg = new ProfileRegistry(wallet());
  reg.addProfile(extra);
  reg.setActiveProfile("observer");
  assert.throws(
    () => reg.removeProfile("observer"),
    /Cannot remove the active profile/,
  );
  // Registry is unchanged after the rejected delete.
  assert.equal(reg.getProfile("observer")?.id, "observer");
});

test("removeProfile leaves the registry non-empty (single-entry stays active)", () => {
  // The active-profile guard implicitly protects emptiness: in a one-entry
  // registry that entry is necessarily active, so the active-profile check
  // fires first. Verify that observation directly.
  const reg = new ProfileRegistry(wallet(), {
    profiles: [extra],
    activeId: "observer",
  });
  assert.equal(reg.listProfiles().length, 1);
  assert.throws(
    () => reg.removeProfile("observer"),
    /Cannot remove the active profile/,
  );
});

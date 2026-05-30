/**
 * Tests for `src/users/userStore.ts` — the SPEC-0005 R10/R11 user registry.
 *
 * Storage access is mocked via an in-memory stub so the tests run under
 * `node --test` without a browser. The `window.localStorage` default param
 * in the module is lazy-evaluated, so importing the module under Node
 * doesn't trigger the ReferenceError.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  USERS_STORAGE_KEY,
  type DemoUser,
  addUser,
  isDemoRole,
  isDemoUser,
  loadUsers,
  removeUser,
  saveUsers,
} from "./userStore.js";

/** A minimal in-memory storage stub matching the Storage interface subset. */
function makeStorage(seed: Record<string, string> = {}): {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  /** Test-only inspector. */
  raw(): Record<string, string>;
} {
  const data: Record<string, string> = { ...seed };
  return {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k]! : null;
    },
    setItem(k, v) {
      data[k] = v;
    },
    raw() {
      return data;
    },
  };
}

const ALICE: DemoUser = {
  id: "alice",
  label: "Alice Demo",
  role: "provider",
  address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

const BOB: DemoUser = {
  id: "bob",
  label: "Bob Demo",
  role: "insurer",
  address: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
};

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

test("isDemoRole accepts the three v0 roles and rejects others", () => {
  assert.equal(isDemoRole("provider"), true);
  assert.equal(isDemoRole("insurer"), true);
  assert.equal(isDemoRole("observer"), true);
  assert.equal(isDemoRole("admin"), false);
  assert.equal(isDemoRole(""), false);
  assert.equal(isDemoRole(42), false);
  assert.equal(isDemoRole(null), false);
});

test("isDemoUser narrows a valid shape and rejects malformed candidates", () => {
  assert.equal(isDemoUser(ALICE), true);
  assert.equal(isDemoUser({ ...ALICE, address: "not-hex" }), false);
  assert.equal(isDemoUser({ ...ALICE, role: "admin" }), false);
  assert.equal(isDemoUser({ ...ALICE, id: "" }), false);
  assert.equal(isDemoUser({ ...ALICE, label: "" }), false);
  assert.equal(isDemoUser(null), false);
  assert.equal(isDemoUser("string"), false);
  assert.equal(isDemoUser({}), false);
});

// ---------------------------------------------------------------------------
// loadUsers / saveUsers round trip
// ---------------------------------------------------------------------------

test("loadUsers returns [] when the key is unset", () => {
  const storage = makeStorage();
  assert.deepEqual(loadUsers(storage), []);
});

test("loadUsers + saveUsers round-trip a valid array", () => {
  const storage = makeStorage();
  saveUsers([ALICE, BOB], storage);
  // The persisted JSON is under the canonical key.
  assert.ok(USERS_STORAGE_KEY in storage.raw());
  const reloaded = loadUsers(storage);
  assert.deepEqual(reloaded, [ALICE, BOB]);
});

test("loadUsers tolerates corrupt JSON by returning []", () => {
  const storage = makeStorage({ [USERS_STORAGE_KEY]: "{not-json" });
  assert.deepEqual(loadUsers(storage), []);
});

test("loadUsers tolerates a non-array persisted value by returning []", () => {
  const storage = makeStorage({ [USERS_STORAGE_KEY]: JSON.stringify({ users: [ALICE] }) });
  assert.deepEqual(loadUsers(storage), []);
});

test("loadUsers drops malformed entries silently and keeps the valid ones", () => {
  const storage = makeStorage({
    [USERS_STORAGE_KEY]: JSON.stringify([
      ALICE,
      { id: "bad", label: "", role: "provider", address: ALICE.address },
      BOB,
      { id: "bad2", role: "invalid", label: "X", address: ALICE.address },
    ]),
  });
  const loaded = loadUsers(storage);
  assert.deepEqual(loaded, [ALICE, BOB]);
});

test("loadUsers swallows storage.getItem throws and returns []", () => {
  const throwingStorage = {
    getItem(_k: string): string | null {
      throw new Error("storage unavailable");
    },
  };
  assert.deepEqual(loadUsers(throwingStorage), []);
});

test("saveUsers swallows storage.setItem throws (no crash)", () => {
  const throwingStorage = {
    setItem(_k: string, _v: string): void {
      throw new Error("quota exceeded");
    },
  };
  // No assertion needed — must not throw.
  saveUsers([ALICE], throwingStorage);
});

// ---------------------------------------------------------------------------
// addUser / removeUser
// ---------------------------------------------------------------------------

test("addUser appends a brand-new user", () => {
  const next = addUser([ALICE], BOB);
  assert.equal(next.length, 2);
  assert.deepEqual(next[1], BOB);
});

test("addUser replaces an existing user with the same id (no duplicates)", () => {
  const alicePromoted: DemoUser = { ...ALICE, role: "insurer" };
  const next = addUser([ALICE, BOB], alicePromoted);
  assert.equal(next.length, 2);
  // The promoted Alice should be present, but only once.
  const alices = next.filter((u) => u.id === "alice");
  assert.equal(alices.length, 1);
  assert.equal(alices[0]!.role, "insurer");
});

test("addUser returns a fresh array (does not mutate the input)", () => {
  const original: DemoUser[] = [ALICE];
  const next = addUser(original, BOB);
  assert.notEqual(next, original);
  assert.equal(original.length, 1);
});

test("removeUser drops the matching id and returns a fresh array", () => {
  const original: DemoUser[] = [ALICE, BOB];
  const next = removeUser(original, "alice");
  assert.equal(next.length, 1);
  assert.equal(next[0]?.id, "bob");
  assert.notEqual(next, original);
});

test("removeUser is a no-op for an unknown id", () => {
  const next = removeUser([ALICE, BOB], "ghost");
  assert.equal(next.length, 2);
});

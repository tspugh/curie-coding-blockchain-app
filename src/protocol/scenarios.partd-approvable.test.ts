/**
 * UNIT-3: partd-approvable curated scenario filesystem contract (SPEC-0004 R1/R2/R4).
 *
 * NO mocks. Reads the actual files from demo-data/scenarios/partd-approvable/.
 * Locks in the §3.4 packet shape and §3.2 PartD formularyRelease discriminant.
 *
 * Run via: node --import tsx --test "src/**\/*.test.ts"
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";

import { PayerLine } from "./ladders.js";
import { assertNoPHI, assertPacketShape, assertRequestedDrugShape, loadScenarioFile } from "./scenarioFixtures.test-helpers.js";

const SLUG = "partd-approvable";
const scenarioFile = (name: string) => path.resolve(
  path.dirname(new URL(import.meta.url).pathname), "..", "..", "demo-data", "scenarios", SLUG, name
);

test("UNIT-3 partd-approvable R4 — all five required files exist", () => {
  for (const file of ["note.md", "packet.json", "payer-profile.json", "requested-drug.json", "expected-outcome.md"]) {
    const full = scenarioFile(file);
    assert.equal(fs.existsSync(full), true, `expected scenario file to exist: ${full}`);
  }
});

test("UNIT-3 partd-approvable R1 — note.md is synthetic, non-empty, contains no PHI markers", () => {
  const notePath = scenarioFile("note.md");
  assert.equal(fs.existsSync(notePath), true, `note.md must exist at ${notePath}`);

  const content = loadScenarioFile(SLUG, "note.md");
  assert.ok(content.length > 500, `note.md must be >500 bytes (got ${content.length})`);

  assertNoPHI(content, "note.md");

  assert.equal(
    /synthetic|fictional|Patient A/i.test(content),
    true,
    'note.md must contain "synthetic", "fictional", or "Patient A" marker',
  );
});

test('UNIT-3 partd-approvable R4 — payer-profile.json has payerLine="PartD" + §3.2 PartD formularyRelease discriminant', () => {
  const profilePath = scenarioFile("payer-profile.json");
  assert.equal(fs.existsSync(profilePath), true, `payer-profile.json must exist at ${profilePath}`);

  const profile = JSON.parse(loadScenarioFile(SLUG, "payer-profile.json")) as Record<string, unknown>;

  assert.equal(profile["payerLine"], "PartD", 'payer-profile.json must have payerLine === "PartD"');
  assert.equal(PayerLine.PartD, 0, "guard: PayerLine.PartD enum value drift");

  const fr = profile["formularyRelease"];
  assert.ok(fr && typeof fr === "object", "payer-profile.json must have a formularyRelease object");
  const release = fr as Record<string, unknown>;

  // §3.2 PartD discriminant: { line: "PartD"; planId; releaseDate; sourceUrl; contentHash }.
  // R8's prose-shorthand `planIdOrProduct` does not appear in the §3.2 TS union — §3.2 wins.
  for (const field of ["line", "planId", "releaseDate", "sourceUrl", "contentHash"]) {
    const val = release[field];
    assert.ok(
      typeof val === "string" && val.length > 0,
      `formularyRelease.${field} must be a non-empty string (got ${typeof val}: ${String(val)})`,
    );
  }
  assert.equal(release["line"], "PartD", 'formularyRelease.line must equal "PartD"');
  assert.match(
    release["contentHash"] as string,
    /^0x[0-9a-fA-F]{64}$/,
    "formularyRelease.contentHash must be a keccak256 hex string (0x + 64 hex)",
  );
});

test("UNIT-3 partd-approvable R4 — requested-drug.json has all six required fields", () => {
  const drugPath = scenarioFile("requested-drug.json");
  assert.equal(fs.existsSync(drugPath), true, `requested-drug.json must exist at ${drugPath}`);

  const drug = JSON.parse(loadScenarioFile(SLUG, "requested-drug.json")) as Record<string, unknown>;
  assertRequestedDrugShape(drug);
});

test("UNIT-3 partd-approvable R10 + §3.4 — packet.json has references[], submittedAt, submittedBy in the canonical Packet shape", () => {
  const packetPath = scenarioFile("packet.json");
  assert.equal(fs.existsSync(packetPath), true, `packet.json must exist at ${packetPath}`);

  const packet = JSON.parse(loadScenarioFile(SLUG, "packet.json")) as Record<string, unknown>;

  // §3.4 names the field `references` — assert exactly that. If a future refactor
  // renames it, this test must fail loudly rather than silently switch arrays.
  assertPacketShape(packet);
});

test('UNIT-3 partd-approvable R4 — expected-outcome.md mentions "Approve" and is >200 bytes', () => {
  const outcomePath = scenarioFile("expected-outcome.md");
  assert.equal(fs.existsSync(outcomePath), true, `expected-outcome.md must exist at ${outcomePath}`);

  const content = loadScenarioFile(SLUG, "expected-outcome.md");
  assert.ok(content.length > 200, `expected-outcome.md must be >200 bytes (got ${content.length})`);
  assert.ok(/Approve|APPROVE/.test(content), 'expected-outcome.md must contain "Approve" or "APPROVE"');
});

test("UNIT-3 partd-approvable R1 — expected-outcome.md contains no PHI markers", () => {
  // R1 applies to ALL curated content, not just note.md. expected-outcome.md is
  // synthetic narrative authored alongside the note and shares the same exposure.
  const content = loadScenarioFile(SLUG, "expected-outcome.md");
  assertNoPHI(content, "expected-outcome.md");
});

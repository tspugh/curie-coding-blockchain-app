/**
 * UNIT-3c: medicaid-denied-then-appealed curated scenario filesystem contract (SPEC-0004 R1/R2/R4).
 *
 * NO mocks. Reads the actual files from demo-data/scenarios/medicaid-denied-then-appealed/.
 * Locks in the §3.4 packet shape, §3.2 Medicaid formularyRelease discriminant
 * ({ line, state, mco, revision, sourceUrl, contentHash }), and the R6c + R14a
 * round-0-Deny → round-1-Approve appeal arc.
 *
 * Run via: node --import tsx --test "src/**\/*.test.ts"
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";

import { PayerLine } from "./ladders.js";
import { assertNoPHI, assertPacketShape, assertRequestedDrugShape, loadScenarioFile } from "./scenarioFixtures.test-helpers.js";

const SLUG = "medicaid-denied-then-appealed";
const scenarioFile = (name: string) => path.resolve(
  path.dirname(new URL(import.meta.url).pathname), "..", "..", "demo-data", "scenarios", SLUG, name
);

test("UNIT-3c medicaid-denied-then-appealed R4 — all five required files exist", () => {
  for (const file of ["note.md", "packet.json", "payer-profile.json", "requested-drug.json", "expected-outcome.md"]) {
    const full = scenarioFile(file);
    assert.equal(fs.existsSync(full), true, `expected scenario file to exist: ${full}`);
  }
});

test("UNIT-3c medicaid-denied-then-appealed R1 — note.md is synthetic, non-empty, contains no PHI markers", () => {
  const notePath = scenarioFile("note.md");
  assert.equal(fs.existsSync(notePath), true, `note.md must exist at ${notePath}`);

  const content = loadScenarioFile(SLUG, "note.md");
  assert.ok(content.length > 500, `note.md must be >500 bytes (got ${content.length})`);

  assertNoPHI(content, "note.md");

  assert.equal(
    /synthetic|fictional|Patient C/i.test(content),
    true,
    'note.md must contain "synthetic", "fictional", or "Patient C" marker',
  );
});

test("UNIT-3c medicaid-denied-then-appealed R1 — expected-outcome.md contains no PHI markers", () => {
  const content = loadScenarioFile(SLUG, "expected-outcome.md");
  // R1 applies to ALL curated content, not just note.md. expected-outcome.md is
  // synthetic narrative authored alongside the note and shares the same exposure.
  assertNoPHI(content, "expected-outcome.md");
});

test('UNIT-3c medicaid-denied-then-appealed R4 — payer-profile.json has payerLine="Medicaid" + §3.2 Medicaid formularyRelease discriminant', () => {
  const profilePath = scenarioFile("payer-profile.json");
  assert.equal(fs.existsSync(profilePath), true, `payer-profile.json must exist at ${profilePath}`);

  const profile = JSON.parse(loadScenarioFile(SLUG, "payer-profile.json")) as Record<string, unknown>;

  assert.equal(profile["payerLine"], "Medicaid", 'payer-profile.json must have payerLine === "Medicaid"');
  assert.equal(PayerLine.Medicaid, 2, "guard: PayerLine.Medicaid enum value drift");

  const fr = profile["formularyRelease"];
  assert.ok(fr && typeof fr === "object", "payer-profile.json must have a formularyRelease object");
  const release = fr as Record<string, unknown>;

  // §3.2 Medicaid discriminant: { line: "Medicaid"; state; mco; revision; sourceUrl; contentHash }.
  // NOT planId (PartD discriminant). NOT carrier/product (Commercial discriminant). §3.2 wins.
  for (const field of ["line", "state", "mco", "revision", "sourceUrl", "contentHash"]) {
    const val = release[field];
    assert.ok(
      typeof val === "string" && val.length > 0,
      `formularyRelease.${field} must be a non-empty string (got ${typeof val}: ${String(val)})`,
    );
  }
  assert.equal(release["line"], "Medicaid", 'formularyRelease.line must equal "Medicaid"');
  assert.match(
    release["contentHash"] as string,
    /^0x[0-9a-fA-F]{64}$/,
    "formularyRelease.contentHash must be a keccak256 hex string (0x + 64 hex)",
  );
});

test("UNIT-3c medicaid-denied-then-appealed R4 — requested-drug.json has all six fields per R4 (5 strings + numeric quantity)", () => {
  const drugPath = scenarioFile("requested-drug.json");
  assert.equal(fs.existsSync(drugPath), true, `requested-drug.json must exist at ${drugPath}`);

  const drug = JSON.parse(loadScenarioFile(SLUG, "requested-drug.json")) as Record<string, unknown>;
  assertRequestedDrugShape(drug);
});

test("UNIT-3c medicaid-denied-then-appealed §3.4 — packet.json has references[], submittedAt: number, submittedBy: 0x+40hex, sentinel address 0x0000000000000000000000000000000000000003", () => {
  const packetPath = scenarioFile("packet.json");
  assert.equal(fs.existsSync(packetPath), true, `packet.json must exist at ${packetPath}`);

  const packet = JSON.parse(loadScenarioFile(SLUG, "packet.json")) as Record<string, unknown>;

  assertPacketShape(packet);

  // Lock in the per-scenario sentinel address for this scenario (distinct from commercial=0x...002).
  const submittedBy = packet["submittedBy"];
  assert.equal(
    submittedBy,
    "0x0000000000000000000000000000000000000003",
    "packet.submittedBy must be the Medicaid-scenario sentinel 0x0000000000000000000000000000000000000003",
  );
});

test("UNIT-3c medicaid-denied-then-appealed §3.4 — packet.json closed-enum invariant: all slice.kind values are in the SPEC-0004 §3.4 closed enum", () => {
  const packet = JSON.parse(loadScenarioFile(SLUG, "packet.json")) as Record<string, unknown>;
  const references = packet["references"] as Record<string, unknown>[];

  const sliceKindOf = (ref: Record<string, unknown>): string | undefined => {
    const slice = ref["slice"];
    if (slice && typeof slice === "object") {
      const k = (slice as Record<string, unknown>)["kind"];
      return typeof k === "string" ? k : undefined;
    }
    return undefined;
  };

  const kinds = references.map(sliceKindOf);
  for (const k of kinds) {
    if (k === undefined) continue;
    assert.ok(
      ["fda-label-indication", "fda-label-contraindication", "guideline-recommendation", "formulary-entry", "price-benchmark"].includes(k),
      `slice.kind "${k}" is not in the SPEC-0004 §3.4 closed enum`,
    );
  }
});

test("UNIT-3c medicaid-denied-then-appealed R6c + R14a — expected-outcome.md header names round-0 Deny → round-1 Approve arc", () => {
  // R6c (appeal loop): the Medicaid scenario exercises the denied-then-appealed arc —
  // initial PA-criteria denial at (Medicaid, 0), appeal at (Medicaid, 1) flips to Approve.
  // R14a (sequencing): the expected-outcome must document both rulings in order.
  const content = loadScenarioFile(SLUG, "expected-outcome.md");
  assert.ok(content.length > 200, `expected-outcome.md must be >200 bytes (got ${content.length})`);

  // Both ruling words must appear in the document (round-0 Deny AND round-1 Approve).
  assert.ok(
    /\bDeny\b/.test(content),
    'expected-outcome.md must contain "Deny" (round-0 ruling)',
  );
  assert.ok(
    /\bApprove\b/.test(content),
    'expected-outcome.md must contain "Approve" (round-1 ruling after appeal)',
  );

  // Header line — pins the load-bearing claim without a fragile global-ordering heuristic.
  const headerLine = content.split("\n").find((l) => /^##\s*Expected outcome\b/i.test(l));
  assert.ok(headerLine, 'expected-outcome.md must have an "## Expected outcome:" header');
  assert.ok(
    /\bDeny\b/.test(headerLine!),
    `expected-outcome.md "## Expected outcome:" header must name Deny (round-0 ruling); got: ${headerLine}`,
  );
  assert.ok(
    /\bApprove\b/.test(headerLine!),
    `expected-outcome.md "## Expected outcome:" header must name Approve (round-1 appeal ruling); got: ${headerLine}`,
  );

  // R14a (sequencing): the round-0 Deny must precede the round-1 Approve in the
  // header. A header "Approve → Deny" would invert the appeal arc.
  const denyIdx = headerLine!.search(/\bDeny\b/);
  const approveIdx = headerLine!.search(/\bApprove\b/);
  assert.ok(
    denyIdx < approveIdx,
    `expected-outcome.md header must name Deny BEFORE Approve (R14a appeal arc: round-0 Deny → round-1 Approve); got: ${headerLine}`,
  );
});

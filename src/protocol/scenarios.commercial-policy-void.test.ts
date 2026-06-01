/**
 * UNIT-3b: commercial-policy-void curated scenario filesystem contract (SPEC-0004 R1/R2/R4).
 *
 * NO mocks. Reads the actual files from demo-data/scenarios/commercial-policy-void/.
 * Locks in the §3.4 packet shape, §3.2 Commercial formularyRelease discriminant, and
 * the SPEC-0004 §2.6 R23 on-label-policy-void invariant. Per amendment
 * docs/amendments/0005-policy-void-r23-supersedes-r6b.md, the expected ruling is
 * Approve + policyVoidedClauseIndices, NOT terminal PolicyInvalidated.
 *
 * Run via: node --import tsx --test "src/**\/*.test.ts"
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";

import { PayerLine } from "./ladders.js";
import { assertNoPHI, assertPacketShape, assertRequestedDrugShape, loadScenarioFile } from "./scenarioFixtures.test-helpers.js";

const SLUG = "commercial-policy-void";
const scenarioFile = (name: string) => path.resolve(
  path.dirname(new URL(import.meta.url).pathname), "..", "..", "demo-data", "scenarios", SLUG, name
);

test("UNIT-3b commercial-policy-void R4 — all five required files exist", () => {
  for (const file of ["note.md", "packet.json", "payer-profile.json", "requested-drug.json", "expected-outcome.md"]) {
    const full = scenarioFile(file);
    assert.equal(fs.existsSync(full), true, `expected scenario file to exist: ${full}`);
  }
});

test("UNIT-3b commercial-policy-void R1 — note.md is synthetic, non-empty, contains no PHI markers", () => {
  const notePath = scenarioFile("note.md");
  assert.equal(fs.existsSync(notePath), true, `note.md must exist at ${notePath}`);

  const content = loadScenarioFile(SLUG, "note.md");
  assert.ok(content.length > 500, `note.md must be >500 bytes (got ${content.length})`);

  assertNoPHI(content, "note.md");

  assert.equal(
    /synthetic|fictional|Patient B/i.test(content),
    true,
    'note.md must contain "synthetic", "fictional", or "Patient B" marker',
  );
});

test("UNIT-3b commercial-policy-void R1 — expected-outcome.md contains no PHI markers", () => {
  const content = loadScenarioFile(SLUG, "expected-outcome.md");
  // R1 applies to ALL curated content, not just note.md. expected-outcome.md is
  // synthetic narrative authored alongside the note and shares the same exposure.
  assertNoPHI(content, "expected-outcome.md");
});

test('UNIT-3b commercial-policy-void R4 — payer-profile.json has payerLine="Commercial" + §3.2 Commercial formularyRelease discriminant', () => {
  const profilePath = scenarioFile("payer-profile.json");
  assert.equal(fs.existsSync(profilePath), true, `payer-profile.json must exist at ${profilePath}`);

  const profile = JSON.parse(loadScenarioFile(SLUG, "payer-profile.json")) as Record<string, unknown>;

  assert.equal(profile["payerLine"], "Commercial", 'payer-profile.json must have payerLine === "Commercial"');
  assert.equal(PayerLine.Commercial, 1, "guard: PayerLine.Commercial enum value drift");

  const fr = profile["formularyRelease"];
  assert.ok(fr && typeof fr === "object", "payer-profile.json must have a formularyRelease object");
  const release = fr as Record<string, unknown>;

  // §3.2 Commercial discriminant: { line: "Commercial"; carrier; product; revision; sourceUrl; contentHash }.
  // NOT planId — that is the PartD discriminant. §3.2 wins over R8's prose-shorthand.
  for (const field of ["line", "carrier", "product", "revision", "sourceUrl", "contentHash"]) {
    const val = release[field];
    assert.ok(
      typeof val === "string" && val.length > 0,
      `formularyRelease.${field} must be a non-empty string (got ${typeof val}: ${String(val)})`,
    );
  }
  assert.equal(release["line"], "Commercial", 'formularyRelease.line must equal "Commercial"');
  assert.match(
    release["contentHash"] as string,
    /^0x[0-9a-fA-F]{64}$/,
    "formularyRelease.contentHash must be a keccak256 hex string (0x + 64 hex)",
  );
});

test("UNIT-3b commercial-policy-void R4 — requested-drug.json has all six fields per R4 (5 strings + numeric quantity)", () => {
  const drugPath = scenarioFile("requested-drug.json");
  assert.equal(fs.existsSync(drugPath), true, `requested-drug.json must exist at ${drugPath}`);

  const drug = JSON.parse(loadScenarioFile(SLUG, "requested-drug.json")) as Record<string, unknown>;
  assertRequestedDrugShape(drug);
});

test("UNIT-3b commercial-policy-void §3.4 — packet.json has references[], submittedAt: number, submittedBy: 0x+40hex", () => {
  const packetPath = scenarioFile("packet.json");
  assert.equal(fs.existsSync(packetPath), true, `packet.json must exist at ${packetPath}`);

  const packet = JSON.parse(loadScenarioFile(SLUG, "packet.json")) as Record<string, unknown>;
  assertPacketShape(packet);
});

test("UNIT-3b commercial-policy-void §2.6 R23 — packet.json carries an FDA-label slice and a guideline-recommendation slice (load-bearing for R23 policy-void detection)", () => {
  // R23 detection consumes BOTH: an FDA-label slice (the public standard) and a
  // guideline-recommendation slice (the payer guideline whose clause contradicts the
  // standard). §3.4 names the closed slice.kind enum:
  //   "fda-label-indication" | "fda-label-contraindication" | "guideline-recommendation"
  //   | "formulary-entry" | "price-benchmark"
  // The Aetna CPB clause is structurally a payer guideline → "guideline-recommendation".
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
  assert.ok(
    kinds.includes("fda-label-indication"),
    'packet must carry an FDA-label-indication slice (R23 detection consumes this as the public-standard side)',
  );
  assert.ok(
    kinds.includes("guideline-recommendation"),
    'packet must carry a guideline-recommendation slice (R23 detection consumes this as the contradicting payer-guideline side; Aetna CPB → guideline-recommendation per §3.4 closed enum)',
  );
  for (const k of kinds) {
    if (k === undefined) continue;
    assert.ok(
      ["fda-label-indication", "fda-label-contraindication", "guideline-recommendation", "formulary-entry", "price-benchmark"].includes(k),
      `slice.kind "${k}" is not in the SPEC-0004 §3.4 closed enum`,
    );
  }
});

test("UNIT-3b commercial-policy-void §2.6 R23 — expected-outcome.md header names Approve (R23 policy-void escape hatch), NOT terminal PolicyInvalidated", () => {
  // Per amendment 0005-policy-void-r23-supersedes-r6b.md, the expected ruling is
  // Approve + policyVoidedClauseIndices, NOT terminal PolicyInvalidated.
  const content = loadScenarioFile(SLUG, "expected-outcome.md");
  assert.ok(content.length > 200, `expected-outcome.md must be >200 bytes (got ${content.length})`);

  // Header line — pins the load-bearing claim without a fragile global-ordering heuristic.
  const headerLine = content.split("\n").find((l) => /^##\s*Expected outcome\b/i.test(l));
  assert.ok(headerLine, 'expected-outcome.md must have an "## Expected outcome:" header');
  assert.ok(
    /\bApprove\b/.test(headerLine!),
    `expected-outcome.md "## Expected outcome:" header must name Approve (R23 path); got: ${headerLine}`,
  );
  assert.ok(
    !/PolicyInvalidated|PolicyInvalid\b/i.test(headerLine!),
    `expected-outcome.md "## Expected outcome:" header must not name PolicyInvalidated (superseded by R23 per amendment 0005); got: ${headerLine}`,
  );

  // The R23 payload field MUST appear somewhere in the document.
  assert.ok(
    /policyVoidedClauseIndices/.test(content),
    'expected-outcome.md must reference policyVoidedClauseIndices (R23 ruling-payload field)',
  );
});

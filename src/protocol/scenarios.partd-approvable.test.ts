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
import { fileURLToPath } from "node:url";

import { PayerLine } from "./ladders.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..", "..");
const SCENARIO_DIR = path.join(PROJECT_ROOT, "demo-data", "scenarios", "partd-approvable");

const scenarioFile = (name: string) => path.join(SCENARIO_DIR, name);

test("UNIT-3 partd-approvable R4 — all five required files exist", () => {
  for (const file of ["note.md", "packet.json", "payer-profile.json", "requested-drug.json", "expected-outcome.md"]) {
    const full = scenarioFile(file);
    assert.equal(fs.existsSync(full), true, `expected scenario file to exist: ${full}`);
  }
});

test("UNIT-3 partd-approvable R1 — note.md is synthetic, non-empty, contains no PHI markers", () => {
  const notePath = scenarioFile("note.md");
  assert.equal(fs.existsSync(notePath), true, `note.md must exist at ${notePath}`);

  const content = fs.readFileSync(notePath, "utf-8");
  assert.ok(content.length > 500, `note.md must be >500 bytes (got ${content.length})`);

  const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
  assert.equal(/\bSSN\b\s*[:#]?\s*\d{3}/i.test(stripped), false, "note.md must not contain SSN marker patterns");
  assert.equal(/\d{3}-\d{2}-\d{4}/.test(stripped), false, "note.md must not contain SSN-format digit strings");
  assert.equal(/\b\d{2}\/\d{2}\/\d{4}\b/.test(stripped), false, "note.md must not contain MM/DD/YYYY DOB");
  assert.equal(/[A-Z]{2}\d{6,}/.test(stripped), false, "note.md must not contain driver-license-shaped identifiers");
  // Phone: NNN-NNN-NNNN / NNN.NNN.NNNN / (NNN) NNN-NNNN. Synthetic 7-digit IDs don't trip.
  assert.equal(
    /\b(?:\(\d{3}\)\s?|\d{3}[-.])\d{3}[-.\s]?\d{4}\b/.test(stripped),
    false,
    "note.md must not contain phone-number shapes",
  );
  assert.equal(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(stripped),
    false,
    "note.md must not contain email addresses",
  );
  // Real MRN shapes are 7+ contiguous digits; the synthetic "MRN 000-PARTD-001" has
  // only 3 digits before the dash and is intentionally not numeric, so it slips this.
  assert.equal(
    /\bMRN\s*[:#]?\s*\d{7,}\b/i.test(stripped),
    false,
    "note.md must not contain real-shaped MRNs (7+ contiguous digits)",
  );

  assert.equal(
    /synthetic|fictional|Patient A/i.test(content),
    true,
    'note.md must contain "synthetic", "fictional", or "Patient A" marker',
  );
});

test('UNIT-3 partd-approvable R4 — payer-profile.json has payerLine="PartD" + §3.2 PartD formularyRelease discriminant', () => {
  const profilePath = scenarioFile("payer-profile.json");
  assert.equal(fs.existsSync(profilePath), true, `payer-profile.json must exist at ${profilePath}`);

  const raw = fs.readFileSync(profilePath, "utf-8");
  const profile = JSON.parse(raw) as Record<string, unknown>;

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

  const drug = JSON.parse(fs.readFileSync(drugPath, "utf-8")) as Record<string, unknown>;

  for (const field of ["ndc", "rxnormCui", "name", "dose", "requestedFor"]) {
    const val = drug[field];
    assert.ok(
      typeof val === "string" && val.length > 0,
      `requested-drug.json.${field} must be a non-empty string`,
    );
  }
  const qty = drug["quantity"];
  const qtyOk =
    (typeof qty === "number" && Number.isFinite(qty)) ||
    (typeof qty === "string" && qty.length > 0 && Number.isFinite(Number(qty)));
  assert.ok(qtyOk, 'requested-drug.json.quantity must be a number or numeric string');
});

test("UNIT-3 partd-approvable R10 + §3.4 — packet.json has references[], submittedAt, submittedBy in the canonical Packet shape", () => {
  const packetPath = scenarioFile("packet.json");
  assert.equal(fs.existsSync(packetPath), true, `packet.json must exist at ${packetPath}`);

  const packet = JSON.parse(fs.readFileSync(packetPath, "utf-8")) as Record<string, unknown>;

  // §3.4 names the field `references` — assert exactly that. If a future refactor
  // renames it, this test must fail loudly rather than silently switch arrays.
  const references = packet["references"];
  assert.ok(Array.isArray(references), "packet.json must have a top-level `references` array (SPEC-0004 §3.4)");
  assert.ok(references.length >= 1, "packet.json must contain at least one EvidenceReference");

  const first = references[0] as Record<string, unknown>;
  const url = first["url"];
  assert.ok(typeof url === "string" && url.length > 0, "EvidenceReference[0].url must be a non-empty string");

  const ch = first["contentHash"];
  assert.ok(
    typeof ch === "string" && /^0x[0-9a-fA-F]{64}$/.test(ch),
    `EvidenceReference[0].contentHash must be a keccak256 hex string (0x + 64 hex); got ${String(ch)}`,
  );

  // §3.4 Packet shape: { references, submittedAt, submittedBy }. submittedAt is number.
  const submittedAt = packet["submittedAt"];
  assert.ok(
    typeof submittedAt === "number" && Number.isFinite(submittedAt) && submittedAt > 0,
    `packet.submittedAt must be a positive number (unix seconds per §3.4); got ${typeof submittedAt}`,
  );

  const submittedBy = packet["submittedBy"];
  assert.ok(
    typeof submittedBy === "string" && /^0x[0-9a-fA-F]{40}$/.test(submittedBy),
    `packet.submittedBy must be a 20-byte hex address (0x + 40 hex); got ${String(submittedBy)}`,
  );
});

test('UNIT-3 partd-approvable R4 — expected-outcome.md mentions "Approve" and is >200 bytes', () => {
  const outcomePath = scenarioFile("expected-outcome.md");
  assert.equal(fs.existsSync(outcomePath), true, `expected-outcome.md must exist at ${outcomePath}`);

  const content = fs.readFileSync(outcomePath, "utf-8");
  assert.ok(content.length > 200, `expected-outcome.md must be >200 bytes (got ${content.length})`);
  assert.ok(/Approve|APPROVE/.test(content), 'expected-outcome.md must contain "Approve" or "APPROVE"');
});

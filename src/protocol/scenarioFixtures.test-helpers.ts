import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Asserts that the given content string contains no PHI marker patterns.
 * HTML comments are stripped before scanning (synthetic markers live there).
 * Covers SSN markers, SSN-format digit strings, MM/DD/YYYY DOB, driver-license
 * shapes, phone numbers, email addresses, and real-shaped MRNs (7+ digits).
 */
export function assertNoPHI(content: string, fileLabel: string): void {
  const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
  assert.equal(
    /\bSSN\b\s*[:#]?\s*\d{3}/i.test(stripped),
    false,
    `${fileLabel}: must not contain SSN marker patterns`,
  );
  assert.equal(
    /\d{3}-\d{2}-\d{4}/.test(stripped),
    false,
    `${fileLabel}: must not contain SSN-format digit strings`,
  );
  assert.equal(
    /\b\d{2}\/\d{2}\/\d{4}\b/.test(stripped),
    false,
    `${fileLabel}: must not contain MM/DD/YYYY DOB`,
  );
  assert.equal(
    /[A-Z]{2}\d{6,}/.test(stripped),
    false,
    `${fileLabel}: must not contain driver-license-shaped identifiers`,
  );
  assert.equal(
    /\b(?:\(\d{3}\)\s?|\d{3}[-.])\d{3}[-.\s]?\d{4}\b/.test(stripped),
    false,
    `${fileLabel}: must not contain phone-number shapes`,
  );
  assert.equal(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(stripped),
    false,
    `${fileLabel}: must not contain email addresses`,
  );
  assert.equal(
    /\bMRN\s*[:#]?\s*\d{7,}\b/i.test(stripped),
    false,
    `${fileLabel}: must not contain real-shaped MRNs (7+ contiguous digits)`,
  );
}

/**
 * Reads a scenario fixture file from demo-data/scenarios/<slug>/<filename>.
 * Throws (ENOENT) if the file does not exist — callers do existsSync checks
 * separately before calling into assertions that need the content.
 */
export function loadScenarioFile(slug: string, filename: string): string {
  const filePath = path.resolve(REPO_ROOT, "demo-data", "scenarios", slug, filename);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Asserts the universal SPEC-0004 §3.4 Packet shape invariants:
 * - references[] is a non-empty array
 * - references[0].url is a non-empty string
 * - references[0].contentHash is a keccak256 hex string (0x + 64 hex)
 * - submittedAt is a positive finite number (unix seconds)
 * - submittedBy is a 20-byte hex address (0x + 40 hex)
 *
 * Scenario-specific extensions (e.g. sentinel address, R23 indices) stay inline
 * in each test file — this helper only covers the universal §3.4 invariants.
 */
export function assertPacketShape(packet: unknown): void {
  const p = packet as Record<string, unknown>;

  const references = p["references"];
  assert.ok(Array.isArray(references), "packet.json must have a top-level `references` array (SPEC-0004 §3.4)");
  assert.ok((references as unknown[]).length >= 1, "packet.json must contain at least one EvidenceReference");

  const first = (references as Record<string, unknown>[])[0] as Record<string, unknown>;
  const url = first["url"];
  assert.ok(typeof url === "string" && url.length > 0, "EvidenceReference[0].url must be a non-empty string");

  const ch = first["contentHash"];
  assert.ok(
    typeof ch === "string" && /^0x[0-9a-fA-F]{64}$/.test(ch),
    `EvidenceReference[0].contentHash must be a keccak256 hex string (0x + 64 hex); got ${String(ch)}`,
  );

  const submittedAt = p["submittedAt"];
  assert.ok(
    typeof submittedAt === "number" && Number.isFinite(submittedAt) && submittedAt > 0,
    `packet.submittedAt must be a positive number (unix seconds per §3.4); got ${typeof submittedAt}`,
  );

  const submittedBy = p["submittedBy"];
  assert.ok(
    typeof submittedBy === "string" && /^0x[0-9a-fA-F]{40}$/.test(submittedBy),
    `packet.submittedBy must be a 20-byte hex address (0x + 40 hex); got ${String(submittedBy)}`,
  );
}

/**
 * Asserts the universal SPEC-0004 R4 requested-drug shape:
 * 5 non-empty string fields (ndc, rxnormCui, name, dose, requestedFor)
 * + a numeric-or-numeric-string quantity.
 */
export function assertRequestedDrugShape(drug: unknown): void {
  const d = drug as Record<string, unknown>;
  for (const field of ["ndc", "rxnormCui", "name", "dose", "requestedFor"]) {
    const val = d[field];
    assert.ok(
      typeof val === "string" && val.length > 0,
      `requested-drug.json.${field} must be a non-empty string`,
    );
  }
  const qty = d["quantity"];
  const qtyOk =
    (typeof qty === "number" && Number.isFinite(qty)) ||
    (typeof qty === "string" && qty.length > 0 && Number.isFinite(Number(qty)));
  assert.ok(qtyOk, "requested-drug.json.quantity must be a number or numeric string");
}

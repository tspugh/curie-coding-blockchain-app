/**
 * Unit tests for the A0012 / SPEC-0007 R13 attestation helpers (web/src/attestations.ts).
 * Pure logic — no DOM render needed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ZERO_HASH,
  hashContent,
  getCuratedPolicy,
  PayerLine,
} from "../../dist/index.js";

import {
  renderCuratedPolicyText,
  resolveAttestedClauses,
  buildAttestations,
} from "./attestations.js";

const PARTD = getCuratedPolicy("partd-formulary-adalimumab")!;
const PARTD_HASH = hashContent(renderCuratedPolicyText(PARTD));

test("resolveAttestedClauses: matches the attached Part D policy → only its attested clauses", () => {
  const clauses = resolveAttestedClauses(PARTD_HASH, PayerLine.PartD);
  // PD-ADA-02 is the attested clause; PD-ADA-01 is public and must be excluded.
  assert.equal(clauses.length, 1);
  assert.equal(clauses[0]?.id, "PD-ADA-02");
  assert.equal(clauses[0]?.type, "attested");
});

test("resolveAttestedClauses: ZERO_HASH / null / unmatched / wrong-line → []", () => {
  assert.deepEqual(resolveAttestedClauses(ZERO_HASH, PayerLine.PartD), []);
  assert.deepEqual(resolveAttestedClauses(null, PayerLine.PartD), []);
  assert.deepEqual(resolveAttestedClauses(undefined, PayerLine.PartD), []);
  assert.deepEqual(resolveAttestedClauses(hashContent("not a real policy"), PayerLine.PartD), []);
  // Correct hash but searched in the wrong payer line → no match.
  assert.deepEqual(resolveAttestedClauses(PARTD_HASH, PayerLine.Commercial), []);
});

test("resolveAttestedClauses: case-insensitive hash match", () => {
  const clauses = resolveAttestedClauses(PARTD_HASH.toUpperCase(), PayerLine.PartD);
  assert.equal(clauses.length, 1);
});

test("buildAttestations: maps clause id + url to keccak hashes; carries the boolean", () => {
  const clauses = resolveAttestedClauses(PARTD_HASH, PayerLine.PartD);
  const out = buildAttestations(clauses, {
    "PD-ADA-02": { attested: true, evidenceUrl: "https://example.org/deid-lab" },
  });
  assert.equal(out.length, 1);
  assert.equal(out[0]?.clauseId, hashContent("PD-ADA-02"));
  assert.equal(out[0]?.attested, true);
  assert.equal(out[0]?.evidenceUriHash, hashContent("https://example.org/deid-lab"));
});

test("buildAttestations: unset clause → attested:false, evidenceUriHash ZERO_HASH", () => {
  const clauses = resolveAttestedClauses(PARTD_HASH, PayerLine.PartD);
  const out = buildAttestations(clauses, {});
  assert.equal(out[0]?.attested, false);
  assert.equal(out[0]?.evidenceUriHash, ZERO_HASH);
});

test("buildAttestations: whitespace-only evidence URL → ZERO_HASH (no empty-string hash)", () => {
  const clauses = resolveAttestedClauses(PARTD_HASH, PayerLine.PartD);
  const out = buildAttestations(clauses, { "PD-ADA-02": { attested: true, evidenceUrl: "   " } });
  assert.equal(out[0]?.evidenceUriHash, ZERO_HASH);
});

/**
 * Tests for the Create-view demo cases. The critical invariant: every dropdown option's
 * `drug` resolves in drugEvidenceMap (so selecting it always auto-fills the evidence URL +
 * prompt hint — a dropdown can never offer a dead option).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { DEMO_CASES, getDemoCase } from "./demoCases.js";
import { evidenceForDrug } from "./drugEvidenceMap.js";

test("every demo case resolves to evidence (URL + prompt hint) via drugEvidenceMap", () => {
  for (const c of DEMO_CASES) {
    const entry = evidenceForDrug(c.drug);
    assert.ok(entry !== null, `demo case ${c.id} drug "${c.drug}" must resolve in drugEvidenceMap`);
    assert.ok(entry!.evidenceUrl.startsWith("https://"), `${c.id} evidence URL must be https`);
    assert.ok(entry!.promptHint.length > 0, `${c.id} must have a prompt hint`);
  }
});

test("demo cases have unique ids + non-empty labels/justifications", () => {
  const ids = new Set<string>();
  for (const c of DEMO_CASES) {
    assert.ok(!ids.has(c.id), `duplicate demo case id: ${c.id}`);
    ids.add(c.id);
    assert.ok(c.label.length > 0, `${c.id} needs a label`);
    assert.ok(c.justification.length > 0, `${c.id} needs a justification`);
    assert.ok(/^\d+(\.\d+)?$/.test(c.requestedAmount) && Number(c.requestedAmount) > 0, `${c.id} requestedAmount must be a positive STT decimal`);
    assert.ok(/^\d+$/.test(c.quantity) && Number(c.quantity) > 0, `${c.id} quantity must be > 0`);
  }
  assert.ok(DEMO_CASES.length >= 2, "the dropdown must offer multiple demos");
});

test("getDemoCase looks up by id; unknown → undefined", () => {
  assert.equal(getDemoCase(DEMO_CASES[0]!.id)?.id, DEMO_CASES[0]!.id);
  assert.equal(getDemoCase("nope"), undefined);
});

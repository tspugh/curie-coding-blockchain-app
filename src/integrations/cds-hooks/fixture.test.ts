/**
 * Tests for `src/integrations/cds-hooks/fixture.ts` — the
 * `SAMPLE_ORDER_SIGN_REQUEST` synthetic CDS Hooks payload.
 *
 * Pins the structural and content invariants the demo + the mapper depend on:
 * the `hook` discriminator, the FHIR shape (Bundle → MedicationRequest), the
 * SPEC-0001 R2/R6a quantity constraint, and (most importantly) the SPEC-0004
 * R1 NO-PHI invariant — every identifier here MUST be marked synthetic so a
 * future copy-paste of real patient data fails this test.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { SAMPLE_ORDER_SIGN_REQUEST } from "./fixture.js";

const RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm";
const NDC_SYSTEM = "http://hl7.org/fhir/sid/ndc";
const ICD10_SYSTEM = "http://hl7.org/fhir/sid/icd-10-cm";

// ---------------------------------------------------------------------------
// Top-level CDS Hooks envelope
// ---------------------------------------------------------------------------

test("SAMPLE_ORDER_SIGN_REQUEST.hook is exactly 'order-sign'", () => {
  assert.equal(SAMPLE_ORDER_SIGN_REQUEST.hook, "order-sign");
});

test("SAMPLE_ORDER_SIGN_REQUEST.hookInstance is a UUIDv4-shaped string", () => {
  // Loose v4 check: 8-4-4-4-12 hex with the canonical version/variant nibbles.
  // The fixture's instance is "3f1a8c2e-9b7d-4e6a-8c1f-2d5b6a7c8e90".
  assert.match(
    SAMPLE_ORDER_SIGN_REQUEST.hookInstance,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test("SAMPLE_ORDER_SIGN_REQUEST.context exists and has the expected ids", () => {
  const ctx = SAMPLE_ORDER_SIGN_REQUEST.context;
  assert.ok(ctx);
  assert.ok(ctx.userId.startsWith("Practitioner/"));
  assert.ok(ctx.patientId.startsWith("Patient/"));
  assert.ok(ctx.encounterId?.startsWith("Encounter/"));
});

// ---------------------------------------------------------------------------
// SPEC-0004 R1: NO PHI in the fixture
// ---------------------------------------------------------------------------

test("R1 NO-PHI: every identifier in the fixture is explicitly synthetic", () => {
  // The contract: every Practitioner/Patient/Encounter id must contain
  // "synthetic" so a future copy of real patient data fails this test loud.
  const ctx = SAMPLE_ORDER_SIGN_REQUEST.context;
  assert.match(ctx.userId, /synthetic/i);
  assert.match(ctx.patientId, /synthetic/i);
  assert.match(ctx.encounterId!, /synthetic/i);

  // Also assert the MedicationRequest's subject reference + display are
  // explicit about being synthetic.
  const order = firstOrder();
  assert.match(order.subject!.reference!, /synthetic/i);
  assert.match(order.subject!.display ?? "", /synthetic/i);
});

test("R1 NO-PHI: no real-shape SSN / DOB / phone / email patterns", () => {
  // Serialize the whole fixture and scan for PHI-resembling tokens.
  const json = JSON.stringify(SAMPLE_ORDER_SIGN_REQUEST);
  // SSN xxx-xx-xxxx.
  assert.equal(/\b\d{3}-\d{2}-\d{4}\b/.test(json), false);
  // Date of birth yyyy-mm-dd that isn't the access-date in a comment (not
  // expected in this fixture — verify clean).
  assert.equal(/"\d{4}-\d{2}-\d{2}"/.test(json), false);
  // US phone (xxx) xxx-xxxx OR xxx-xxx-xxxx.
  assert.equal(/\(\d{3}\)\s?\d{3}-\d{4}/.test(json), false);
  assert.equal(/\b\d{3}-\d{3}-\d{4}\b/.test(json), false);
  // Email (rough).
  assert.equal(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(json), false);
});

// ---------------------------------------------------------------------------
// FHIR Bundle shape
// ---------------------------------------------------------------------------

function firstOrder() {
  const entries = SAMPLE_ORDER_SIGN_REQUEST.context.draftOrders!.entry;
  assert.ok(entries && entries.length >= 1, "expected ≥ 1 draft order entry");
  const resource = entries[0]!.resource;
  assert.ok(resource);
  assert.equal(resource.resourceType, "MedicationRequest");
  return resource as Extract<
    typeof resource,
    { resourceType: "MedicationRequest" }
  >;
}

test("draftOrders bundle is a single-entry MedicationRequest collection", () => {
  const bundle = SAMPLE_ORDER_SIGN_REQUEST.context.draftOrders!;
  assert.equal(bundle.resourceType, "Bundle");
  assert.equal(bundle.type, "collection");
  assert.equal(bundle.entry!.length, 1);
});

test("MedicationRequest is a draft order", () => {
  const order = firstOrder();
  assert.equal(order.status, "draft");
  assert.equal(order.intent, "order");
});

test("medicationCodeableConcept carries RxNorm + NDC codings + display text", () => {
  const order = firstOrder();
  const med = order.medicationCodeableConcept!;
  assert.ok(med.text && med.text.length > 0);
  const codings = med.coding ?? [];
  const rxnorm = codings.find((c) => c.system === RXNORM_SYSTEM);
  const ndc = codings.find((c) => c.system === NDC_SYSTEM);
  assert.ok(rxnorm, "RxNorm coding present");
  assert.ok(ndc, "NDC coding present");
  // The demo's adalimumab RXCUI is 1366724.
  assert.equal(rxnorm!.code, "1366724");
});

test("reasonCode is an ICD-10-CM Psoriasis (L40.x) entry", () => {
  const order = firstOrder();
  const reason = order.reasonCode?.[0];
  assert.ok(reason);
  const coding = reason!.coding?.[0];
  assert.equal(coding?.system, ICD10_SYSTEM);
  assert.match(coding!.code!, /^L40\.\d+$/);
});

// ---------------------------------------------------------------------------
// SPEC-0001 R2/R6a: dispense quantity drives the deterministic cap
// ---------------------------------------------------------------------------

test("dispense quantity is > 0 (SPEC-0001 R2/R6a)", () => {
  const order = firstOrder();
  const q = order.dispenseRequest!.quantity!;
  assert.ok(typeof q.value === "number" && q.value > 0);
});

test("expectedSupplyDuration is > 0 days", () => {
  const order = firstOrder();
  const d = order.dispenseRequest!.expectedSupplyDuration!;
  assert.ok(typeof d.value === "number" && d.value > 0);
});

test("dispense quantity unit is a UCUM-coded pen + supply duration is days", () => {
  const order = firstOrder();
  const q = order.dispenseRequest!.quantity!;
  assert.equal(q.code, "{pen}");
  const d = order.dispenseRequest!.expectedSupplyDuration!;
  assert.equal(d.code, "d");
});

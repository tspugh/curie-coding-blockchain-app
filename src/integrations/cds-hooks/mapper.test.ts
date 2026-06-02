/**
 * Tests for `src/integrations/cds-hooks/mapper.ts` — `orderSignToDraft`.
 *
 * Covers SPEC-0002 R7 (the CDS-Hooks seam): every guard-error path AND the
 * happy-path mapping from a CDS Hooks `order-sign` request to a
 * `CoverageRequestDraft`. Also pins the SPEC-0004 R1 NO-PHI invariant by
 * asserting `patientId` / `subject` are NOT propagated to the justification.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { SAMPLE_ORDER_SIGN_REQUEST, orderSignToDraft } from "./index.js";
import type {
  CdsHooksRequest,
  FhirBundleEntry,
  FhirMedicationRequest,
  OrderSignContext,
} from "./types.js";

/** Minimal valid MedicationRequest used to assemble test fixtures. */
function makeOrder(
  overrides: Partial<FhirMedicationRequest> = {},
): FhirMedicationRequest {
  return {
    resourceType: "MedicationRequest",
    status: "active",
    intent: "order",
    medicationCodeableConcept: {
      text: "Test Drug",
      coding: [
        {
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: "12345",
          display: "Test Drug RxNorm",
        },
      ],
    },
    subject: { reference: "Patient/synthetic-001" },
    dispenseRequest: {
      quantity: { value: 2 },
      expectedSupplyDuration: { value: 28, unit: "d" },
    },
    ...overrides,
  };
}

/** Build a CDS Hooks `order-sign` request around a given MedicationRequest. */
function makeRequest(
  order: FhirMedicationRequest | null,
  extras: Partial<FhirBundleEntry>[] = [],
): CdsHooksRequest<OrderSignContext> {
  const entries: FhirBundleEntry[] = [];
  if (order) entries.push({ resource: order });
  entries.push(...(extras as FhirBundleEntry[]));
  return {
    hook: "order-sign",
    hookInstance: "00000000-0000-0000-0000-000000000000",
    context: {
      userId: "Practitioner/synthetic",
      patientId: "synthetic-pt-001",
      draftOrders: { resourceType: "Bundle", entry: entries },
    },
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test("orderSignToDraft maps the SAMPLE_ORDER_SIGN_REQUEST cleanly", () => {
  const draft = orderSignToDraft(SAMPLE_ORDER_SIGN_REQUEST);
  // The fixture's drug text starts with "Adalimumab" — pin the prefix.
  assert.ok(draft.drug.startsWith("Adalimumab"), `drug=${draft.drug}`);
  // quantity + daysSupply are positive bigints.
  assert.equal(typeof draft.quantity, "bigint");
  assert.ok(draft.quantity > 0n);
  assert.equal(typeof draft.daysSupply, "bigint");
  assert.ok(draft.daysSupply > 0n);
  // SPEC-0004 R1 invariant: no PHI passes through to the justification.
  assert.ok(!draft.justification.includes("synthetic-pt-001"));
  assert.ok(!draft.justification.includes("Patient/"));
});

test("orderSignToDraft prefers RxNorm code over other coding systems", () => {
  const order = makeOrder({
    medicationCodeableConcept: {
      text: "Mixed-coding drug",
      coding: [
        { system: "http://hl7.org/fhir/sid/ndc", code: "NDC-0001" },
        {
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: "RXCUI-9999",
        },
      ],
    },
  });
  const draft = orderSignToDraft(makeRequest(order));
  assert.equal(draft.drugCode, "RXCUI-9999");
});

test("orderSignToDraft falls back to the first coding code when no RxNorm present", () => {
  const order = makeOrder({
    medicationCodeableConcept: {
      text: "Non-RxNorm drug",
      coding: [{ system: "http://hl7.org/fhir/sid/ndc", code: "NDC-9876" }],
    },
  });
  const draft = orderSignToDraft(makeRequest(order));
  assert.equal(draft.drugCode, "NDC-9876");
});

test("orderSignToDraft uses concept.text when present; else the first coding's display", () => {
  // Display fallback path — text is empty string (whitespace-only).
  const order = makeOrder({
    medicationCodeableConcept: {
      text: "   ",
      coding: [{ system: "x", code: "X", display: "Display-only Drug" }],
    },
  });
  const draft = orderSignToDraft(makeRequest(order));
  assert.equal(draft.drug, "Display-only Drug");
});

test("orderSignToDraft falls back to coding.code when display is also missing", () => {
  // Code-only fallback path.
  const order = makeOrder({
    medicationCodeableConcept: {
      coding: [{ system: "x", code: "Code-Only" }],
    },
  });
  const draft = orderSignToDraft(makeRequest(order));
  assert.equal(draft.drug, "Code-Only");
});

test("orderSignToDraft surfaces a non-empty diagnosis from reasonCode[0]", () => {
  const order = makeOrder({
    reasonCode: [
      { text: "Moderate-to-severe chronic plaque psoriasis" },
    ],
  });
  const draft = orderSignToDraft(makeRequest(order));
  assert.equal(draft.diagnosis, "Moderate-to-severe chronic plaque psoriasis");
  // Diagnosis SHOULD appear in the justification when present.
  assert.ok(draft.justification.includes("plaque psoriasis"));
});

test("orderSignToDraft omits diagnosis when reasonCode is absent", () => {
  const order = makeOrder({});
  // No reasonCode provided.
  const draft = orderSignToDraft(makeRequest(order));
  assert.equal(draft.diagnosis, undefined);
  // Justification should still be coherent (drug + quantity + days).
  assert.ok(draft.justification.includes("Test Drug"));
});

test("orderSignToDraft justification is single-spaced + no PHI", () => {
  const order = makeOrder({});
  const draft = orderSignToDraft(makeRequest(order));
  // No double spaces.
  assert.ok(!/ {2,}/.test(draft.justification));
  // No PHI identifiers.
  assert.ok(!draft.justification.includes("synthetic-pt-001"));
  assert.ok(!draft.justification.includes("Patient/"));
  // EHR provenance marker present.
  assert.ok(draft.justification.includes("EHR order-sign"));
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

test("orderSignToDraft throws when draftOrders bundle is empty", () => {
  const req = makeRequest(null);
  assert.throws(
    () => orderSignToDraft(req),
    /draftOrders bundle is empty/,
  );
});

test("orderSignToDraft throws when no MedicationRequest is in the bundle", () => {
  // Stash a non-MedicationRequest resource so entries.length > 0 but find()
  // returns undefined (hits the second guard, not the first).
  const req = makeRequest(null, [
    { resource: { resourceType: "Patient" as never } },
  ]);
  assert.throws(
    () => orderSignToDraft(req),
    /no MedicationRequest resource/,
  );
});

test("orderSignToDraft throws when medicationCodeableConcept has no name/code", () => {
  const order = makeOrder({
    medicationCodeableConcept: { coding: [] },
  });
  assert.throws(
    () => orderSignToDraft(makeRequest(order)),
    /no medicationCodeableConcept name\/code/,
  );
});

test("orderSignToDraft throws when dispense quantity is missing", () => {
  const order = makeOrder({
    dispenseRequest: {
      // quantity intentionally omitted
      expectedSupplyDuration: { value: 30 },
    },
  });
  assert.throws(
    () => orderSignToDraft(makeRequest(order)),
    /missing dispenseRequest\.quantity\.value/,
  );
});

test("orderSignToDraft throws when dispense quantity is zero (SPEC-0001 R2/R6a)", () => {
  const order = makeOrder({
    dispenseRequest: {
      quantity: { value: 0 },
      expectedSupplyDuration: { value: 30 },
    },
  });
  assert.throws(
    () => orderSignToDraft(makeRequest(order)),
    /dispense quantity must be > 0/,
  );
});

test("orderSignToDraft throws when dispense quantity is NaN (toBigInt NaN branch)", () => {
  const order = makeOrder({
    dispenseRequest: {
      quantity: { value: Number.NaN },
      expectedSupplyDuration: { value: 30 },
    },
  });
  assert.throws(
    () => orderSignToDraft(makeRequest(order)),
    /missing dispenseRequest\.quantity\.value/,
  );
});

test("orderSignToDraft throws when dispense quantity is negative", () => {
  const order = makeOrder({
    dispenseRequest: {
      quantity: { value: -1 },
      expectedSupplyDuration: { value: 30 },
    },
  });
  assert.throws(
    () => orderSignToDraft(makeRequest(order)),
    /must be a finite, non-negative number/,
  );
});

test("orderSignToDraft throws when dispense quantity is Infinity", () => {
  const order = makeOrder({
    dispenseRequest: {
      quantity: { value: Number.POSITIVE_INFINITY },
      expectedSupplyDuration: { value: 30 },
    },
  });
  assert.throws(
    () => orderSignToDraft(makeRequest(order)),
    /must be a finite, non-negative number/,
  );
});

test("orderSignToDraft throws when expectedSupplyDuration is missing", () => {
  const order = makeOrder({
    dispenseRequest: { quantity: { value: 2 } /* duration omitted */ },
  });
  assert.throws(
    () => orderSignToDraft(makeRequest(order)),
    /missing dispenseRequest\.expectedSupplyDuration\.value/,
  );
});

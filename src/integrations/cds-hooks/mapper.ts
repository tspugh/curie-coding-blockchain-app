/**
 * Map a CDS Hooks 2.0 `order-sign` request to a UI-friendly coverage-request
 * draft (SPEC-0002 R7).
 *
 * This is the thin seam between the inbound EHR payload and the app's Create
 * flow. It produces a *draft* the UI prefills — raw drug name, quantity,
 * daysSupply, diagnosis text, justification, requestedAmount — NOT the on-chain
 * `CreateContractParams` (hashing the justification and resolving wallet
 * addresses are the UI's job; see SPEC-0001 R3/R4). The function is pure and
 * string-level: no hashing, no I/O.
 *
 * Quantity drives the SPEC-0001 deterministic cap; daysSupply is necessity
 * context only (per the 2026-05-27 SPEC-0001 changelog).
 *
 * NO PHI: the composed justification uses the diagnosis + clinical context only;
 * patient identifiers (`patientId`, `subject`) are intentionally NOT propagated.
 */
import type {
  CdsHooksRequest,
  FhirCodeableConcept,
  FhirMedicationRequest,
  OrderSignContext,
} from "./types.js";

/**
 * A UI-friendly coverage-request draft produced from an inbound `order-sign`
 * payload. The UI hydrates the Create form from this, then commits hashes /
 * addresses itself (SPEC-0001 R2/R3/R4).
 */
export interface CoverageRequestDraft {
  /** Human-readable drug name (e.g. `"Adalimumab (Humira) 40 mg/0.8 mL prefilled pen"`). */
  readonly drug: string;
  /** Best available drug code (RxNorm RXCUI preferred, else NDC), if any. */
  readonly drugCode?: string;
  /** Dispensed units — DRIVES the SPEC-0001 deterministic cap (must be > 0). */
  readonly quantity: bigint;
  /** Expected days supply — necessity context only. */
  readonly daysSupply: bigint;
  /** Diagnosis / indication text from the order's reasonCode, if any. */
  readonly diagnosis?: string;
  /** De-identified justification composed from the clinical context (no PHI). */
  readonly justification: string;
  /** Requested amount, if the payload carried one (none in the v0 fixture). */
  readonly requestedAmount?: bigint;
}

/** RxNorm code system URI (CDS Hooks / FHIR R4). */
const RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm";

/** Pull the first MedicationRequest out of the draftOrders bundle, defensively. */
function firstMedicationRequest(
  req: CdsHooksRequest<OrderSignContext>,
): FhirMedicationRequest {
  const entries = req.context?.draftOrders?.entry;
  if (!entries || entries.length === 0) {
    throw new Error(
      "orderSignToDraft: draftOrders bundle is empty — no order to map.",
    );
  }
  const resource = entries.find(
    (e) => e.resource?.resourceType === "MedicationRequest",
  )?.resource;
  if (!resource || resource.resourceType !== "MedicationRequest") {
    throw new Error(
      "orderSignToDraft: draftOrders contains no MedicationRequest resource.",
    );
  }
  return resource as FhirMedicationRequest;
}

/** Best display string for a CodeableConcept: `text`, else first coding display/code. */
function conceptText(concept: FhirCodeableConcept | undefined): string | undefined {
  if (!concept) return undefined;
  if (concept.text && concept.text.trim().length > 0) return concept.text.trim();
  const coding = concept.coding?.[0];
  return coding?.display ?? coding?.code ?? undefined;
}

/** Best code for the medication: RxNorm RXCUI if present, else the first coding's code. */
function drugCodeOf(concept: FhirCodeableConcept | undefined): string | undefined {
  const codings = concept?.coding;
  if (!codings || codings.length === 0) return undefined;
  const rxnorm = codings.find((c) => c.system === RXNORM_SYSTEM && c.code);
  return rxnorm?.code ?? codings.find((c) => c.code)?.code ?? undefined;
}

/** Coerce a FHIR numeric quantity value to a non-negative bigint of whole units. */
function toBigInt(value: number | undefined, field: string): bigint {
  if (value === undefined || value === null || Number.isNaN(value)) {
    throw new Error(`orderSignToDraft: missing ${field} on the order.`);
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`orderSignToDraft: ${field} must be a finite, non-negative number.`);
  }
  return BigInt(Math.round(value));
}

/**
 * Pure mapper: CDS Hooks `order-sign` request → {@link CoverageRequestDraft}.
 *
 * Throws a clear error if the bundle is empty or holds no MedicationRequest, or
 * if the dispense quantity / expected supply duration are missing.
 */
export function orderSignToDraft(
  req: CdsHooksRequest<OrderSignContext>,
): CoverageRequestDraft {
  const order = firstMedicationRequest(req);

  const med = order.medicationCodeableConcept;
  const drug = conceptText(med);
  if (!drug) {
    throw new Error(
      "orderSignToDraft: MedicationRequest has no medicationCodeableConcept name/code.",
    );
  }
  const drugCode = drugCodeOf(med);

  const quantity = toBigInt(order.dispenseRequest?.quantity?.value, "dispenseRequest.quantity.value");
  if (quantity <= 0n) {
    throw new Error("orderSignToDraft: dispense quantity must be > 0 (SPEC-0001 R2/R6a).");
  }
  const daysSupply = toBigInt(
    order.dispenseRequest?.expectedSupplyDuration?.value,
    "dispenseRequest.expectedSupplyDuration.value",
  );

  const diagnosis = conceptText(order.reasonCode?.[0]);

  // De-identified justification: diagnosis + clinical context ONLY (no PHI).
  const parts: string[] = [];
  parts.push(`Coverage exception requested for ${drug}`);
  if (diagnosis) parts.push(`for ${diagnosis}`);
  parts.push(`(dispense ${quantity.toString()} unit(s), ${daysSupply.toString()}-day supply)`);
  parts.push("Submitted via EHR order-sign workflow.");
  const justification = `${parts.join(" ")}`.replace(/\s+/g, " ").trim();

  const draft: {
    drug: string;
    drugCode?: string;
    quantity: bigint;
    daysSupply: bigint;
    diagnosis?: string;
    justification: string;
    requestedAmount?: bigint;
  } = {
    drug,
    quantity,
    daysSupply,
    justification,
  };
  if (drugCode !== undefined) draft.drugCode = drugCode;
  if (diagnosis !== undefined) draft.diagnosis = diagnosis;

  return draft;
}

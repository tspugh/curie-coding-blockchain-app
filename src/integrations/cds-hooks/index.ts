/**
 * CDS Hooks 2.0 integration seam (mocked) — public surface (SPEC-0002 R7).
 *
 * Re-exports the wire-shape types, the synthetic `order-sign` fixture, the pure
 * mapper, and the {@link CoverageRequestDraft} the mapper emits. WIRE SHAPE ONLY:
 * there is no live CDS Hooks server in v0.
 */
export type {
  Card,
  CardLink,
  CardSource,
  CdsHooksRequest,
  CdsHooksResponse,
  FhirAuthorization,
  FhirBundle,
  FhirBundleEntry,
  FhirCodeableConcept,
  FhirCoding,
  FhirDispenseRequest,
  FhirDuration,
  FhirMedicationRequest,
  FhirQuantity,
  FhirReference,
  FhirResource,
  OrderSignContext,
  OverrideReason,
  Suggestion,
  SuggestionAction,
  SystemAction,
} from "./types.js";

export { SAMPLE_ORDER_SIGN_REQUEST } from "./fixture.js";

export { orderSignToDraft } from "./mapper.js";
export type { CoverageRequestDraft } from "./mapper.js";

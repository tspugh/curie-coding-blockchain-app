/**
 * CDS Hooks 2.0 wire-shape types — the inbound EHR integration SEAM (SPEC-0002 R7).
 *
 * These interfaces mirror the **CDS Hooks 2.0** HTTP/JSON protocol so that a real
 * off-chain adapter (v1) can speak the live protocol without reshaping anything in
 * the app. Field names follow the CDS Hooks 2.0 spec
 * (https://cds-hooks.org/specification/current/) and the FHIR R4 resources it
 * references.
 *
 * WIRE SHAPE ONLY — there is NO live CDS Hooks server in v0 (SPEC-0002 R7). The app
 * consumes a local synthetic fixture (see `fixture.ts`) through these types and maps
 * it to a UI-friendly draft (see `mapper.ts`). No PHI: synthetic ids/values only.
 */

// ---------------------------------------------------------------------------
// Minimal FHIR R4 shapes (only the fields the order-sign seam needs)
// ---------------------------------------------------------------------------

/** A FHIR `Coding` — a single code from a code system (CDS Hooks / FHIR R4). */
export interface FhirCoding {
  /** The code system URI (e.g. RxNorm `http://www.nlm.nih.gov/research/umls/rxnorm`). */
  readonly system?: string;
  /** The symbol in the system (e.g. an RxNorm RXCUI or an NDC). */
  readonly code?: string;
  /** Human-readable display for the code. */
  readonly display?: string;
}

/** A FHIR `CodeableConcept` — one concept expressed as codings + free text. */
export interface FhirCodeableConcept {
  /** Codings that describe the concept (RxNorm / NDC / ICD-10, etc.). */
  readonly coding?: readonly FhirCoding[];
  /** Plain-text representation of the concept. */
  readonly text?: string;
}

/** A FHIR `Quantity` (a measured/counted amount with a unit). */
export interface FhirQuantity {
  /** The numeric value of the quantity. */
  readonly value?: number;
  /** Human-readable unit (e.g. `"pen"`, `"days"`). */
  readonly unit?: string;
  /** The unit system URI (e.g. UCUM `http://unitsofmeasure.org`). */
  readonly system?: string;
  /** Coded form of the unit. */
  readonly code?: string;
}

/** A FHIR `Duration` — a length of time. Shape-identical to `FhirQuantity`. */
export type FhirDuration = FhirQuantity;

/** A FHIR `Reference` to another resource. */
export interface FhirReference {
  /** Literal reference, relative or absolute (e.g. `"Patient/synthetic-pt-001"`). */
  readonly reference?: string;
  /** Display string for the referenced resource. */
  readonly display?: string;
}

/**
 * The `dispenseRequest` of a FHIR R4 `MedicationRequest` — what/how much to
 * dispense. The seam reads `quantity` (dispensed units → SPEC-0001 cap basis) and
 * `expectedSupplyDuration` (days supply → necessity context).
 */
export interface FhirDispenseRequest {
  /** Amount of medication to dispense (units that drive the SPEC-0001 cap). */
  readonly quantity?: FhirQuantity;
  /** Expected days supply — necessity context, `unit = "days"` (SPEC-0001 daysSupply). */
  readonly expectedSupplyDuration?: FhirDuration;
}

/**
 * A FHIR R4 `MedicationRequest` (minimal). The CDS Hooks `order-sign` context
 * carries these as the draft orders being signed.
 */
export interface FhirMedicationRequest {
  /** Resource type discriminator — always `"MedicationRequest"`. */
  readonly resourceType: "MedicationRequest";
  /** Logical id of the resource. */
  readonly id?: string;
  /** `draft` while being signed (CDS Hooks `order-sign`). */
  readonly status?: string;
  /** `order` | `original-order` etc. */
  readonly intent?: string;
  /** The medication as a CodeableConcept (RxNorm / NDC codings). */
  readonly medicationCodeableConcept?: FhirCodeableConcept;
  /** The subject of the request (synthetic patient reference — NOT used in the draft). */
  readonly subject?: FhirReference;
  /** Reason / diagnosis for the order (the indication CodeableConcept). */
  readonly reasonCode?: readonly FhirCodeableConcept[];
  /** Dispense instructions (quantity + expected supply duration). */
  readonly dispenseRequest?: FhirDispenseRequest;
}

/** Any FHIR resource that can appear in an order Bundle entry. */
export type FhirResource =
  | FhirMedicationRequest
  | { readonly resourceType: string; readonly [k: string]: unknown };

/** A single entry in a FHIR `Bundle`. */
export interface FhirBundleEntry<TResource = FhirResource> {
  /** Full URL of the resource within the bundle. */
  readonly fullUrl?: string;
  /** The contained resource. */
  readonly resource?: TResource;
}

/** A minimal FHIR R4 `Bundle` (the `order-sign` draftOrders container). */
export interface FhirBundle<TResource = FhirResource> {
  /** Resource type discriminator — always `"Bundle"`. */
  readonly resourceType: "Bundle";
  /** Bundle type (e.g. `"collection"`). */
  readonly type?: string;
  /** The bundled resources. */
  readonly entry?: readonly FhirBundleEntry<TResource>[];
}

// ---------------------------------------------------------------------------
// CDS Hooks 2.0 request envelope + order-sign context
// ---------------------------------------------------------------------------

/** OAuth2 bearer details a CDS Hooks 2.0 request may carry for the FHIR server. */
export interface FhirAuthorization {
  /** The OAuth2 access token. */
  readonly access_token: string;
  /** Token type — typically `"Bearer"`. */
  readonly token_type: string;
  /** Lifetime in seconds. */
  readonly expires_in: number;
  /** Granted scopes (space-delimited). */
  readonly scope: string;
  /** The subject (client) the token was issued to. */
  readonly subject: string;
}

/**
 * A CDS Hooks 2.0 service-invocation request envelope.
 *
 * `TContext` is the hook-specific context (e.g. {@link OrderSignContext}).
 * `TPrefetch` is the optional prefetched FHIR data keyed by the service's
 * prefetch template keys.
 */
export interface CdsHooksRequest<TContext, TPrefetch = Record<string, unknown>> {
  /** The hook that triggered the call (e.g. `"order-sign"`). */
  readonly hook: string;
  /** UUID for THIS hook invocation (CDS Hooks 2.0 `hookInstance`). */
  readonly hookInstance: string;
  /** Base URL of the EHR's FHIR server (absent in v0 mock). */
  readonly fhirServer?: string;
  /** OAuth2 bearer the service may use against `fhirServer`. */
  readonly fhirAuthorization?: FhirAuthorization;
  /** Hook-specific context (required). */
  readonly context: TContext;
  /** Prefetched FHIR data keyed by prefetch-template key. */
  readonly prefetch?: TPrefetch;
}

/**
 * The CDS Hooks 2.0 `order-sign` context: the clinician is signing one or more
 * draft orders. `draftOrders` is a FHIR `Bundle` of the order resources.
 */
export interface OrderSignContext {
  /** The FHIR id of the current user, e.g. `"Practitioner/synthetic-dr-001"`. */
  readonly userId: string;
  /** The FHIR id of the patient in context (synthetic — never enters the draft). */
  readonly patientId: string;
  /** The FHIR id of the current encounter, if any. */
  readonly encounterId?: string;
  /** Bundle of the draft orders being signed (MedicationRequest resources here). */
  readonly draftOrders: FhirBundle;
}

// ---------------------------------------------------------------------------
// CDS Hooks 2.0 response (cards + system actions)
// ---------------------------------------------------------------------------

/** Where a card's guidance came from (CDS Hooks 2.0 `Card.source`). */
export interface CardSource {
  /** Human-readable label for the source. */
  readonly label: string;
  /** Link to the source's home page / reference. */
  readonly url?: string;
  /** Icon URL for the source. */
  readonly icon?: string;
  /** Coded topic of the source. */
  readonly topic?: FhirCoding;
}

/** A FHIR action a suggestion proposes (CDS Hooks 2.0 `Suggestion.actions[]`). */
export interface SuggestionAction {
  /** The kind of action. */
  readonly type: "create" | "update" | "delete";
  /** Human-readable description of the action. */
  readonly description: string;
  /** The FHIR resource to create/update (omit for delete). */
  readonly resource?: FhirResource;
  /** For delete: the id of the resource to remove. */
  readonly resourceId?: string;
}

/** A suggested set of changes the user can accept (CDS Hooks 2.0 `Suggestion`). */
export interface Suggestion {
  /** Human-readable label for the suggestion. */
  readonly label: string;
  /** UUID identifying this suggestion (for feedback). */
  readonly uuid?: string;
  /** Whether this is the recommended suggestion. */
  readonly isRecommended?: boolean;
  /** The actions that comprise the suggestion. */
  readonly actions?: readonly SuggestionAction[];
}

/** A reason a user may give for overriding a card (CDS Hooks 2.0 `overrideReasons`). */
export interface OverrideReason {
  /** A coding for the reason. */
  readonly code: string;
  /** The code system. */
  readonly system?: string;
  /** Human-readable display. */
  readonly display?: string;
}

/** A link a card surfaces (CDS Hooks 2.0 `Card.links[]`). */
export interface CardLink {
  /** Human-readable label for the link. */
  readonly label: string;
  /** The URL to navigate to (absolute). */
  readonly url: string;
  /** `absolute` or `smart`. */
  readonly type: "absolute" | "smart";
  /** Opaque token appended for SMART links. */
  readonly appContext?: string;
}

/** A CDS Hooks 2.0 `Card` — one piece of guidance returned to the EHR. */
export interface Card {
  /** UUID for the card (enables feedback). */
  readonly uuid?: string;
  /** One-sentence summary (<=140 chars per spec). */
  readonly summary: string;
  /** Optional detailed markdown. */
  readonly detail?: string;
  /** Urgency/importance of the card. */
  readonly indicator: "info" | "warning" | "critical";
  /** The source of the guidance (required). */
  readonly source: CardSource;
  /** Suggested changes the user can accept. */
  readonly suggestions?: readonly Suggestion[];
  /** How the user may choose among suggestions. */
  readonly selectionBehavior?: "at-most-one" | "any";
  /** Reasons the user may give for overriding the card. */
  readonly overrideReasons?: readonly OverrideReason[];
  /** Links the card surfaces (e.g. SMART app launch, references). */
  readonly links?: readonly CardLink[];
}

/**
 * A CDS Hooks 2.0 `SystemAction` — a change the service asks the EHR to take
 * automatically (not user-mediated like a suggestion).
 */
export interface SystemAction {
  /** The kind of change. */
  readonly type: "create" | "update" | "delete";
  /** The FHIR resource to create/update (omit for delete). */
  readonly resource?: FhirResource;
  /** For delete: the id of the resource to remove. */
  readonly resourceId?: string;
}

/** A CDS Hooks 2.0 service response: cards + optional system actions. */
export interface CdsHooksResponse {
  /** The guidance cards. */
  readonly cards: readonly Card[];
  /** System actions the service asks the EHR to apply. */
  readonly systemActions?: readonly SystemAction[];
}

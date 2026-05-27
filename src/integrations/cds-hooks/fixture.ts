/**
 * Synthetic CDS Hooks 2.0 `order-sign` fixture (SPEC-0002 R7).
 *
 * A realistic inbound EHR payload the demo uses to open the Create flow
 * prefilled. There is NO live CDS Hooks server in v0 — this local fixture stands
 * in for one. It matches the demo drug from `demo-data/sample-case.md`
 * (Adalimumab / HUMIRA, RxNorm 1366724, NDC 00074-3799-02; indication:
 * moderate-to-severe chronic plaque psoriasis).
 *
 * NO PHI: every identifier and value here is SYNTHETIC. The mirror JSON file
 * `demo-data/cds-hooks-order-sign.json` carries the same content for inspection.
 */
import type { CdsHooksRequest, OrderSignContext } from "./types.js";

/**
 * A synthetic `order-sign` request: a clinician signing a draft adalimumab order
 * for moderate-to-severe chronic plaque psoriasis. Quantity (2 prefilled pens)
 * drives the SPEC-0001 cap; the 28-day expected supply duration is necessity
 * context.
 */
export const SAMPLE_ORDER_SIGN_REQUEST: CdsHooksRequest<OrderSignContext> = {
  hook: "order-sign",
  hookInstance: "3f1a8c2e-9b7d-4e6a-8c1f-2d5b6a7c8e90",
  // No `fhirServer` / `fhirAuthorization` in v0 — wire-shape only, no live server.
  context: {
    userId: "Practitioner/synthetic-dr-001",
    patientId: "Patient/synthetic-pt-001",
    encounterId: "Encounter/synthetic-enc-001",
    draftOrders: {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          fullUrl: "urn:uuid:medreq-synthetic-001",
          resource: {
            resourceType: "MedicationRequest",
            id: "medreq-synthetic-001",
            status: "draft",
            intent: "order",
            medicationCodeableConcept: {
              coding: [
                {
                  system: "http://www.nlm.nih.gov/research/umls/rxnorm",
                  code: "1366724",
                  display:
                    "adalimumab 40 MG/0.8 ML Auto-Injector [Humira]",
                },
                {
                  system: "http://hl7.org/fhir/sid/ndc",
                  code: "00074-3799-02",
                  display: "Humira 40 mg/0.8 mL prefilled pen",
                },
              ],
              text: "Adalimumab (Humira) 40 mg/0.8 mL prefilled pen",
            },
            subject: {
              reference: "Patient/synthetic-pt-001",
              display: "Synthetic Patient (demo)",
            },
            reasonCode: [
              {
                coding: [
                  {
                    system: "http://hl7.org/fhir/sid/icd-10-cm",
                    code: "L40.0",
                    display: "Psoriasis vulgaris",
                  },
                ],
                text: "Moderate-to-severe chronic plaque psoriasis",
              },
            ],
            dispenseRequest: {
              quantity: {
                value: 2,
                unit: "pen",
                system: "http://unitsofmeasure.org",
                code: "{pen}",
              },
              expectedSupplyDuration: {
                value: 28,
                unit: "days",
                system: "http://unitsofmeasure.org",
                code: "d",
              },
            },
          },
        },
      ],
    },
  },
};

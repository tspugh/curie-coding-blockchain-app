## 2026-05-17 — @cliqueue/cda-attachments vs @cliqueue/x12-275: separate packages or unified envelope?

**Question investigated:** Should `@cliqueue/cda-attachments` be renamed `@cliqueue/claim-attachments` to encompass both the CDA document generation (C-CDA R2.1 templates) and the X12 275 envelope generation (ISA/GS/BDS wrapping) — or should these be separate packages with `@cliqueue/x12-275` importing `@cliqueue/cda-attachments`?

- **Ecosystem precedent favors separation.** No maintained 2023–2026 npm package combines X12 EDI generation with HL7 CDA document generation. The established pattern (observed across `hl7-fhir-r4-core`, `fhir-kit-client`, `node-x12`, `@stedi/edi-core`, `@medplum/ccda`) treats EDI transport and clinical document generation as independent concerns — separate repos, separate release cadences, separate semver lines. No counterexample found.

- **The standard itself mandates separation.** CMS-0053-F (finalized March 2026) adopts X12 275 (ANSI X12 006020X314) as the *transport/envelope layer* and HL7 C-CDA R2.1 as the *clinical document content layer*. These are distinct, independently versioned standards bodies (ASC X12 vs. HL7). Conflating them in one package would require coupled releases when either standard updates.

- **Correct dependency direction: X12 imports CDA, never the reverse.** CDA generates a standalone XML document; it has no knowledge of the EDI envelope. X12 275 generation accepts a generic attachment payload (bytes + content-type) and wraps it into the ISA/GS/ST/BHT/HL/BDS envelope. The correct interface is:
  ```typescript
  export interface AttachmentPayload {
    contentType: string;   // "application/xml" for CDA
    bytes: Uint8Array;
    filename?: string;
    documentId?: string;
  }
  ```
  `@cliqueue/x12-275` accepts `AttachmentPayload` and does not import `@cliqueue/cda-attachments`. `@cliqueue/cda-attachments` returns `AttachmentPayload`-compatible output. Shared types live in `@cliqueue/fhir-types` (already planned).

- **`node-x12` is the only TypeScript-capable X12 generation library** as of May 2026, but it has been in maintenance mode since 2021 (last npm publish `node-x12@2.2.2`). `@stedi/edi-core` is potentially more modern but limited to Stedi's commercial platform context. `node-x12-edi` is JavaScript-only (no `.d.ts`). This confirms the prior finding: `@cliqueue/x12-275` must hand-roll X12 275 ISA/GS/ST/BHT/HL/BDS envelope generation. `node-x12` may be usable as a devDependency for parsing validation tests but not as a runtime dependency for CMS-0053-F 006020X314 generation.

- **`ClaimsAttachmentAdapter` bridges both packages at the hospital-agent layer.** It imports `@cliqueue/cda-attachments` (to generate `AttachmentPayload`) and `@cliqueue/x12-275` (to wrap it). The adapter is not a package — it lives in the hospital-agent app layer or in a planned `@cliqueue/adapters` convenience meta-package.

- **Renaming `@cliqueue/cda-attachments` to `@cliqueue/claim-attachments` is inadvisable.** It conflates two distinct layers, creates a future merge-conflict when the CDA or X12 standards update independently, and violates the single-responsibility principle already validated by the npm ecosystem. Keep the name `@cliqueue/cda-attachments` for the XML generation layer.

**Design implication:** The `@cliqueue/*` monorepo gains a fifth package: `@cliqueue/x12-275` (envelope-only, no CDA dependency, imports `AttachmentPayload` interface from `@cliqueue/fhir-types`). `@cliqueue/cda-attachments` remains unchanged. `ClaimsAttachmentAdapter` lives in the hospital-agent app, not in either package.

**Open questions generated:**
1. Should `@cliqueue/x12-275` export a `generateUnsolicited275(claimRef: string, payload: AttachmentPayload, interchangeControl: ISAControlParams): string` function — and should `ISAControlParams` (sender/receiver ISA IDs, ISA date/time) be a required parameter or derived from hospital onboarding config?
2. Should the `AttachmentPayload` interface be defined in `@cliqueue/fhir-types` (making it a dependency of both CDA and X12 packages) or in a separate ultra-minimal `@cliqueue/attachment-types` package — and does adding it to `fhir-types` create a misleading coupling between FHIR type definitions and EDI payloads?
3. What is the minimum viable `ISAControlParams` type for the initial `@cliqueue/x12-275` MVP — and should ISA13 (interchange control number) be auto-incremented via a hospital-local counter or require explicit caller provision?

---

**See also** — [[../topics/cda|CDA hub]] · [[../topics/x12|X12 hub]]

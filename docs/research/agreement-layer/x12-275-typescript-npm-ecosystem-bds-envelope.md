# X12 275 TypeScript/Node.js Ecosystem and BDS Envelope Design

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — Does a maintained TypeScript/Node.js npm library exist for X12 275 claim attachment envelope generation — or must `@cliqueue/cda-attachments` hand-roll the X12 275 ISA/GS/BDS envelope?

**Question:** What TypeScript/Node.js npm libraries exist for generating X12 EDI 275 claim attachment transaction sets (the X12 envelope that wraps the CDA document)? Must cliqueue hand-roll the X12 275 envelope, and if so, what are the key segment structures?

### Finding 1: No maintained TypeScript-native npm library for X12 275 generation exists — confirmed fourth ecosystem gap

- **`node-x12`** (aaronhuggins/node-x12): TypeScript-100% library, last release v1.6.1 dated September 3, 2020. The README explicitly states: "This library is in maintenance mode as of 2021." No X12 275-specific support documented. The author pivoted to a next-generation `js-edi` rewrite.
  - [GitHub: aaronhuggins/node-x12](https://github.com/aaronhuggins/node-x12) — confirmed maintenance-mode
  - Assessment: High confidence. Unsuitable for new production implementations.

- **`node-x12-edi`** (mvogttech): JavaScript-only (100% JS, no TypeScript). Supports bidirectional JSON↔EDI mapping for arbitrary X12 sets (examples cite 944, 850, 810) but no X12 275-specific implementation or companion guide support. No type declarations.
  - [GitHub: mvogttech/node-x12-edi](https://github.com/mvogttech/node-x12-edi)
  - Assessment: High confidence. Usable as a low-level EDI formatter but requires hand-rolled 275 schema on top.

- **`x12-parser`** (tastypackets): Parse-only Node Transform Stream; no generation capability.
  - [GitHub: tastypackets/x12-parser](https://github.com/tastypackets/x12-parser)
  - Assessment: Parse-only; not useful for 275 generation.

- **Stedi EDI tooling**: Stedi offers a cloud EDI platform and the open-source `@stedi/prettier-plugin-edi` plus an interactive EDI guide catalog, but these are cloud/API-first tools, not an npm library for inline 275 generation in a TypeScript module.
  - [Stedi X12 275 reference](https://www.stedi.com/edi/x12/transaction-set/275)

**Conclusion:** This is the **fourth confirmed ecosystem gap** in the `@cliqueue/*` package suite (alongside `@cliqueue/cds-hooks-client`, `@cliqueue/pa-lifecycle`, and `@cliqueue/cda-attachments`). `@cliqueue/cda-attachments` must include an X12 275 envelope generator hand-rolled in TypeScript alongside the CDA document builder.

### Finding 2: BDS segment (not BIN) is the primary mechanism for embedding CDA binary data in X12 275

- The X12 275 transaction set (ASC X12N 006020X314) uses the **BDS (Binary Data Structure) segment** to carry base64-encoded binary attachments (including HL7 C-CDA R2.1 documents). The Stedi X12 275 spec page lists BDS as mandatory within the 2110 Loop for binary content.
  - [Stedi X12 275 transaction set spec](https://www.stedi.com/edi/x12/transaction-set/275)

- The BIN segment exists in the X12 275 standard but is used for binary **file format metadata** (e.g., MIME type annotation for PDF documents). For structured clinical document payloads (HL7 C-CDA), BDS is the correct segment.
  - Example from EDI Academy: `BIN*AA*application/pdf*base64~` (file-type annotation) + `BDS~` (encoded content)
  - [EDI Academy: Healthcare Claim Attachments Technical Guide](https://ediacademy.com/blog/blog/healthcare-claim-attachments-a-technical-guide/)
  - Assessment: High confidence for the BDS/BIN distinction. Verified against two independent sources (Stedi spec page, EDI Academy guide).

- The maximum allowed total BDS payload per 275 transaction: 200 MB (per web search synthesis of VA OCC and payer companion guides).

### Finding 3: X12 275 key segment structure for CDA attachments

The required segment sequence for an unsolicited CDA attachment submission (X12 release 005010X210 or 006020X314):

```
ISA*00* ... *00600~                       Interchange Control Header
GS*HI* ... *006020X314~                  Functional Group Header  
ST*275*0001*005010X210~                  Transaction Set Header (or 006020X314)
BHT*0001*11* ... ~                       Beginning of Hierarchical Transaction
HL*1**20*1~                              Provider HL level (20 = Information Receiver)
NM1*85* ...                              Provider/Submitter name loop
HL*2*1*41*1~                             Payer HL level (41 = Loop Repeating)
NM1*PR* ...                              Payer name loop
HL*3*2*EJ*0~                             Patient HL level (EJ = Patient, 0 = no subordinate)
NM1*QC* ...                              Patient name loop
REF*1K* ...                              Claim reference (links to original 837 CLM01)
DTP* ...                                 Date of service
OOI*AB* ...                              Associated Object Type Identification
BDS* ...                                 Binary Data Structure (base64-encoded CDA)
SE*nn*0001~                              Transaction Set Trailer
GE*1* ...                                Functional Group Trailer
IEA*1* ...                               Interchange Control Trailer
```

- The `REF*1K` segment in the patient HL loop is critical: it carries the original claim reference number (CLM01 from the 837) that links the 275 attachment to the specific claim. This is the on-chain `claimId` correlation point.
  - [EDI Academy 275 guide](https://ediacademy.com/blog/blog/healthcare-claim-attachments-a-technical-guide/)
  - Assessment: High confidence on REF*1K as the CLM01 correlation mechanism.

### Finding 4: Two X12 275 versions are currently accepted — 5010 and 6020

- **005010X210** (X12 Release 5010): The original HIPAA-mandated version. Still widely accepted.
- **006020X314** (X12 Release 6020): Newer release; NGS Medicare updated their companion guide to 6020 in June 2025. BCBS Kansas accepts both 5010 and 6020 (unsolicited, effective May 2025). This is the target version for CMS-0053-F compliance (May 2028 deadline).
  - [BCBS Kansas X12 275 announcement (May 2025)](https://www.bcbsks.com/latest-news/unsolicited-electronic-claim-attachment-functionality-x12-275)
  - Assessment: Medium confidence on CMS-0053-F targeting 6020 specifically; the rule mandates X12 275 but companion guides may permit both during transition.

### Finding 5: 277CA is the payer attachment request format — `ClaimsAttachmentAdapter` needs both a 275 generator AND a 277CA parser

- When payers issue **solicited** attachment requests (triggered by a 277 claim status transaction), the format is the **277CA (Claims Acknowledgment)** or a 277C variant. The provider must match the 277CA's attachment control number to the correct claim and respond with a 275.
  - The EDI Academy guide confirms: "If a payer sends a request for additional info (e.g., via 277), the same 275 transaction can be used to respond."
  - [EDI Academy guide](https://ediacademy.com/blog/blog/healthcare-claim-attachments-a-technical-guide/)
  - Assessment: High confidence on the 277→275 solicited flow; 277CA parsing is a separate implementation requirement from 275 generation.

- **CMS-0053-F scope:** Covers both unsolicited 275 (provider proactively sends) and solicited 275 (provider responds to 277 request). Both paths are required for full CMS-0053-F compliance by May 2028.

**Design implication:** `@cliqueue/cda-attachments` scope must expand beyond CDA document generation to include an X12 275 envelope generator (TypeScript, hand-rolled, no suitable npm library). Additionally, `ClaimsAttachmentAdapter` (the sub-interface of `PayerAdapterInterface`) requires two distinct implementations: (1) a 275 generator wrapping the CDA payload in the correct ISA/GS/ST/BHT/HL/BDS envelope, and (2) a 277CA parser that reads solicited payer attachment requests and extracts the claim reference + attachment control number for correlation. This is a more substantial implementation than previously scoped — equivalent to the CDA generation work itself.

**Open questions generated:**
1. Should `@cliqueue/cda-attachments` be renamed `@cliqueue/claim-attachments` to encompass both the CDA document generation (C-CDA R2.1 templates) and the X12 275 envelope generation (ISA/GS/BDS wrapping) — or should these be separate packages with `@cliqueue/x12-275` importing `@cliqueue/cda-attachments`? — added 2026-05-17, priority: high
2. Should `ClaimsAttachmentAdapter` define a `generateUnsolicited275(claimRef: string, cdaDocument: Buffer): string` method and a `parseSolicited277CA(ediText: string): AttachmentRequest` method as the two required interface methods — encoding the full unsolicited + solicited lifecycle? — added 2026-05-17, priority: high
3. Should `@cliqueue/x12-275` (or the 275 sub-module of `@cliqueue/claim-attachments`) support dual-version output (005010X210 and 006020X314) via a `version` parameter — or target only 6020 for MVP, accepting that some payers still on 5010 require a configuration toggle? — added 2026-05-17, priority: medium
4. Is there a payer adoption threshold (what % of US claim volume is covered by payers currently accepting X12 275 electronically as of May 2026) — and should cliqueue's MVP deployment guide restrict the `ClaimsAttachmentAdapter` to payers with published companion guides, deferring custom companion guide support to Phase 2? — added 2026-05-17, priority: medium

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/cda|CDA hub]]

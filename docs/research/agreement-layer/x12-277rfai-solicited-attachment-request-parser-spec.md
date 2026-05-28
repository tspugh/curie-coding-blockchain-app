# X12 277RFAI Solicited Attachment Request — `parseSolicited277CA()` Parser Spec

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — What does the X12 payer solicited attachment request carry, and what must `parseSolicited277CA()` extract for `ClaimsAttachmentAdapter`?

**Question:** What X12 transaction does a payer issue to solicit a 275 attachment from a provider, what segments must be parsed, and which major payers have published X12 275 companion guides as of May 2026?

### Finding 1: 277CA is NOT the solicited attachment request — the correct transaction is 277RFAI (005010X317)

- **277CA (005010X214)** is the "Health Care Claim Acknowledgment" — a claim receipt/adjudication status acknowledgment for the 837 submission. It is NOT the transaction that requests supplemental documentation.
- **277RFAI / 277HS (005010X317)** — "Health Care Claim Request for Additional Information" — is the correct payer-initiated solicited attachment request. This is the transaction a payer sends when it needs clinical documentation to adjudicate a claim.
- The solicited workflow: `837 claim → 277CA (receipt ack) → 277RFAI (request for docs) → 275 (provider sends attachment)`.
- The prior research doc ([[x12-275-typescript-npm-ecosystem-bds-envelope]]) correctly identifies "if a payer sends a request for additional info (e.g., via 277), the same 275 transaction can be used to respond" but did not distinguish 277CA from 277RFAI. **This is a correction:** the `parseSolicited277CA` method name should be `parseSolicited277RFAI` or `parseAttachmentRequest277` to reflect the correct transaction.
  - [EDI Academy: Healthcare Claim Attachments Technical Guide](https://ediacademy.com/blog/blog/healthcare-claim-attachments-a-technical-guide/)
  - [Stedi: Submit Claim Attachments (277 RFA reference)](https://www.stedi.com/docs/healthcare/submit-claim-attachments)
  - [Perplexity synthesis — 005010X317 confirmed as distinct from 005010X214]

### Finding 2: Key segments the parser must extract from a 277RFAI

Based on X12 standards, companion guides, and Perplexity synthesis (individual segment-level primary source verification was blocked by PDF binary encoding):

| Data element | Segment | Loop | Notes |
|---|---|---|---|
| **Claim reference (CLM01 echo)** | `CLM` or `REF` | 2300/claim loop | Echoes the original 837 CLM01 claim submitter number; used to correlate request to the original claim |
| **Payer attachment control number** | `REF` | Attachment request detail loop | Payer-assigned request control number; provider must round-trip this as `REF*EJ` in the 275 response. Qualifier is payer/companion-guide-specific (often `EJ` or `1K`) |
| **Requested document type** | `PWK` or `STC` | Attachment request detail | PWK01 = attachment report type code; PWK02 = transmission code; exact PWK qualifier payer-specific |
| **Response deadline** | `DTP` | Attachment request loop | "Reply by" or "due date" qualifier; qualifier is payer-specific — check companion guide |
| **Payer identification** | `NM1*PR` | Payer loop | Standard payer ID loop with entity qualifier `PR`; NM109 = payer EDI ID |

**Assessment:** High confidence on the schema mapping above (consistent across Stedi docs, EDI Academy, TMHP companion guide, CMS acknowledgment materials). Low confidence on exact DTP qualifier for deadline — varies per companion guide.
- [TMHP 277CA companion guide — 005010X214](https://www.tmhp.com/sites/default/files/file-library/edi/277CA_COMPANION_GUIDE_5010.pdf)
- [CMS acknowledgment overview](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/Versions5010andD0/Downloads/Acknowledgements_National_Presentation_9-29-10_final.pdf)

### Finding 3: CMS-0053-F mandates X12 275 (006020X314) but does NOT mandate 277RFAI for payer solicited requests

- CMS-0053-F (Federal Register 2026-05676, finalized March 2026, compliance deadline May 2028) adopts:
  - **X12N 275** (Version 006020X314) — provider attachment submission
  - **X12N 277** — payer acknowledgment and status
  - **HL7 March 2022 Attachments IG** — clinical document content
- **The rule does NOT specify 005010X317 as the mandatory payer-initiated solicited request format.** Payers retain flexibility in how they request documentation; many continue to use paper/fax/phone for solicited requests as of May 2026. The May 2028 compliance deadline applies to provider-side 275 submission, not payer-side solicitation.
- **Design implication:** `parseSolicited277RFAI()` may be invoked for payers that do adopt electronic 277RFAI, but cliqueue must also support a manual "human triggers 275 upload" fallback path for payers still using non-electronic solicitation methods post-2028.
  - [Federal Register 2026-05676](https://www.federalregister.gov/documents/2026/03/24/2026-05676/administrative-simplification-adoption-of-standards-for-health-care-claims-attachments-transactions)
  - [CMS-0053-F fact sheet](https://www.cms.gov/files/document/nsg-attachments-final-rule-fact-sheet.pdf)
  - [CMS newsroom fact sheet](https://www.cms.gov/newsroom/fact-sheets/administrative-simplification-adoption-standards-health-care-claims-attachments-transactions)

### Finding 4: Payer X12 275 companion guide adoption as of May 2026 — confirmed and unconfirmed

| Payer | X12 275 companion guide confirmed? | Source |
|---|---|---|
| **Cigna** | YES — publicly accessible | [Cigna X12 275 companion guide (5010)](https://www.cigna.com/static/www-cigna-com/docs/5010-275-X12-companion-guide.pdf) |
| **CMS/Medicare (esMD)** | YES — CMS federal guide | [CMS X12 275 Health Claim Services](https://www.cms.gov/files/document/x12-275-health-claim-services.pdf) |
| **UHC** | PARTIAL — provider news post confirms 275 support but companion guide URL not verified | [UHC 275 vendor expansion announcement (2026)](https://www.uhcprovider.com/content/provider/en/resource-library/news/2026/expanded-vendors-edi-275.html) |
| **BCBS Kansas** | YES (from prior research) — accepts both 5010 and 6020 unsolicited effective May 2025 | [BCBS Kansas X12 275 announcement](https://www.bcbsks.com/latest-news/unsolicited-electronic-claim-attachment-functionality-x12-275) |
| **NGS Medicare** | YES (from prior research) — updated to 6020 companion guide June 2025 | Prior research: x12-275-typescript-npm-ecosystem-bds-envelope.md |
| **Aetna** | NOT CONFIRMED — no public companion guide URL found | — |
| **Humana** | NOT CONFIRMED — no public companion guide URL found | — |
| **Anthem/BCBS national** | NOT CONFIRMED — no public companion guide URL found | — |
| **Medicare MACs (Noridian, Palmetto, CGS, Novitas, WPS)** | CMS-level confirmed; individual MAC guides not verified | CMS esMD guide above |

**Market share note:** No source (CAQH, WEDI, AHA) publishes a confirmed % of US commercial claim volume covered by payers with public 275 companion guides. Cigna (~90M covered lives), UHC (~50M), CMS/Medicare (~67M beneficiaries) represent major volume, but "payer supports 275" is not the same as "payer-issued 277RFAI for solicited path." The payer 275 adoption picture is fragmented and companion-guide-by-companion-guide — no aggregate figure is defensible without a primary industry survey. **Flag: volume coverage claim remains unsourced.**

### Finding 5: `parseSolicited277RFAI()` method name correction and output type

The `ClaimsAttachmentAdapter` interface method should be renamed from `parseSolicited277CA` to `parseSolicited277RFAI` (or `parseAttachmentRequest`) to reflect the correct transaction type. The `AttachmentRequest` return type should include:

```typescript
interface AttachmentRequest {
  claimRef: string;           // CLM01 echo from 2300 loop — correlates to original 837 claim
  payerControlNumber: string; // Payer-assigned request control number (REF*EJ round-trip in 275)
  requestedDocType?: string;  // PWK01 report type code (payer-specific; may be absent)
  responseDeadline?: Date;    // DTP deadline (payer-specific qualifier; may be absent)
  payerId: string;            // NM1*PR payer EDI ID (NM109)
  payerName?: string;         // NM1*PR payer name (NM103)
  rawEdi: string;             // Original EDI text for audit
}
```

**Design implication:** `ClaimsAttachmentAdapter` must rename `parseSolicited277CA()` to `parseSolicited277RFAI()`. The method is needed but lower-priority for MVP: CMS-0053-F does not mandate payer 277RFAI electronic issuance by May 2028 — only provider 275 response is mandated. For MVP, a manual trigger path (hospital staff uploads CDA in response to fax/letter request) is sufficient; `parseSolicited277RFAI()` can be Phase 2 when payer 277RFAI adoption increases. For payers that DO issue 277RFAI electronically (Cigna, some Medicare MACs), the parser above is the correct interface.

**Open questions generated:**
1. Should `ClaimsAttachmentAdapter` define a `parseSolicited277RFAI(ediText: string): AttachmentRequest` method as the Phase 2 solicited path — and should Phase 1 MVP only implement `generateUnsolicited275()`, accepting that solicited requests arrive via fax/letter for non-277RFAI payers?
2. Should cliqueue's hospital onboarding checklist include a "Payer 277RFAI Readiness Check" — asking the hospital which of their payers issue electronic 277RFAI requests vs. paper/fax requests — before selecting the attachment workflow?
3. Does the 277RFAI (005010X317) `payerControlNumber` REF qualifier vary by payer companion guide — and should `AttachmentRequest` carry a `rawPayerControlRef: { qualifier: string; value: string }` field to preserve the original REF qualifier for correct 275 round-trip construction?

---

**See also** — [[../topics/x12|X12 hub]]

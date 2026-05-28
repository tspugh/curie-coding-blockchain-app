# CliQueue Research Log

This is the running audit trail for all research loop iterations.
Each entry records what was investigated, what was found, and what to explore next.
Entries are append-only — newest at the top.

---

## 2026-05-17 — Reverse proxy / mTLS patterns for MCP server authentication without URL-embedded API keys — nginx credential injection is the viable pattern for `inferToolsChat`; mTLS only applicable on nginx→Corti upstream leg; URL path segment (128-bit random) is the only available Somnia→nginx authenticator; URL-as-secret must be treated as rotatable credential

**Question investigated:** Is there a reverse proxy or mTLS pattern for securing MCP server access without URL-embedded API keys — and does any such pattern work within Somnia's `inferToolsChat` `mcpServerUrls` constraint (URL-only, no headers)?

**Key findings:**
- **Nginx credential injection is the confirmed viable pattern.** Nginx accepts unauthenticated inbound calls from `inferToolsChat` (no API key in the URL) and independently injects the Corti Symphony API key outbound via `proxy_set_header Authorization "Bearer <key>"`. Key lives in nginx server config — never in the `mcpServerUrls` array, never in Somnia calldata. This is the canonical "API key protection on the front-end" pattern. ([Jeremy Poole — Protecting API Keys via NGINX](https://jeremypoole.ca/posts/protecting_api_keys_on_the_front_end/); [fast.io — MCP Server Proxy Setup](https://fast.io/resources/mcp-server-proxy/))
- **mTLS between nginx and Corti Symphony eliminates API keys entirely on the nginx→Corti leg.** Nginx supports `proxy_ssl_certificate` / `proxy_ssl_certificate_key` directives that present a client certificate to the upstream MCP server — no API keys. Fully supported in NGINX upstream TLS config. ([NGINX — Securing HTTP Traffic to Upstream Servers](https://docs.nginx.com/nginx/admin-guide/security-controls/securing-http-traffic-upstream/))
- **mTLS cannot authenticate the Somnia→nginx inbound leg.** mTLS requires the *client* to present a TLS certificate. Somnia `inferToolsChat` can only pass a URL string — it cannot present a client cert. The inbound Somnia→nginx leg is fundamentally header-free and cert-free. ([DEV Community — MCP Authentication: OAuth vs API Keys vs Mutual TLS](https://dev.to/whoffagents/mcp-server-authentication-oauth-vs-api-keys-vs-mutual-tls-which-to-use-and-when-4nj3))
- **OAuth 2.1, Bearer tokens, and APIM subscription keys all require client-side header injection — not available in `inferToolsChat`.** Azure APIM's "secure inbound access" pattern requires `Ocp-Apim-Subscription-Key` header; MCP spec OAuth requires `Authorization: Bearer` header; FastMCP OAuth proxy requires redirect flow. All assume the MCP client can set HTTP headers. Somnia `inferToolsChat` cannot. ([Microsoft Learn — Secure access to MCP servers in Azure API Management](https://learn.microsoft.com/en-us/azure/api-management/secure-mcp-servers); [FastMCP — Authentication](https://gofastmcp.com/servers/auth/authentication))
- **CONFIRMED: URL path segment (128-bit random) is the only available inbound authenticator for Somnia→nginx.** The hospital deploys nginx at `https://<fqdn>/<128-bit-random>/mcp`. The random path segment functions as the inbound credential — must be treated as rotatable secret (never logged on-chain, never committed to public repos, rotated periodically). The `mcpServerUrls` parameter is a transaction parameter (not a storage slot), so rotating the path requires only updating the off-chain agent configuration, not a contract upgrade.
- **Static egress IP is a partial mitigation but does not solve inbound authentication.** Services like QuotaGuard Shield provide static outbound IPs from hospital infrastructure — relevant for hospital→external calls, not for Somnia validators calling into the hospital proxy. The Somnia validator egress IP allowlist problem (no static Somnia IPs confirmed in prior iteration) remains unresolved; the nginx-with-random-path pattern sidesteps IP allowlisting by using URL-as-secret instead. ([QuotaGuard — MCP Server Static Egress IP](https://www.quotaguard.com/blog/mcp-server-static-egress-ip))

**Design implication:** cliqueue's off-chain agent spec must document the hospital nginx proxy as a normative component: (A) nginx deployed with 128-bit random path segment as sole inbound authenticator, (B) nginx injects Corti API key outbound (`proxy_set_header`) or uses mTLS on the nginx→Corti leg (preferred — eliminates long-lived API key), (C) the random path segment is a rotatable credential managed in the hospital's secret management system, (D) the hospital BAA Off-Chain Infrastructure Exhibit must list nginx proxy as a named component. The `mcpServerUrls` array in `inferToolsChat` is confirmed URL-as-secret — this is the only mechanism compatible with Somnia's no-header constraint.

**Findings file:** [docs/research/somnia/mcp-reverse-proxy-auth-without-url-key.md](somnia/mcp-reverse-proxy-auth-without-url-key.md)

**Next priority questions:**
1. Should cliqueue's hospital onboarding package include a reference nginx configuration (with 128-bit random path + `proxy_set_header Authorization "Bearer ${CORTI_API_KEY}"`) as a normative deployment artifact?
2. Should the `mcpServerUrls` path segment be derived from the hospital's `hospitalId` bytes32 using HKDF — enabling deterministic, auditable URL rotation?
3. Should the hospital BAA's Off-Chain Infrastructure Exhibit require annual rotation of the `mcpServerUrls` path segment, treating it as a long-lived credential?

---

## 2026-05-17 — `inferToolsChat` `mcpServerUrls` network requirements: no explicit public-only requirement but no authentication header mechanism; Corti Symphony must NOT route through `inferToolsChat`; de-identified ICD-10 codes through validators are HIPAA/GDPR-neutral; orchestrator-vs-validator MCP call origin unconfirmed

**Question investigated:** Does Somnia's `inferToolsChat` `mcpServerUrls` parameter allow specifying a hospital-local (non-public) MCP endpoint, or does it require a publicly reachable URL — and if public-only, does transmitting de-identified code arrays through validator nodes create GDPR or HIPAA data-residency issues?

**Key findings:**
- **No explicit public-only requirement in Somnia docs**, but "reachable" is the operative word — validators are globally distributed (Frankfurt, NY, Singapore) with no published static egress IPs, making hospital-local private endpoints unreachable in practice without VPN/tunnel (undocumented). Official example URL is `http://weather-service:80/` — a Docker Compose private hostname, implying co-deployment with agent infrastructure, not over public internet. ([Somnia LLM Inference Docs](https://docs.somnia.network/agents/base-agents/llm-inference))
- **No MCP authentication header parameter exists in `inferToolsChat`.** The function signature accepts only `mcpServerUrls string[]` — no auth token, no header injection. Passing a Corti Symphony API key requires URL-embedding (e.g., `?apiKey=...`), which exposes the key as public on-chain calldata — a confirmed security gap. ([Somnia LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference))
- **Confirmed security requirement: Corti Symphony calls must NOT route through `inferToolsChat`.** Hospital agent must call Symphony off-chain before `submitClaim()`. `inferToolsChat` should be used only for Somnia native LLM second-opinion review with de-identified code arrays — no API key, no PHI in message payload.
- **De-identified ICD-10 code arrays passing through validator/orchestrator nodes are HIPAA-neutral.** ICD-10 codes without patient identifiers are not PHI under §164.514(b). Transmission through non-US validator nodes does not trigger HIPAA data-residency concerns. ([HIPAA University: Blockchain in Healthcare](https://hipaauniversity.com/blog/blockchain-in-healthcare/))
- **GDPR Art. 9 applies only if clinical notes enter `inferToolsChat` message payload — they must not.** PHI-never-on-chain principle extends to `inferToolsChat` message content. De-identified code arrays are not "special category" data under GDPR Art. 4(1). (WEAK — no GDPR enforcement authority has specifically addressed de-identified medical codes through blockchain validator networks.)
- **Orchestrator-vs-validator MCP call origin is architecturally critical but undocumented.** If Somnia's agent platform (not each individual validator) makes the MCP HTTP call, a single public egress IP may be obtainable for allowlisting. If each validator independently calls, distributed IPs make allowlisting impossible. Requires direct confirmation from Somnia DevRel. (WEAK — no primary source.)

**Design implication:** cliqueue's off-chain agent spec must explicitly document that `inferToolsChat` `mcpServerUrls` is reserved for de-identified second-opinion review via Somnia native LLM only — Corti Symphony API calls are always hospital-agent-side, never on-chain via inferToolsChat. This was implied by the pre-computation pattern but is now a confirmed security requirement.

**Findings file:** [docs/research/somnia/infer-tools-chat-mcp-endpoint-network-requirements.md](somnia/infer-tools-chat-mcp-endpoint-network-requirements.md)

**Next priority questions:**
1. Does the Somnia agent orchestrator (not validators) make MCP HTTP calls — can cliqueue obtain a static egress IP to allowlist at a hospital-side MCP gateway?
2. Is there a reverse proxy / mTLS pattern for securing MCP server access without URL-embedded API keys?
3. What is the practical ICD-10 accuracy of Somnia's native LLM (without Symphony) for second-opinion review?

---

## 2026-05-17 — Off-chain pub-sub / messaging for PHI-bearing payloads: AWS SQS FIFO recommended for MVP; NATS JetStream for low-latency production; `claimId` as `DocumentReference.identifier` (not FHIR resource ID); FHIR Bundle "claim package" pattern; PHI-never-on-chain fully preserved

**Question investigated:** What off-chain pub-sub / messaging patterns should cliqueue use to carry PHI-bearing clinical documents (C-CDA, FHIR) from hospital systems to the Corti Symphony coding engine — paired with Somnia `ClaimSubmitted` events — while satisfying HIPAA encryption requirements and achieving sub-5-second delivery?

**Key findings:**
- **No canonical standard exists for EVM-event-triggered PHI delivery.** The architectural pattern (on-chain hash/pointer + off-chain PHI payload via pub-sub) is universally adopted in healthcare blockchain literature but the broker choice is implementation-specific. No HL7/ONC/Somnia standard mandates a specific broker. ([hOCBS framework](http://www.ghpolicy.org/resources/Publications-2021/hOCBS--A-Privacy-Preserving-Blockchain-Framework-for-Healthcare-Data-Leveraging-an-On-chain-and-Off-chain-System-Design.pdf); [PMC11082361](https://pmc.ncbi.nlm.nih.gov/articles/PMC11082361/))
- **AWS SQS FIFO + KMS-encrypted S3 is the recommended MVP choice.** AWS BAA covers SQS; SQS messages carry only `claimIdHash` + S3 doc pointer (non-PHI), not the clinical note bytes. C-CDA payload lives in KMS-encrypted S3. Sub-5-second end-to-end delivery is achievable (SQS ~200ms + S3 fetch ~300ms + Corti ~2–4s). ([HIPAA encryption overview](https://www.konfirmity.com/blog/hipaa-encryption-at-rest-and-in-transit-for-hipaa))
- **NATS JetStream has no vendor BAA** — must run on BAA-covered infra (e.g., AWS EKS); requires TLS 1.2+ (§164.312(e)(2)(ii)), filesystem encryption at rest (§164.312(a)(2)(iv)), least-privilege subject-level access control (§164.312(a)(1)), and audit logging (§164.312(b)). Acceptable alternative for hospitals running their own HIPAA-compliant Kubernetes infra.
- **Correct correlation pattern: `claimId` as `DocumentReference.identifier`, not as FHIR resource ID.** Ethereum `bytes32` is not URL-safe and must not be used as `DocumentReference.id`. Store `claimId` as a business identifier: `{ system: "https://cliqueue.io/ethereum/claimId", value: "0x..." }` in `DocumentReference.identifier`. ([FHIR DocumentReference](https://hl7.org/fhir/documentreference.html))
- **The "claim package" envelope pattern is de facto industry practice, not an HL7 standard.** Vendors (Change Healthcare, Waystar, Availity) use an internal GUID (`claimPackageId`) to correlate 837 EDI + CDA document + AI metadata. The closest FHIR-standard construct is a **FHIR Bundle** with entries for `Binary` (837), `DocumentReference` (CDA), and `Parameters` (AI metadata); `Bundle.identifier` carries the GUID. The `claimPackageId` GUID and the on-chain `claimId` `bytes32` are distinct and linked via `DocumentReference.identifier`. ([FHIR Bundle](https://hl7.org/fhir/bundle.html))
- **PHI-never-on-chain is fully preserved.** On-chain: only `claimId`, `claimHash`, `paStatus`, `paAuthHash`. Off-chain data flow: EMR → S3 (KMS-encrypted) → coding worker (TLS) → Corti Symphony (BAA-covered). `DocumentReference.identifier` mapping lives only in hospital-local PostgreSQL — compromise of the map does not expose PHI.

**Design implication:** cliqueue's hospital onboarding checklist must specify three normative off-chain infrastructure prerequisites: (A) KMS-encrypted S3 bucket (hospital-operated, BAA-covered AWS), (B) SQS FIFO queue (hospital-operated, BAA-covered AWS) carrying only `claimIdHash` + doc pointer, (C) hospital-local PostgreSQL for `claimId → documentReference` mapping. The claim processing event-driven flow is: `ClaimSubmitted` Somnia event → SQS publish → S3 fetch → Corti Symphony call → `adjudicateClaim()` on-chain.

**Findings file:** [docs/research/somnia/offchain-pubsub-phi-messaging-architecture.md](somnia/offchain-pubsub-phi-messaging-architecture.md)

**Next priority questions:**
1. Should the hospital BAA's "Off-Chain Messaging Exhibit" specify the minimum AWS SQS FIFO configuration (KMS key type, message retention window, DLQ settings) as normative deployment prerequisites?
2. Should cliqueue publish a reference `claimId → documentReference` mapping schema (PostgreSQL DDL) as part of the hospital onboarding package?
3. Should the FHIR Bundle "claim package" envelope be published as a `ClaimPackageBundle` TypeScript type in `@cliqueue/fhir-types`?

---

## 2026-05-17 — No payer companion guide publishes adjudication-to-payment cycle time for electronic 275 vs. paper/fax; correct ROI is documentation-pending window compression (60–120 days → 5–7 days), not adjudication speed post-receipt

**Question investigated:** Does any payer companion guide (UHC, Aetna, Cigna, Humana) publish the adjudication-to-payment cycle time specifically for claims with electronic 275 attachments vs. paper/fax — enabling cliqueue to cite a full end-to-end comparison rather than the 5–7 day administrative matching window alone?

**Key findings:**
- **No payer companion guide, vendor, or regulator publishes a days-to-payment benchmark isolating the electronic 275 variable.** Confirmed absent across UHC, Anthem, Cigna, Aetna, Humana guides; Waystar, Availity, Optum vendor materials; CAQH 2023/2024 Index Reports; HFMA denial metrics guidance; CMS-0053-F regulatory impact analysis. ([Waystar claim attachments](https://www.waystar.com/our-platform/claim-management/claim-attachments/))
- **The regulatory framework explains the absence.** Medicare FFS: "other-than-clean" claim 45-day adjudication clock is paused when the contractor sends a documentation development letter and resumes only when documentation is received — identically for electronic vs. paper receipt. Commercial payers under state prompt pay laws (Arizona, Texas, others) have equivalent clock-pause provisions. Electronic 275 reduces the duration of the clock pause (minutes vs. 60–120 days of mail/fax transit), not the adjudication time after receipt. ([HHS other-than-clean claims timeliness](https://www.hhs.gov/guidance/document/timeliness-standards-processing-other-clean-claims-1); [Texas TDI prompt pay FAQ](https://www.tdi.texas.gov/hprovider/ppsb418faq.html); [Arizona 20-3102](https://www.azleg.gov/ars/20/03102.htm))
- **CMS-0053-F $781.98M savings is labor-cost reduction, not cycle time.** The regulatory impact analysis quantifies savings as eliminating $22/transaction manual processing cost (8 minutes per transaction, CAQH CORE estimate) — not any reduction in days-to-payment. ([CMS-0053-F fact sheet](https://www.cms.gov/newsroom/fact-sheets/administrative-simplification-adoption-standards-health-care-claims-attachments-transactions); [Thessigroup CAQH data](https://thessigroup.com/blog/advancing-275-electronic-attachments-in-medical-billing-a-move-towards-efficiency/))
- **Waystar "reduces AR days" claim is unquantified vendor marketing** — no published day count.
- **The complete sourced ROI chain:** (A) Documentation-pending window: 60–120 days paper/fax (Kodiak/FAH, primary source) → 5–7 day electronic 275 matching window (UHC/Anthem companion guides) — 10–20× compression, fully sourced. (B) Post-receipt adjudication period: 14–45 days (Medicare FFS, payer-contract dependent), identical for electronic vs. paper once documentation received — not a cliqueue differentiator.

**Design implication:** cliqueue's ROI calculator must present attachment value as two explicitly separated components: "documentation-pending window compression (60–120 → 5–7 days)" as the primary ROI claim, and "post-receipt adjudication period (14–45 days, payer-contract dependent, NOT reduced by electronic 275)" as a disclosed caveat. Overstating that electronic 275 also accelerates adjudication after receipt has no primary-source support and must be avoided in all hospital onboarding materials.

**Findings file:** [docs/research/market/electronic-275-adjudication-to-payment-cycle-time.md](market/electronic-275-adjudication-to-payment-cycle-time.md)

**Next priority questions:**
1. Should cliqueue's hospital onboarding ROI calculator explicitly label the two-component structure — so hospital finance teams understand that electronic 275 eliminates the documentation-pending float (60–120 days), not the adjudication speed post-receipt?
2. Is there a private payer that publishes a specific adjudication SLA for claims submitted with a proactive unsolicited 275 (before any 277 RFI is issued) — enabling cliqueue to cite a post-receipt adjudication advantage for proactive unsolicited submission?
3. At what AR days threshold does cliqueue's value proposition create a measurable DSO improvement that hospital CFOs can calculate from their own benchmarks without relying on published national figures?

---

## 2026-05-17 — X12 277RFAI (005010X317) is the correct solicited attachment request transaction — NOT 277CA; `parseSolicited277CA()` method name corrected to `parseSolicited277RFAI()`; CMS-0053-F does not mandate payer-side electronic solicitation; `AttachmentRequest` output type fully specified; payer 275 guide adoption confirmed for Cigna, CMS/Medicare, BCBS KS, NGS Medicare

**Question investigated:** What does the X12 payer solicited attachment request carry, what must `parseSolicited277CA()` extract from it, and which major payers have published X12 275 companion guides as of May 2026?

**Key findings:**
- **`parseSolicited277CA()` is using the wrong transaction name.** 277CA (005010X214) is the "Health Care Claim Acknowledgment" — it acknowledges 837 receipt/status, not solicited documentation requests. The actual solicited attachment request is the **277RFAI / 277HS (005010X317)** "Health Care Claim Request for Additional Information." The `ClaimsAttachmentAdapter` method must be renamed to `parseSolicited277RFAI()`. ([EDI Academy](https://ediacademy.com/blog/blog/healthcare-claim-attachments-a-technical-guide/); [Stedi claim attachments docs](https://www.stedi.com/docs/healthcare/submit-claim-attachments))
- **277RFAI key segments confirmed:** (1) Original claim reference echoed via `CLM01` or `REF` in the claim loop; (2) Payer attachment control number in a `REF` segment (qualifier payer-specific — provider round-trips as `REF*EJ` in the 275 response); (3) Requested document type via `PWK` (PWK01 = report type code); (4) Response deadline in `DTP` segment (qualifier payer-specific); (5) Payer ID in `NM1*PR` loop (NM109 = payer EDI ID). ([TMHP 277CA companion guide](https://www.tmhp.com/sites/default/files/file-library/edi/277CA_COMPANION_GUIDE_5010.pdf); [CMS acknowledgment overview](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/Versions5010andD0/Downloads/Acknowledgements_National_Presentation_9-29-10_final.pdf))
- **CMS-0053-F does NOT mandate payer-side 277RFAI electronic issuance.** The rule (Federal Register 2026-05676, compliance deadline May 2028) mandates provider-side X12 275 (006020X314) submission and adopts X12N 277 for acknowledgments — but does NOT require payers to issue electronic 277RFAI requests. Payers may continue paper/fax/phone solicitation post-2028. ([Federal Register](https://www.federalregister.gov/documents/2026/03/24/2026-05676/administrative-simplification-adoption-of-standards-for-health-care-claims-attachments-transactions); [CMS fact sheet](https://www.cms.gov/files/document/nsg-attachments-final-rule-fact-sheet.pdf))
- **`parseSolicited277RFAI()` is Phase 2, not MVP.** Because CMS-0053-F does not mandate payer-side electronic solicitation, a fax/letter fallback (hospital staff manually triggers a 275 upload) is acceptable for MVP. Phase 1 scope: `generateUnsolicited275()` only. Phase 2 adds `parseSolicited277RFAI()` for payers that do adopt electronic 277RFAI.
- **`AttachmentRequest` output type specified:** `{ claimRef: string; payerControlNumber: string; requestedDocType?: string; responseDeadline?: Date; payerId: string; payerName?: string; rawEdi: string }`. The `payerControlNumber` REF qualifier varies by companion guide — a `rawPayerControlRef: { qualifier, value }` field is advisable to preserve the original qualifier for correct 275 round-trip.
- **Payer X12 275 companion guide adoption (May 2026):** Confirmed: Cigna ([companion guide](https://www.cigna.com/static/www-cigna-com/docs/5010-275-X12-companion-guide.pdf)), CMS/Medicare esMD ([guide](https://www.cms.gov/files/document/x12-275-health-claim-services.pdf)), BCBS Kansas (May 2025, from prior research), NGS Medicare (6020, June 2025, from prior research). Unconfirmed companion guide (but 275 support confirmed): UHC ([provider news](https://www.uhcprovider.com/content/provider/en/resource-library/news/2026/expanded-vendors-edi-275.html)). Not confirmed: Aetna, Humana, Anthem/BCBS national.
- **No source quantifies % of US claim volume covered by payers with published 275 guides.** CAQH/WEDI/AHA publish no such aggregate. Volume coverage claim remains unsourced.

**Design implication:** Two corrections required in the `ClaimsAttachmentAdapter` spec: (1) Rename `parseSolicited277CA()` to `parseSolicited277RFAI()` — wrong transaction; (2) Descope `parseSolicited277RFAI()` from Phase 1 MVP — CMS-0053-F does not mandate payer electronic solicitation, so a manual trigger fallback is sufficient for launch. Phase 1 `ClaimsAttachmentAdapter` needs only `generateUnsolicited275()`. The `AttachmentRequest` type spec above should be published as a forward-compatibility interface in `@cliqueue/x12-275` even if the method is Phase 2.

**Findings file:** [docs/research/agreement-layer/x12-277rfai-solicited-attachment-request-parser-spec.md](agreement-layer/x12-277rfai-solicited-attachment-request-parser-spec.md)

**Next priority questions:**
1. Should `ClaimsAttachmentAdapter` rename `parseSolicited277CA()` to `parseSolicited277RFAI()` and descope it from Phase 1 MVP — published as a formal spec amendment to the `PayerAdapterInterface` spec before next feature branch regeneration?
2. Should the `AttachmentRequest` type carry `rawPayerControlRef: { qualifier: string; value: string }` alongside `payerControlNumber: string` — to preserve the REF qualifier for correct payer-specific 275 round-trip construction?
3. Does the `@cliqueue/x12-275` package need a `parseAttachmentRequest277(ediText: string): AttachmentRequest` export alongside `generateUnsolicited275()` — establishing the full bidirectional interface even if the solicited method is empty/stub in Phase 1?

---

## 2026-05-17 — RFI denial cycle time benchmark: paper/fax resolves in 60–120 days; "24-72h electronic" claim unsourced and retracted; CMS-0053-F sets no mandatory payer response window; 5–7 day payer matching window is the defensible electronic comparator

**Question investigated:** Is there a published HFMA, Kodiak Solutions, or industry benchmark for electronic vs. paper/fax 275 attachment response turnaround time — does the "90-day paper → 24-72h electronic" ROI framing have primary-source support?

**Key findings:**
- **Primary source for RFI cycle time confirmed: Kodiak Solutions VP Matt Szaflarski on FAH podcast.** Exact quote: "89% of these requests for information denials end up getting resolved without any sort of net revenue leakage or final denials being posted to the account. But they're not resolved until 60, 90, 120 days later." Szaflarski is VP Revenue Cycle Intelligence at Kodiak — presenting from Kodiak's benchmarking database. ([FAH podcast](https://www.fah.org/podcasts/the-delay-and-deny-cycle-a-closer-look-at-recent-trends/); [Szaflarski bio](https://www.kodiaksolutions.io/company/our_leadership/matt_szaflarski))
- **The "90-day paper" figure in prior research is not a cycle-time-to-payment benchmark.** The Advantum Health / Kodiak 2024 KPI Benchmark citation contains denial-rate and cost figures only — no 90-day cycle time. The correct baseline from primary sources is **60–120 days** (paper/fax RFI resolution window, Kodiak/FAH).
- **The "24-72h electronic turnaround" claim is unsourced and must be retracted.** No vendor (Waystar, Change Healthcare/Optum, Experian Health, Availity) or regulator (CMS, CAQH CORE) publishes a universal electronic 275 turnaround of 24–72 hours. CMS-0053-F (Federal Register 2026-05676, May 2028 compliance deadline) adopts X12 275/277 standards but mandates no mandatory payer response window. ([CMS-0053-F fact sheet](https://www.cms.gov/files/document/nsg-attachments-final-rule-fact-sheet.pdf))
- **Defensible electronic comparator: 5–7 calendar day payer matching window per companion guides.** UHC 006020X314 companion guide requires 275 attachments within 5 calendar days of claim receipt; Anthem Blue Cross and VA Community Care set 7 calendar days. These are administrative matching windows (payer links the attachment to the claim), not adjudication timelines. ([UHC 275 guide](https://www.uhcprovider.com/content/dam/provider/docs/public/resources/edi/EDI-275-Companion-Guide-for-UHC-006020X314.pdf); [Anthem CA](https://www.anthembluecross.com/content/dam/digital/docs/anthembluecross/provider/commercial/general/EDI_CA_00025.pdf))
- **HFMA publishes no universal RFI-specific day-count benchmark.** HFMA's denial standardization guidance defines "time from initial denial to claim resolution" as a KPI metric for internal trending only — no RFI-specific subcategory, no universal threshold. ([HFMA denial metrics](https://www.hfma.org/guidance/standardizing-denial-metrics-revenue-cycle-benchmarking-process-improvement/))
- **30-day general denial resolution benchmark is unsourced industry consensus.** MDClarity cites this as "industry standard" without attribution. Not a primary-source number.
- **CAQH Index 2023/2024** publishes no electronic attachment days-to-adjudication figure — only time-per-transaction savings for prior authorization (11 min electronic vs. 16 min portal) and aggregate dollar savings. ([2023 CAQH Index](https://www.caqh.org/hubfs/43908627/drupal/2024-01/2023_CAQH_Index_Report.pdf))

**Design implication:** cliqueue's ROI calculator and all marketing materials must revise the RFI framing immediately. Correct claim: "X12 275 electronic attachment converts the 60–120 day paper/fax RFI resolution window to a 5–7 day payer matching window (per UHC/Anthem companion guides)." Remove "24-72h electronic" everywhere. The prior research file `rfi-denial-pathway-paauthash-on-chain-scope.md` requires a correction entry. The ROI story remains materially strong (60–120 → 5–7 days is a 10–20× documented compression) but must use the correct sourced baseline.

**Findings file:** [docs/research/market/rfi-denial-cycle-time-benchmark-electronic-vs-paper.md](market/rfi-denial-cycle-time-benchmark-electronic-vs-paper.md)

**Next priority questions:**
1. Does any payer companion guide publish adjudication-to-payment cycle time for electronic 275 attachment claims vs. paper/fax — enabling a full end-to-end comparison beyond the 5–7 day matching window?
2. Should cliqueue's ROI calculator present RFI value as a range ("60–120 days → 5–7 day matching window") with a payer-contract-dependent adjudication note?
3. Should `rfi-denial-pathway-paauthash-on-chain-scope.md` be formally updated to retract "24-72h electronic" and replace with the sourced 5–7 day matching window figure?

---

## 2026-05-17 — @cliqueue/cda-attachments vs @cliqueue/x12-275 package boundary: separate packages confirmed by ecosystem precedent and CMS-0053-F architecture

**Question investigated:** Should `@cliqueue/cda-attachments` be renamed `@cliqueue/claim-attachments` to encompass both CDA document generation and X12 275 envelope generation — or are these separate packages with `@cliqueue/x12-275` importing `@cliqueue/cda-attachments`?

**Key findings:**
- **Separate packages is the only defensible architecture.** No 2023–2026 npm package combines X12 EDI generation and HL7 CDA document generation. `node-x12`, `@stedi/edi-core`, `hl7-fhir-r4-core`, `@medplum/ccda` all treat these as independent concerns.
- **CMS-0053-F itself mandates the separation.** The rule adopts X12 275 (006020X314) as transport/envelope and HL7 C-CDA R2.1 as clinical document content — distinct standards bodies (ASC X12 vs. HL7) with independent versioning. Coupling them in one package requires synchronized bumps when either standard updates.
- **Correct dependency direction: X12 imports CDA via an `AttachmentPayload` interface; CDA never imports X12.** `AttachmentPayload { contentType: string; bytes: Uint8Array; filename?: string; documentId?: string }` lives in `@cliqueue/fhir-types`. `@cliqueue/x12-275` accepts it; `@cliqueue/cda-attachments` returns it.
- **`node-x12` (TypeScript-declared, maintenance mode since 2021) is the only candidate runtime dep.** Usable as a devDependency for test parsing; unsafe as a runtime dependency for 006020X314 generation. `@cliqueue/x12-275` must hand-roll ISA/GS/ST/BHT/HL/BDS envelope — fifth ecosystem hand-roll confirmed (joining `@cliqueue/cds-hooks-client`, `@cliqueue/pa-lifecycle`, `@cliqueue/cda-attachments`, and prior `@stedi/edi-core` analysis).
- **`ClaimsAttachmentAdapter` lives in hospital-agent app layer, not in either package.** It imports both `@cliqueue/cda-attachments` (to generate `AttachmentPayload`) and `@cliqueue/x12-275` (to wrap it in the ISA envelope). No third "adapter package" is needed.

**Design implication:** The `@cliqueue/*` monorepo gains a fifth package: `@cliqueue/x12-275`. `@cliqueue/cda-attachments` keeps its name and stays CDA-only. `ClaimsAttachmentAdapter` lives in the hospital-agent app.

**Findings file:** [docs/research/agreement-layer/cda-vs-x12-275-package-boundary.md](agreement-layer/cda-vs-x12-275-package-boundary.md)

**Next priority questions:**
1. Should `@cliqueue/x12-275` export `generateUnsolicited275(claimRef, payload, isaControlParams)` — and should `ISAControlParams` (sender/receiver ISA IDs) be required or derived from onboarding config?
2. Should `AttachmentPayload` be in `@cliqueue/fhir-types` or a separate ultra-minimal `@cliqueue/attachment-types` — does adding it to `fhir-types` create misleading FHIR coupling?
3. Should ISA13 (interchange control number) in `ISAControlParams` be auto-incremented via a hospital-local counter or require explicit caller provision?

---

## 2026-05-17 — Improbable/Somnia chain operator BAA: no BAA exists, none is possible, none is required under cliqueue's PHI-free on-chain architecture; conduit exception does not apply to blockchain validators; "Somnia Non-BA Determination Memo" required for hospital procurement

**Question investigated:** What BAA structure does a hospital's counsel require with Improbable (Somnia chain operator) before anchoring claim-derived hashes on Somnia mainnet — and is Improbable a HIPAA Business Associate under 45 CFR 160.103?

**Key findings:**
- **No Improbable/Somnia HIPAA BAA exists.** Somnia's public site has generic Privacy Policy/ToS only — no healthcare compliance documentation. No public permissionless L1 operator (Ethereum Foundation, Polygon Labs, Consensys) has published a healthcare BAA. The decentralized validator set has no identifiable contract counterparty capable of signing a BAA. ([Somnia Network](https://www.somnia.network); [HIPAA University 2026](https://hipaauniversity.com/blog/blockchain-in-healthcare/))
- **BA status test is functional, not structural.** Under 45 CFR 160.103, Improbable is a BA only if it creates/receives/maintains/transmits PHI on behalf of the hospital. Under cliqueue's architecture (HMAC claim hashes + paStatus bytes + settlement amounts on-chain only, PHI never enters the chain), Improbable never touches PHI — BA status is not triggered. ([HHS BA definition](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160#p-160.103))
- **Conduit exception does NOT apply to blockchain validators.** The conduit exception requires purely transient storage incident to transmission. HHS is explicit: "an entity that maintains PHI on behalf of a covered entity is a business associate and not a conduit, even if the entity does not actually view the PHI." Blockchain validators persistently replicate ledger data — the opposite of transient. This is a second reason PHI must never reach the chain. ([Holland & Hart conduit exception analysis](https://www.hollandhart.com/hipaa-business-associates-and-the-conduit-exception); [HHS FAQ 2077](https://www.hhs.gov/hipaa/for-professionals/faq/2077/can-a-csp-be-considered-to-be-a-conduit-like-the-postal-service-and-therefore-not-a-business%20associate-that-must-comply-with-the-hipaa-rules/index.html))
- **Correct BAA stack:** (1) Hospital↔cliqueue BAA (required — cliqueue handles PHI off-chain); (2) cliqueue↔Corti sub-BAA (required — Symphony receives clinical notes); (3) Hospital↔Improbable BAA: NOT REQUIRED because Somnia never receives PHI. Already confirmed in prior research: [hipaa-blockchain-hash-anchoring.md](regulatory/hipaa-blockchain-hash-anchoring.md) and [corti-baa-procurement-timeline-sub-baa-chain.md](regulatory/corti-baa-procurement-timeline-sub-baa-chain.md).
- **Healthcare attorney consensus:** anchor only non-PHI artifacts on public chains; BAA obligation falls entirely on off-chain PHI-handling vendors. No OCR enforcement action targeting HMAC hash anchoring on a public chain as a HIPAA violation has been published. ([HIPAA University](https://hipaauniversity.com/blog/blockchain-in-healthcare/); [Holland & Hart](https://www.hollandhart.com/hipaa-business-associates-and-the-conduit-exception))
- **Hospital procurement blocker requires a proactive document:** Hospital privacy officers will ask. cliqueue needs a "Somnia Non-BA Determination Memo" — one page citing 45 CFR 160.103 BA definition, HHS conduit FAQ, and cliqueue's on-chain data model — so privacy officers have a documented legal defense, not just cliqueue's self-assessment.

**Design implication:** No architectural change required — cliqueue's existing PHI-free on-chain design is the correct solution. The action item is documentation: a "Somnia Non-BA Determination Memo" for the hospital onboarding package, ideally reviewed by outside HIPAA counsel given the absence of OCR blockchain-specific precedent.

**Findings file:** [docs/research/regulatory/improbable-somnia-operator-baa-analysis.md](regulatory/improbable-somnia-operator-baa-analysis.md)

**Next priority questions:**
1. Should cliqueue's hospital BAA explicitly list Improbable/Somnia as a "non-BA infrastructure provider" in a Subprocessor Exhibit — distinguishing it from Corti (named BA subprocessor) — so hospital privacy officers can close the Somnia question without separate legal review?
2. Should the "Somnia Non-BA Determination Memo" be reviewed by outside HIPAA counsel before hospital distribution — given the memo's conclusions affect the hospital's compliance posture and no OCR blockchain hash-anchoring enforcement precedent exists?
3. If Improbable later adds a "healthcare validator service" tier (permissioned node with contractual commitments), does that create BA status requiring a BAA or a switch to a non-Improbable validator set?

---

## 2026-05-17 — RFI denial pathway and `paAuthHash`: on-chain hash is provenance anchor, NOT a 277-elimination mechanism; CMS-0053-F mandates solicited 277/275 workflow; ROI framing corrected to "90-day paper → 24-72h electronic acceleration"

**Question investigated:** Does cliqueue's on-chain `ClaimSubmitted` event plus `paAuthHash` attachment commitment directly address the RFI denial pathway — can a payer treat this as a complete attachment submission, eliminating the 90-day RFI delay?

**Key findings:**
- **RFI denial mechanism**: A payer pends or denies a claim when supporting documentation is missing, incomplete, or insufficient. Five documented causes: missing documentation, missing remark code, lack of necessary information, inadequate documentation, failure to meet specific requirements. RFI denial rates rose from 3.51% (2022) to 3.82% (first 5 months of 2024); administrative RFI costs ~$2B in first 5 months of 2024. ([Kodiak Solutions 2024 KPI Benchmark via Advantum Health](https://advantumhealth.com/how-advantum-health-combats-rising-request-for-information-claim-denials/))
- **CMS-0053-F mandates the solicited 277/275 workflow, not an unsolicited proactive intake**: The rule (finalized March 2026, compliance deadline May 26, 2028) adopts X12N 277 (payer request for additional information) + X12N 275 (provider attachment response). The rule does NOT require payers to accept unsolicited/proactive 275 submissions as automatically satisfying documentation requirements. ([Federal Register 2026-05676](https://www.federalregister.gov/documents/2026/03/24/2026-05676/administrative-simplification-adoption-of-standards-for-health-care-claims-attachments-transactions); [CMS fact sheet](https://www.cms.gov/files/document/nsg-attachments-final-rule-fact-sheet.pdf))
- **Proactive attachment does not eliminate payer's 277 right**: A payer can still issue a formal 277 RFI and deny if the provider does not respond to the 277 — even if the provider previously sent an unsolicited 275 proactively. The rule does not create a safe harbor that every proactive submission satisfies every future documentation request. (Perplexity synthesis, confirmed against Federal Register 2026-05676)
- **No blockchain/hash-as-proof precedent exists**: No payer (Aetna, UHC, Cigna, Humana) publicly accepts a cryptographic hash as documentation availability proof in lieu of the actual document. No healthcare revenue cycle literature 2023-2026 establishes this pattern. (Perplexity synthesis; no contradicting primary source found)
- **`paAuthHash` addresses RFI denials via three indirect mechanisms**: (A) Provenance anchor — proves documentation existed at submission time, eliminates "we never received it" disputes in appeals; (B) Accelerated 277/275 exchange — payer knowing a document exists (via non-zero `paAuthHash`) can issue 277 immediately and expect electronic 275 response; (C) CMS-0053-F compliance path — `@cliqueue/cda-attachments` enables mandatory electronic 275 submission post-May 2028, converting 90-day paper/fax RFI cycles to 24-72h electronic exchange.
- **ROI framing must be corrected**: The $14.4B RFI pipeline is addressable via electronic 277/275 acceleration, not by eliminating RFI denials. Correct framing: "cliqueue converts 90-day paper/fax RFI cycles to 24-72h electronic 275 exchanges post-May 2028."

**Design implication:** `paAuthHash` in `ClaimSubmitted` is confirmed — its purpose is provenance anchoring and electronic attachment linking, not RFI elimination. Marketing and ROI calculator must be updated: frame attachment value as "277/275 response acceleration (90 days → 24-72 hours post-May 2028)" not "eliminates RFI denials." The hospital BAA Settlement Finality Exhibit should include an "Attachment Provenance Clause" referencing on-chain timestamp as appeals evidence.

**Findings file:** [docs/research/agreement-layer/rfi-denial-pathway-paauthash-on-chain-scope.md](agreement-layer/rfi-denial-pathway-paauthash-on-chain-scope.md)

**Next priority questions:**
1. Should cliqueue's ROI calculator present RFI denial value as "277/275 acceleration (90-day paper → 24-72h electronic)" with a published HFMA/Kodiak benchmark for electronic turnaround time?
2. Should the hospital BAA include an "Attachment Provenance Clause" documenting the on-chain `paAuthHash` as a tamper-evident appeals record?
3. After CMS-0053-F's May 2028 deadline, does a payer still using paper/fax for 277 requests create an actionable HIPAA administrative simplification violation?

---

## 2026-05-17 — Corti BAA procurement: no self-serve path; 2–6 week enterprise timeline; Hospital→cliqueue→Corti sub-BAA chain valid under 45 CFR 164.502(e)(1)(ii); cliqueue should act as primary BA with Corti as named subprocessor

**Question investigated:** What is Corti's standard BAA turnaround time for enterprise procurement, and can cliqueue pre-negotiate a standard form BAA for hospital onboarding rather than requiring each hospital to negotiate directly with Corti?

**Key findings:**
- **No Corti self-serve or click-through BAA exists.** Corti's public safety, trust center, and legal pages do not describe a click-through or downloadable standard BAA template. Enterprise procurement requires direct contact with Corti sales/legal (`privacy@corti.ai`). ([Corti Safety](https://www.corti.ai/safety); [Corti Terms & Conditions](https://assistant.corti.ai/terms-and-conditions))
- **Typical enterprise BAA turnaround: 2–6 weeks** standard path; 2–7 business days if vendor accepts hospital paper with minimal edits; 1–3 months for large health systems with procurement queues. No vendor (including Nuance DAX, AWS Comprehend Medical) publishes a BAA turnaround SLA. ([HIPAAJournal](https://www.hipaajournal.com/hipaa-business-associate-agreement/); [Accountable HQ](https://www.accountablehq.com/post/hipaa-business-associate-agreement-requirements-complete-guide-for-covered-entities))
- **The Hospital→cliqueue→Corti sub-BAA chain is legally valid under 45 CFR 164.502(e)(1)(ii) and 164.308(b)(2).** The hospital does NOT need a direct BAA with Corti if cliqueue holds a master sub-BAA with Corti requiring the same HIPAA restrictions. ([45 CFR 164.502(e)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/section-164.502); [HHS: Business Associates — Subcontractors](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/subcontractors/index.html))
- **cliqueue acting as primary BA (holding the Corti sub-BAA) compresses hospital onboarding** from two BAA negotiations (hospital↔cliqueue + hospital↔Corti) to one (hospital↔cliqueue only), with Corti listed as a named subprocessor in the hospital BAA's Subprocessor Exhibit.
- **Major cloud platforms (AWS, Azure, Google Cloud) offer self-serve BAAs** — often same-day for existing enterprise customers. Corti uses Azure, but Corti's product-level BAA is separate from Azure's infrastructure BAA. ([AWS HIPAA compliance](https://aws.amazon.com/compliance/hipaa-compliance/); [Microsoft Trust Center HIPAA](https://www.microsoft.com/en-us/trust-center/privacy/hipaa))
- **AI-specific BAA clauses commonly under-negotiated:** model-training prohibition on hospital PHI, subprocessor disclosure with audit rights, 24–72 hour breach notification (vs. HIPAA's 60-day floor), data deletion/return terms, annual BA verification rights (per HIPAA Security Rule NPRM, expected finalization Summer 2026). ([Scribing.io: BAA requirements for AI scribes](https://www.scribing.io/blog/baa-requirements-ai-medical-scribes); [HIPAA Journal: 2026 HIPAA Security Rule NPRM](https://www.hipaajournal.com/hipaa-updates-hipaa-changes/))
- **Corti BAA is a pre-launch blocker**, not an onboarding task. Every API call to Symphony before BAA execution is a HIPAA violation. Initiation timeline: ≥6 weeks before first hospital pilot.

**Design implication:** cliqueue executes a master cliqueue↔Corti BAA before any hospital pilot begins; Corti becomes a named subprocessor in cliqueue's standard hospital BAA; hospital onboarding requires only the hospital↔cliqueue BAA, with a Subprocessor Exhibit disclosing Corti. This eliminates a per-hospital 2–6 week blocking dependency.

**Findings file:** [docs/research/regulatory/corti-baa-procurement-timeline-sub-baa-chain.md](regulatory/corti-baa-procurement-timeline-sub-baa-chain.md)

**Next priority questions:**
1. Should cliqueue's hospital BAA include a "Subprocessor Exhibit" listing Corti by name (Azure US data region, FedRAMP/HIPAA cert status) — giving hospital privacy officers pre-packaged due-diligence documentation?
2. Should the cliqueue↔Corti master BAA include an annual SOC 2 Type II attestation clause to satisfy the proposed 2026 HIPAA Security Rule annual BA verification requirement before the final rule is published?
3. Should cliqueue publish a "Vendor Procurement Timeline Exhibit" in the hospital onboarding checklist stating the cliqueue↔Corti master BAA is already in place — preventing hospitals from independently initiating Corti BAA negotiations and fragmenting the subprocessor chain?

---

## 2026-05-17 — Denial rework cycle economics confirmed: $25.7B hospital claims adjudication cost (2023), $57.23/denied-claim overhead, 135–180 day overturned-denial resolution window; no national cost-fraction isolation for coding errors exists

**Question investigated:** What is the mean time-to-payment for a clean vs. denied-then-resubmitted claim, and is there a primary-source estimate of coding-error-attributable denied dollar value as a share of the $262B total 2024 denied pool?

**Key findings:**
- **$25.7B total hospital claims adjudication cost in 2023** (Premier Inc.), up 23% YoY from $19.7B in 2022. ~$18B is potentially unnecessary expense from denials ultimately overturned. Per-denied-claim administrative overhead rose from $43.84 (2022) to **$57.23 (2023)**. ([Premier Inc. Claims Adjudication Study, 2024](https://premierinc.com/newsroom/blog/claims-adjudication-costs-providers-25-7-billion))
- **Overturned denials average 3 review rounds × 45–60 days = 135–180 days total resolution time.** This is the float window cliqueue's on-chain settlement directly compresses. ([Premier Inc.](https://premierinc.com/newsroom/blog/claims-adjudication-costs-providers-25-7-billion))
- **Clean claim payment time: 15–30 days** (electronic commercial); Medicare Advantage 30–45 days; traditional Medicare 10–14 days. **RFI-denied claims add a minimum 90-day delay** (30-day payer decision + 60-day research window). ([HFMA / Kodiak Solutions, Aug 2024](https://www.hfma.org/revenue-cycle/report-payer-requests-for-information-are-slowing-reimbursement/))
- **RFI denial volume annualizes to $14.4B in 2024** (Kodiak Solutions benchmark, Kodiak participants). RFI denial rate of billed charges: 3.82% in 2024 vs. 3.51% in 2022. True AR days increased 5.2% YoY in 2024. ([Revecore 2026](https://revecore.com/health-system-denials-underpayments-2026/))
- **Premier names "minor clerical/data errors including coding mistakes" as the single top reason to deny claims in 2023**, but gives no percentage. No national primary source isolates ICD-10 coding errors as a clean fraction of the $262B denied pool or the $25.7B adjudication cost. The ~$52B coding-error estimate (~20% × $262B) from MDaudit 2024 remains the best available approximation.
- **Commercial timely-filing windows: 90–180 days from date of service.** A corrected claim does not restart the clock. With 45–60 day rework cycles, a claim denied near the end of a 90-day window is at material risk of expiration if rework is not initiated within 30 days of denial discovery.
- Massachusetts HPC 2024 (state-level primary data): 4.9% of claims denied specifically for "incomplete claim, coding error, or duplicate" — consistent with coding errors being a mid-tier share of total denial volume.

**Design implication:** The Premier data sharpens cliqueue's ROI model: on-chain settlement eliminates the $57.23/claim overhead × 3-round rework cycle (effective rework cost: ~$172/overturned coding-error denial) and converts 135–180 day float to near-zero. For a hospital with 10,000 claims/month at 12% denial rate and 20% coding-error share, the direct monthly savings are ~$41,000 in overhead alone, before counting the float reduction on the $631/claim denied coding revenue. The $14.4B RFI denial pipeline is a second value driver: cliqueue's `paAuthHash` CDA attachment commitment at claim submission time can pre-empt RFI requests by providing cryptographic proof of clinical record linkage — directly addressing the 90-day RFI delay.

**Findings file:** [docs/research/market/coding-market-size-and-denial-losses.md](market/coding-market-size-and-denial-losses.md)

**Next priority questions:**
1. Should cliqueue's ROI model publish a two-scenario calculator: (A) coding-error denial rework savings ($57.23 × count × 3 cycles), (B) RFI float reduction ($14.4B pipeline × hospital share)?
2. Does the `ClaimSubmitted` on-chain event plus `paAuthHash` attachment commitment directly address the RFI denial pathway — can a payer treat this as a pre-submitted attachment, eliminating the 90-day RFI delay?
3. Is there a primary-source denial-reason cost breakdown of the $25.7B adjudication cost (coding vs. PA vs. eligibility vs. RFI)?

---

## 2026-05-17 — C-CDA R2.1 Schematron XPath 1.0 gap confirmed: `current()` and dateTime comparisons unsupported in `cda-schematron-validator` v1.1.12; two-tier CI architecture required (Node.js + KvalitetsIT Docker)

**Question investigated:** Does the C-CDA R2.1 `.sch` file require XPath 2.0 functions that `cda-schematron-validator` v1.1.12 cannot evaluate — and does this limit structural conformance coverage for the 6 supported document templates?

**Key findings:**
- **HL7/fhir-cda-validation README (primary source) documents three confirmed XPath gaps:** (1) `current()` XPath 2.0 function not supported — affected assertions tested manually; (2) dateTime comparisons not supported (e.g., "procedure start date must be before document date"); (3) value sets containing apostrophes excluded at generation time. ([HL7/fhir-cda-validation README](https://github.com/HL7/fhir-cda-validation/blob/main/README.md))
- **Variable `<let>` declarations pre-processed:** The tool substitutes variable references with literal values before validation — a workaround rather than full Schematron `<let>` support. Tool self-assesses: "seems to be catching most of the generated Schematron rules" — qualified, not a completeness guarantee.
- **`cda-schematron-validator` v1.1.12 is XPath 1.0 (xmldom + xpath npm).** XPath 2.0-only functions (`matches()`, `tokenize()`, `current()`, `xs:dateTime()`, `string-join()`, `some...satisfies`) silently fail to evaluate or cause runtime errors. ([cda-schematron-validator](https://github.com/priyaranjan-tokachichu/cda-schematron-validator))
- **Template exposure by type:** Operative Note, Procedure Note, and Discharge Summary are most exposed (heavy temporal ordering constraints). Consultation Note and Progress Note moderately exposed. Unstructured Document least affected by XPath 2.0 gaps.
- **XPath 1.0-safe rule classes (reliably caught):** templateId/@root checks, required section LOINC codes, element cardinality, required child element existence, structural nesting — the majority of conformance rules by count.
- **Two-tier CI architecture confirmed:** Tier 1 = `cda-schematron-validator` in Vitest (fast, offline, catches structural rules); Tier 2 = KvalitetsIT/cda-validator Docker (Saxon-HE, full XPath 2.0, full Schematron) on release/pre-publish builds. ([KvalitetsIT/cda-validator](https://github.com/KvalitetsIT/cda-validator))

**Design implication:** `@cliqueue/cda-attachments` must adopt two-tier CI: `cda-schematron-validator` for fast PR feedback (structural correctness) + KvalitetsIT Docker for release builds (full Schematron including `current()` and dateTime rules). Hospital onboarding checklist must include a "Schematron Coverage Gap Memo" disclosing XPath 2.0 limitations and that known-valid XML fixtures are the primary conformance evidence for CMS-0053-F submissions.

**Findings file:** [docs/research/agreement-layer/cda-schematron-vsac-ci-validation.md](agreement-layer/cda-schematron-vsac-ci-validation.md)

**Next priority questions:**
1. Should `@cliqueue/cda-attachments` publish a formal "Schematron Coverage Gap Memo" disclosing XPath 2.0 limitations for hospital onboarding?
2. Should the KvalitetsIT Docker gate be mandatory on all PRs or restricted to release builds?
3. Can cliqueue pre-audit the committed `.sch` to enumerate all `current()` and XPath 2.0 date assertions — producing a definitive coverage boundary count?

---

## 2026-05-17 — Ormi subgraph ABI format confirmed: interface ABI (clean JSON array) for ClaimsAdjudicator; forge build JSON must be extracted via `forge inspect abi`; UUPS proxy uses proxy address + implementation ABI; custom error types safe in current graph-node

**Question investigated:** Should the Ormi subgraph manifest use the `IClaimsAdjudicator` interface ABI or the Foundry implementation ABI — and does the Foundry forge build JSON output contain artifacts that break `graph codegen`?

**Key findings:**
- **Use the `IClaimsAdjudicator` interface ABI (clean JSON array)** — NOT the full `forge build` JSON output. The subgraph `abis/` directory requires a standalone JSON array `[...]` of ABI entries. Supplying the full Foundry artifact (with `abi`, `bytecode`, `storageLayout`, `ast` at the top level) causes graph-node deserialization failure. Extraction command: `forge inspect IClaimsAdjudicator abi > abis/IClaimsAdjudicator.json` or `jq '.abi' out/ClaimsAdjudicator.sol/ClaimsAdjudicator.json`.
- **The interface ABI is sufficient** because `IClaimsEvents.sol` (inherited by `IClaimsAdjudicator`) declares all four indexable ClaimsAdjudicator events. graph-node indexes only events present in the ABI bound to the data source — and all required events are present in the interface ABI.
- **UUPS proxy pattern**: `subgraph.yaml` uses the proxy contract address but the implementation's interface ABI. The proxy ABI contains only upgrade events (`Upgraded`, `AdminChanged`) — not business events. The implementation ABI (via `IClaimsAdjudicator`) is the correct artifact, paired with the proxy address.
- **Custom error types in ABI were previously a graph-node breakage** (`"Invalid operation type error"`), fixed in graph-node January 2022 (PR #3144). Current Ormi/graph-node versions accept error entries. Using interface ABI avoids this entirely since `IClaimsAdjudicator` does not declare custom errors.
- **Ormi is fully The Graph-compatible** — same `graph deploy` CLI, same `subgraph.yaml` spec. Ormi auto-fetches ABI from Somnia block explorer; manual upload fallback available.

**Design implication:** The Ormi `subgraph.yaml` uses proxy address + `IClaimsAdjudicator` interface ABI (clean JSON array). CI runs `forge inspect IClaimsAdjudicator abi` to produce `abis/IClaimsAdjudicator.json`; same for `ISBTRegistry`. Both ABI files are committed as versioned artifacts in the contracts repo.

**Findings file:** [docs/research/somnia/ormi-subgraph-abi-format-interface-vs-implementation.md](somnia/ormi-subgraph-abi-format-interface-vs-implementation.md)

**Next priority questions:**
1. Should cliqueue's Foundry contracts repo CI run `forge inspect IClaimsAdjudicator abi > abis/IClaimsAdjudicator.json` and commit the output as a versioned artifact alongside `src/generated.ts`?
2. When `ClaimsAdjudicator` is upgraded via UUPS, does the Ormi hosted environment support an atomic ABI-upgrade + subgraph-redeploy workflow preserving indexed history across implementation upgrades?
3. Should `ISBTRegistry` use a UUPS proxy or be deployed as an immutable contract — and does that choice change which ABI file is supplied to the Ormi data source?

---

## 2026-05-17 — `cda-schematron-validator` v1.1.12 confirmed: no VSAC API, no NLM key, no Java required for CI; terminology server is generation-only; structural conformance is fully offline; XPath 1.0 limitation requires `.sch` compatibility check

**Question investigated:** Does `cda-schematron-validator` v1.1.12 require separate VSAC API access to resolve value set bindings — would C-CDA Schematron validation in `@cliqueue/cda-attachments` CI need an NLM API key?

**Key findings:**
- No VSAC API access required at validation time. The FHIR terminology server (`tx.fhir.org`) is used only for Schematron *generation* from the IG StructureDefinitions — a one-time IG-author step that produces the `.sch` file. Running validation against CDA documents requires no external network calls. ([HL7/fhir-cda-validation README](https://github.com/HL7/fhir-cda-validation/blob/main/README.md))
- `cda-schematron-validator` v1.1.12 evaluates locally: accepts pre-generated `.sch` + optional local `voc.xml` resource files for vocabulary membership checks. No NLM/UMLS API key is needed. ([cda-schematron-validator README](https://github.com/priyaranjan-tokachichu/cda-schematron-validator))
- Value set membership checks not covered by local `voc.xml` are surfaced as warnings (suppressible via `{ includeWarnings: false }`), not hard failures — confirming CI can be configured to gate only on structural conformance errors.
- Offline Schematron validation fully catches: wrong template OIDs, missing required sections, invalid cardinality, incorrect element ordering — the primary conformance failures relevant to claims attachments under CMS-0053-F.
- The `fhir-cda-validation` tool documents "some limitations with XPath 2.0 functions and variable resolution" in `cda-schematron-validator`. The pre-generated `.sch` file must be verified for XPath 1.0 compatibility before committing as a static CI artifact.

**Design implication:** Commit the pre-generated C-CDA R2.1 `.sch` file as a static repo artifact. Run `cda-schematron-validator` in Vitest — pure Node.js, no subprocess, no Java, no NLM key. Bundle a `voc.xml` subset for offline membership checks. The "pure Node.js, no external dependencies" CI requirement is fully satisfiable. XPath 1.0 compatibility must be validated before the `.sch` file is locked.

**Findings file:** [docs/research/agreement-layer/cda-schematron-vsac-ci-validation.md](agreement-layer/cda-schematron-vsac-ci-validation.md)

**Next priority questions:**
1. Does the C-CDA R2.1 `.sch` file require XPath 2.0 functions that `cda-schematron-validator` v1.1.12 cannot evaluate — and does this limit structural conformance coverage for any of the 6 supported document templates?
2. Should `@cliqueue/cda-attachments` bundle a `voc.xml` subset covering the 6 supported document template value sets for offline membership checks?
3. Should the `.sch` file be committed as a static repo artifact or regenerated in CI via `fhir-cda-validation` on each IG version update?

---

## 2026-05-17 — `@cliqueue/cda-attachments` scope confirmed: 6 C-CDA R2.1 document templates; CMS-0053-F is claims-only (prior auth excluded); `cda-schematron-validator` v1.1.12 enables pure Node.js CI validation; Docker CI fallback via KvalitetsIT container

**Question investigated:** Should `@cliqueue/cda-attachments` scope to only CMS-0053-F listed attachment types or build a generic C-CDA R2.1 template engine — and should CI validation use Java-based Schematron or pure Node.js?

**Key findings:**
- CMS-0053-F (March 24, 2026) adopts X12N 275/277 v6020 + HL7 C-CDA IG Volumes One/Two + HL7 CDA R2 Attachment IG (March 2022). Compliance deadline: May 26, 2028. ([Federal Register 2026-05676](https://www.federalregister.gov/documents/2026/03/24/2026-05676/administrative-simplification-adoption-of-standards-for-health-care-claims-attachments-transactions); [CMS fact sheet](https://www.cms.gov/newsroom/fact-sheets/administrative-simplification-adoption-standards-health-care-claims-attachments-transactions))
- CMS-0053-F does NOT cover prior authorization — PA attachment standards were proposed but not finalized. `@cliqueue/pa-lifecycle` (CRD/PAS) is the correct PA path; `@cliqueue/cda-attachments` is post-claim records only. ([cubetherapybilling.com](https://www.cubetherapybilling.com/cms-0053-f-explained-what-aba-providers-need-to-know-before-may-2028))
- The 12 C-CDA R2.1 document-level templates are confirmed: Care Plan, Consultation Note, CCD, Discharge Summary, H&P, Operative Note, Procedure Note, Progress Note, Referral Note, Transfer Summary, Unstructured Document, Patient Generated Document. No standalone "Diagnostic Imaging Report" or "Laboratory Report" template — these are sections inside other document types. ([build.fhir.org C-CDA 2.1 IG](https://build.fhir.org/ig/HL7/CDA-ccda-2.1-sd/))
- Recommended scope: 6 practically relevant templates for claims attachments — Progress Note, Consultation Note, Operative Note, Procedure Note, Discharge Summary, Unstructured Document — with lab/imaging as section-level structures inside them.
- `cda-schematron-validator` v1.1.12 (published Oct 23, 2022) is the maintained fork used in HL7/fhir-cda-validation tooling. Pure Node.js (xmldom + xpath), no Java subprocess. `cda-schematron` v1.0.1 (Feb 2017) is stale. ([npm registry](https://registry.npmjs.org/cda-schematron-validator); [HL7/fhir-cda-validation](https://github.com/HL7/fhir-cda-validation/blob/main/README.md))
- Docker-based CI validation viable via `KvalitetsIT/cda-validator` container (Java-based, HTTP service on port 8080), for stricter conformance where Node.js Schematron coverage is insufficient. ([GitHub: KvalitetsIT/cda-validator](https://github.com/KvalitetsIT/cda-validator))
- NIST CDA Validation tool is web-only and was decommissioned in 2018 — no CLI or Docker image available. ([NIST CDA validation](https://cda-validation.nist.gov/cda-validation/))

**Design implication:** `@cliqueue/cda-attachments` targets 6 C-CDA R2.1 document templates with lab/imaging as section structures; CI uses `cda-schematron-validator` (pure Node.js, no Java); Docker CI via KvalitetsIT as optional stricter gate; known-valid XML fixtures published as the primary hospital-onboarding conformance artifact.

**Findings file:** [docs/research/agreement-layer/hl7-cda-r2-typescript-npm-ecosystem-x12-275.md](agreement-layer/hl7-cda-r2-typescript-npm-ecosystem-x12-275.md)

**Next priority questions:**
1. Does `cda-schematron-validator` v1.1.12 require separate VSAC API access to resolve value set bindings — would C-CDA Schematron validation in CI need an NLM API key?
2. Should `@cliqueue/cda-attachments` publish a `cdaAttachmentScope` TypeScript constant with the 6 document template OIDs and LOINC codes in the hospital onboarding checklist?
3. Should `PayerAdapterInterface.ClaimsAttachmentAdapter` define a separate sub-interface for X12 275/277 + HL7 CDA with a distinct implementation timeline (May 2028) vs. the MVP 837/835 requirement?

---

## 2026-05-17 — `IClaimsAdjudicator` event registry: Uniswap v3 sub-interface pattern confirmed; `IClaimsEvents.sol` for ClaimsAdjudicator events only; SBTRegistry events stay in `ISBTRegistry`; Ormi uses two separate data sources; interface declaration has zero gas cost; ERC-165 unaffected

**Question investigated:** Should `IClaimsAdjudicator` declare all primary events (`ClaimSubmitted`, `ClaimAdjudicated`, `PayerClaimRefSet`, `ClaimPaStatusResolved`, `StaffingFloorReached`, `AttestorCountChanged`) as a single interface-level event registry — so Ormi subgraph schema generation couples to the interface ABI rather than the implementation?

**Key findings:**
- **NO to flat omnibus registry — use Uniswap v3 dedicated sub-interface pattern.** Uniswap v3 publishes a standalone `IUniswapV3PoolEvents.sol` (9 events, zero functions) aggregated into `IUniswapV3Pool` via interface inheritance. Aave v3 uses a flat pattern; OZ IERC20/IGovernor declare events inline. Both are valid — the sub-interface pattern is correct when events span logically separate contracts. ([IUniswapV3Pool.sol](https://github.com/Uniswap/v3-core/blob/main/contracts/interfaces/IUniswapV3Pool.sol); [IUniswapV3PoolEvents.sol](https://github.com/Uniswap/v3-core/blob/main/contracts/interfaces/pool/IUniswapV3PoolEvents.sol))
- **Recommended architecture: `IClaimsEvents.sol` + `IClaimsAdjudicator is IClaimsEvents`.** `IClaimsEvents` declares only the four `ClaimsAdjudicator`-emitted events: `ClaimSubmitted`, `ClaimAdjudicated`, `PayerClaimRefSet`, `ClaimPaStatusResolved`. `StaffingFloorReached` and `AttestorCountChanged` remain in `ISBTRegistry` (confirmed by prior 2026-05-16 research). Mixing SBTRegistry events into `IClaimsAdjudicator` would create a misleading cross-contract ABI boundary.
- **Ormi subgraph requires events in the ABI artifact bound to `subgraph.yaml`.** The Graph binds each data source to an explicit ABI file; events absent from that ABI are not indexable by `graph codegen`-generated handlers, regardless of whether they appear in the implementation. ([The Graph subgraph manifest docs](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/)) This means the Ormi subgraph must use **two separate data sources**: one bound to `IClaimsAdjudicator` ABI (claim lifecycle), one bound to `ISBTRegistry` ABI (attestor management).
- **Declaring events in a Solidity interface has zero runtime gas cost.** Gas is charged on `emit` execution (LOG0–LOG4), not on declaration. ([Alchemy Solidity events](https://www.alchemy.com/docs/solidity-events); [Solidity docs](https://docs.soliditylang.org/en/latest/contracts.html))
- **Events do not affect ERC-165 `interfaceId` computation.** ERC-165 XORs function selectors only; events have no selector. Adding/removing event declarations from `IClaimsAdjudicator` does not alter the computed `interfaceId` or break ERC-165 tooling.

**Design implication:** Introduce `interfaces/IClaimsEvents.sol` declaring `ClaimSubmitted`, `ClaimAdjudicated`, `PayerClaimRefSet`, `ClaimPaStatusResolved`. `IClaimsAdjudicator` inherits `IClaimsEvents`. `ISBTRegistry` retains `AttestorCountChanged` and `StaffingFloorReached`. Ormi subgraph `subgraph.yaml` uses two data sources, each bound to its contract's interface ABI. The `IClaimsAdjudicator` interface ABI (not implementation ABI) is the canonical artifact for hospital integration engineers.

**Findings file:** [docs/research/somnia/iclaimsadjudicator-event-registry-interface-design.md](somnia/iclaimsadjudicator-event-registry-interface-design.md)

**Next priority questions:**
1. Should `IClaimsEvents.sol` be published as a standalone npm artifact in `@cliqueue/contracts/interfaces` — so Ormi subgraph developers import only the events interface without pulling the full contract ABI?
2. Should the Ormi subgraph manifest use the `IClaimsAdjudicator` interface ABI or the Foundry implementation ABI — and does the Foundry ABI contain artifacts that break `graph codegen`?
3. Should a `ICliqueueEvents.sol` documentation-only top-level interface aggregate all on-chain events (claims + SBTRegistry) for hospital integration engineer reference, without creating a cross-contract inheritance chain?

---

## 2026-05-17 — `ClaimSubmitted` single combined amendment confirmed: LOG4 + 32-byte paAuthHash = 28,800 gas on Somnia; uint8 indexed paStatus enables topic[3] filtering; bytes32(0) sentinel is ABI-valid; one-shot amendment is the Solidity event stability canon

**Question investigated:** Should the `ClaimSubmitted` event spec be formally amended in a single change to include both `uint8 indexed paStatus` and `bytes32 paAuthHash` (non-indexed, zero when paStatus ≠ 0x02 SATISFIED) — or should these be two sequential amendments?

**Key findings:**
- **YES — single combined amendment is correct and required.** Event signatures are the on-chain API surface; each change breaks indexers, subgraphs, and off-chain consumers. The Solidity canonical practice (Solidity docs, production DeFi) is to stabilize event signatures early with the full intended field set. Two sequential amendments would break the subgraph schema twice. ([Solidity events doc](https://docs.soliditylang.org/en/latest/contracts.html#events); [Solidity ABI spec](https://docs.soliditylang.org/en/latest/abi-spec.html#events))
- **Correct amended signature: `event ClaimSubmitted(bytes32 indexed claimId, bytes32 indexed claimHash, uint8 indexed paStatus, bytes32 paAuthHash)`.** LOG4 (4 topics: sig + claimId + claimHash + paStatus) + 32-byte non-indexed data. `topic3 = bytes32(uint256(paStatus))` (left-padded uint8); `data = abi.encode(paAuthHash)`. ([Solidity ABI encoding](https://docs.soliditylang.org/en/latest/abi-spec.html#events))
- **Somnia gas: 28,800 gas.** `3200 + 5120 × 4 + 160 × 32 = 28,800 gas`. Delta over the prior LOG2 baseline (13,440 gas) is +15,360 gas (~$0.000094/emission). Negligible. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))
- **`uint8 indexed paStatus` enables `eth_subscribe` topic[3] filtering.** Payer agents can subscribe `topics: [sig, null, null, bytes32(uint256(0x03))]` to receive only AUTH_NEEDED (0x03) claims — the primary triage filter for payer back-office automation. ([Ethereum JSON-RPC eth_getLogs](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs))
- **`bytes32(0)` sentinel for paAuthHash is ABI-valid and indexer-safe.** Cryptographically negligible ambiguity (HMAC-SHA256 output is never zero in practice). Ormi/Graph subgraph mappings branch on the status field before interpreting paAuthHash. NatSpec must document: "paAuthHash MUST be bytes32(0) for paStatus ≠ 0x02 (SATISFIED); `require(paStatus == 0x02 ? paAuthHash != bytes32(0) : paAuthHash == bytes32(0))` enforced in `submitClaim()`." ([The Graph event-driven indexing](https://thegraph.com/blog/event-driven-development-unlocking-optimized-dapps-and-subgraphs/))
- **Gas is paid for 32-byte non-indexed data even when paAuthHash = bytes32(0).** 5,120 gas per-emission for the 32 non-indexed data bytes. The cost is justified by schema stability: a variable-shape event (no paAuthHash field when not SATISFIED) would save 5,120 gas/claim but break fixed ABI decoding for off-chain consumers.

**Design implication:** Amend `ClaimSubmitted` once to `event ClaimSubmitted(bytes32 indexed claimId, bytes32 indexed claimHash, uint8 indexed paStatus, bytes32 paAuthHash)`. Enforce `require(paStatus == 0x02 ? paAuthHash != bytes32(0) : paAuthHash == bytes32(0))` in `submitClaim()`. Declare in `IClaimsAdjudicator`. Ormi subgraph entity indexes `paStatus` as enum and `paAuthHash` as nullable Bytes (null ↔ bytes32(0)). Gas: 28,800/emission.

**Findings file:** [docs/research/somnia/claim-submitted-event-combined-amendment-pastatus-paauthash.md](somnia/claim-submitted-event-combined-amendment-pastatus-paauthash.md)

**Next priority questions:**
1. Should `IClaimsAdjudicator` declare all primary events (`ClaimSubmitted`, `ClaimAdjudicated`, `PayerClaimRefSet`, `ClaimPaStatusResolved`, `StaffingFloorReached`) as a single interface-level event registry — so Ormi subgraph schema generation couples to the interface ABI rather than the implementation?
2. Should the Ormi subgraph entity for `ClaimSubmitted` index `paStatus` as a queryable enum field and `paAuthHash` as nullable `Bytes` (null when zero) — enabling per-PA-status claim queries without full event scan?
3. Should cliqueue's pre-deployment canary suite include a `ClaimSubmitted` topic[3] filter verification test on Somnia mainnet (chain ID 5031) — confirming uint8 indexed values are correctly padded to 32-byte topics and filterable?

---

## 2026-05-17 — `PayerClaimRefSet` event confirmed; LOG2 = 18,560 gas on Somnia; 835 adapter must cache CLP07 hash locally from event; eliminates cold-SLOAD from reconciliation hot path

**Question investigated:** Should `ClaimsAdjudicator` emit a `PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)` event at adjudication so the off-chain 835 adapter can cache the CLP07 hash without reading contract state at settlement time, avoiding the 1M cold-SLOAD on the reconciliation path?

**Key findings:**
- **YES — emit `PayerClaimRefSet` at adjudication.** Production DeFi (Uniswap v3, Aave v3, Compound, MakerDAO) universally emit dedicated events for deferred field updates; off-chain indexers treat event logs as the primary distribution layer, never storage reads. ([ConsenSys guide to Ethereum events](https://consensys.io/blog/guide-to-events-and-logs-in-ethereum-smart-contracts); [RareSkills Solidity Events](https://rareskills.io/post/ethereum-events))
- **Somnia LOG2 gas cost is 18,560 gas** for `PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)`. Formula: `3200 + (5120 × 2 topics) + (160 × 32 bytes) = 18,560 gas`. This is ~13× the Ethereum baseline of 1,381 gas but negligible relative to the 200K gas slot write. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))
- **CLP07 is the payer's ICN** (internal control number) assigned during adjudication — not a provider-side value. CMS companion guides confirm CLP07 as the ICN returned in every 835 remittance; payer companion guides treat it as mandatory. ([X12 RFI-2370](https://x12.org/resources/requests-for-interpretation/rfi-2370-plb0302-usage-clp01-and-clp07); [CMS 835 companion guide](https://www.ctdssmap.com/CTPortal/portals/0/StaticContent/Publications/835_HC_Claim_Pmt-Advice_CG_V3.0.pdf))
- **Caching CLP07 locally on 835 receipt is the universal industry practice.** No standard (CAQH CORE, Da Vinci CDex, FHIR R4) mandates a specific schema, but every production 835 adapter persists `(claimId → payerICN)` in a local store immediately upon 835 receipt. The well-known failure mode for non-caching adapters is "reconciliation-liveness failure" — blocked settlement when the payer portal or API is unavailable.
- **Event-driven caching eliminates the 1M cold-SLOAD from the reconciliation hot path.** The adapter subscribes to `PayerClaimRefSet` via Somnia WebSocket `eth_subscribe`, caches `claimId → payerClaimRef` in the hospital-local PostgreSQL store, and performs O(1) local lookups at settlement time. Cache backfill on reconnect uses `eth_getLogs(PayerClaimRefSet, fromBlock=lastCheckpoint)` — identical to the dispute-listener reconnect pattern.

**Design implication:** `ClaimsAdjudicator` emits `event PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)` at adjudication (18,560 gas, LOG2). The 835 adapter caches `claimId → payerClaimRef` on event receipt, never reads contract state for the reconciliation hot path. `PayerClaimRefSet` should be declared in `IClaimsAdjudicator` for Ormi subgraph binding. 835 adapter fallback on cache miss: `eth_call getClaim(claimId)` + warm cache entry.

**Findings file:** [docs/research/agreement-layer/payerclaimrefset-event-835-adapter-caching.md](agreement-layer/payerclaimrefset-event-835-adapter-caching.md)

**Next priority questions:**
1. Should `PayerClaimRefSet` carry `bytes32 indexed payerClaimRef` as a second indexed topic (LOG3, 23,680 gas) — enabling payers to subscribe to their own ICN-space without a provider-side lookup, at +5,120 gas per emission?
2. Should `IClaimsAdjudicator` declare `PayerClaimRefSet` alongside `ClaimSubmitted` and `ClaimAdjudicated` — binding Ormi subgraph definitions to the interface rather than the implementation?
3. Should the hospital BAA's 835 Adapter exhibit include the `PayerClaimRefSet` cache schema as a normative artifact?

---

## 2026-05-17 — Ormi subgraph UUPS upgrade workflow: no atomic ABI-upgrade-with-history-preservation; grafting is not recommended for The Graph Network production; correct production pattern is dual data sources + event renaming; full reindex is the safe default for breaking ABI changes

**Question investigated:** When `ClaimsAdjudicator` is upgraded via UUPS proxy, does the Ormi hosted subgraph environment support an atomic ABI-upgrade + subgraph-redeploy workflow that preserves all indexed history across implementation upgrades — or must the hospital integration team stand up a new subgraph deployment and migrate historical queries?

**Key findings:**
- **No atomic ABI-upgrade-with-history-preservation exists.** The Graph's deployment model is immutable per deployment ID (IPFS hash of manifest). Changing the ABI or mappings always creates a new deployment. There is no in-place "swap ABI, keep deployment ID" mechanism. ([The Graph: Versioning Subgraphs](https://thegraph.com/docs/en/subgraphs/developing/creating/versioning-subgraphs/); [The Graph: Deploying a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/creating/deploying-a-subgraph/))
- **Grafting is not recommended for production or The Graph Network.** The Graph's grafting feature (`graft: { base: <deploymentId>, block: <N> }`) copies the old deployment's entity store to a new deployment up to a chosen block and continues indexing with new mappings. Official docs state: "It is recommended to not use grafting for Subgraphs published to The Graph Network" and "Grafting is not recommended for Subgraphs intended for The Graph's decentralized network (mainnet)" because it "can complicate indexing and may not be fully supported by all Indexers." Grafting is appropriate only for development hotfixes. ([The Graph: Grafting Guide](https://thegraph.com/docs/en/subgraphs/guides/grafting/); [The Graph: Grafting Hotfix Best Practice](https://thegraph.com/docs/en/subgraphs/best-practices/grafting-hotfix/))
- **Ormi has no documented upgrade-specific capability beyond standard graph-node behavior.** Ormi is The Graph-compatible (same CLI and `subgraph.yaml` spec). Ormi's public docs contain no special UUPS upgrade workflow, grafting extension, or in-place ABI replacement feature. Standard graph-node semantics apply. ([Ormi docs](https://ormilabs.com/docs/welcome))
- **Correct production pattern for UUPS upgrades that change event signatures: dual data sources + event renaming.** Recommended approach: (1) keep the stable proxy address as the indexed contract address; (2) add a second `dataSource` in `subgraph.yaml` using the new ABI starting at the upgrade block; (3) rename conflicting events in the ABI to distinct handler names (e.g., `ClaimSubmittedV2` vs `ClaimSubmitted`) to avoid handler collision; both pre- and post-upgrade events are indexed in one subgraph deployment. ([Chainstack: Subgraph for Upgradeable Proxy Contracts](https://docs.chainstack.com/docs/creating-a-subgraph-for-upgradeable-proxy-contracts-a-developers-guide); [The Graph: Subgraph Manifest](https://thegraph.com/docs/en/subgraphs/developing/creating/manifest/))
- **UUPS upgrades that do NOT change event signatures require no subgraph change.** If `ClaimsAdjudicator` is upgraded without altering any event signatures (e.g., internal logic bug fix), the existing subgraph continues to index correctly with no action required.
- **Full reindex from genesis is the safe default for breaking ABI changes.** Deploying a new subgraph from block 0 with the new ABI is always correct. On Somnia (high TPS, fast finality), reindex is faster than on Ethereum. The cost is temporary query unavailability during sync — acceptable for planned protocol upgrades with advance notice.
- **Grafting schema compatibility rules (reference only — not for production use):** Grafted schemas may add nullable fields, add/remove entity types, and change enum values, but may not change field types or remove non-nullable fields. Even where schema-compatible, grafting is unsuitable for production network deployments per The Graph's own guidance.

**Design implication:** The `ClaimsAdjudicator` UUPS upgrade runbook must document two paths: (A) Additive upgrades (new events, same existing event signatures) — use dual data source pattern: increment implementation version, add new `dataSource` starting at upgrade block, keep existing data source for pre-upgrade history, deploy as a new subgraph version; (B) Breaking upgrades (changed existing event signatures) — deploy new subgraph from genesis with new ABI, publish advance notice equal to at least the `TimelockController` min-delay window (48 hours) so hospital integration engineers can prepare. Grafting is not used in production at any stage. cliqueue's deployment runbook must include an explicit "Subgraph Upgrade Procedure" section.

**Findings file:** [docs/research/somnia/ormi-subgraph-uups-upgrade-workflow.md](somnia/ormi-subgraph-uups-upgrade-workflow.md)

**Next priority questions:**
1. Should cliqueue's deployment runbook specify a minimum advance-notice window (48 hours, matching the TimelockController min-delay) before a `ClaimsAdjudicator` UUPS upgrade that changes event signatures — giving hospital integration engineers time to prepare the updated subgraph before the upgrade executes?
2. Should the Ormi subgraph `subgraph.yaml` use dynamic data source `templates` or static `dataSources` for the pre/post-upgrade event split — and does the Ormi hosted environment support dynamic data source templates?
3. Should cliqueue publish a versioned `subgraph.yaml` artifact in the contracts repo alongside the ABI files — so hospital integration engineers can deploy the updated subgraph without writing the dual-source YAML from scratch?

---

## 2026-05-17 — payerClaimRef slot initialization: Approach B (leave uninitialized, write non-zero at adjudication); zero-write at submit is gas-equivalent but spurious; Somnia charges 200K for cold non-existent non-zero SSTORE

**Question investigated:** How should the `payerClaimRef` bytes32 slot in `ClaimsAdjudicator`'s `Claim` struct be handled when the payer has not yet assigned CLP07 at Submitted state — write a bytes32(0) placeholder in `submitClaim()` (Approach A) or leave it uninitialized until `adjudicateClaim()` writes the actual HMAC(CLP07) hash (Approach B)?

**Key findings:**
- **EVM zero-value SSTORE semantics (Ethereum baseline):** Writing `bytes32(0)` to a never-written slot does not create a persistent "existing key" in the storage trie — the EVM treats zero as absent. So Approach A (zero placeholder at submit) leaves the slot non-existent in the trie, exactly like Approach B. ([EIP-3529](https://eips.ethereum.org/EIPS/eip-3529); [EIP-2200](https://eips.ethereum.org/EIPS/eip-2200))
- **EIP-2929 warmth is per-transaction, not per-block.** Writing zero in `submitClaim()` provides no cross-block warming benefit for `adjudicateClaim()` in a later block. ([EIP-2929](https://eips.ethereum.org/EIPS/eip-2929))
- **Somnia IceDB critical distinction:** Cold non-existent slot written to **zero** = 0 gas charge (only requires 1M gas buffer). Cold non-existent slot written to **non-zero** = +200,000 gas. Cold existing key = +1,000,000 gas. The zero-write in Approach A is free but spurious. The non-zero write at adjudication costs 200,000 gas regardless of whether A or B is used. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))
- **Approach A and B are gas-equivalent** for the adjudication write and dispute SLOAD. Approach A adds a free-but-spurious SSTORE at submission with no benefit.
- **DeFi canonical pattern is Approach B:** Uniswap v3 `Position.Info` and Aave v3 `ReserveData` leave deferred fields at zero (never-written) until the first meaningful write. ([Uniswap v3 Position.sol](https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Position.sol); [Aave v3 DataTypes.sol](https://github.com/aave/aave-v3-core/blob/master/contracts/protocol/libraries/types/DataTypes.sol))
- **Dispute cold-SLOAD is unavoidable regardless of approach:** Aged `payerClaimRef` reads in dispute resolution always pay the 1M cold existing-key SLOAD fee. The hot-tier dispute contract design (prior research) remains the correct mitigation.

**Design implication:** `payerClaimRef` uses Approach B — do not write `bytes32(0)` in `submitClaim()`; write `HMAC-SHA256(CLP07)` only at `adjudicateClaim()` (200,000 gas cold non-existent non-zero SSTORE). The off-chain 835 adapter must handle `payerClaimRef == bytes32(0)` as "CLP07 not yet assigned." A `PayerClaimRefSet` event at adjudication allows the adapter to cache CLP07 hash without a cold-SLOAD at settlement time.

**Findings file:** [docs/research/agreement-layer/payerclaimref-slot-initialization-strategy.md](agreement-layer/payerclaimref-slot-initialization-strategy.md)

**Next priority questions:**
1. Should `ClaimsAdjudicator` emit a `PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)` event at adjudication so the off-chain 835 adapter can cache the CLP07 hash without a cold-SLOAD?
2. Should the `Claim` struct's Slot 0 pack a `hasPayerRef` bool alongside `status` to allow O(1) determination of whether `payerClaimRef` has been set without incurring a cold-SLOAD of Slot 6?
3. At what Somnia LRU cache occupancy does Slot 6 stay within the 128M-slot LRU between submission and adjudication for typical hospital workflows?

---

## 2026-05-17 — Somnia (chain ID 5031) is native in viem@2.49.2; Changesets confirmed correct for @cliqueue/contracts; no custom chain definition needed in wagmi.config.ts

**Question investigated:** (1) Does wagmi's built-in viem chain list include Somnia (chain ID 5031), or must `wagmi.config.ts` define a custom chain object? (2) Should `@cliqueue/contracts` use Changesets or manual `npm version` + `npm publish` for its infrequent Solidity release cadence?

**Key findings:**
- **Somnia mainnet (`somnia`, chain ID 5031) and Somnia Testnet (`somniaTestnet`, chain ID 50312) are natively present in viem@2.49.2.** Verified against the wagmi chains reference page (`wagmi.sh/core/api/chains`). Import: `import { somnia, somniaTestnet } from 'viem/chains'`. No custom `defineChain` needed in `wagmi.config.ts`. ([wagmi chains docs](https://wagmi.sh/core/api/chains))
- **`@cliqueue/contracts` should NOT export a `SOMNIA_CHAIN` constant.** Since viem ships the native chain objects, exporting a duplicate would create version-skew risk. The contracts repo's README should instruct hospital engineers to import from `viem/chains` directly.
- **Use Changesets (not manual `npm version`) for `@cliqueue/contracts`.** OpenZeppelin Contracts (v5.6.1) uses `@changesets/cli` as a devDependency alongside a custom `scripts/release/version.sh`. This is the DeFi-standard pattern for npm-published Solidity packages, even at low cadence. Changesets accumulates PR-level semver intents, generates CHANGELOG.md, and produces a reviewable release PR — all of which are valuable for audit-gated Solidity releases. ([OpenZeppelin contracts package.json](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/package.json); [Changesets](https://github.com/changesets/changesets))
- **Single-package Changesets config is sufficient.** A minimal `.changeset/config.json` with `changeset add` on each ABI-changing PR, plus a GitHub Actions workflow calling `changeset publish` after `forge build` + `wagmi generate`, is the correct setup. No Turborepo or workspace needed for a standalone contracts repo.

**Design implication:** `wagmi.config.ts` in `@cliqueue/contracts` uses `import { somnia, somniaTestnet } from 'viem/chains'` natively. The Foundry contracts repo uses Changesets for versioning. The published README links to `viem/chains` for chain config.

**Findings file:** [docs/research/market/cliqueue-monorepo-package-architecture.md](market/cliqueue-monorepo-package-architecture.md)

**Next priority questions:**
1. Should `@cliqueue/contracts` `package.json` include `"publishConfig": { "access": "public" }` for the scoped npm package — and does omitting it cause npm to reject `changeset publish` for a free-org scoped package?
2. Should cliqueue pin `"viem": ">=2.49.2"` in `peerDependencies` of `@cliqueue/contracts` to guarantee the native Somnia chain object is available?
3. Does the `@cliqueue/contracts` CI publish job need a Somnia RPC endpoint for `forge build`, or does Foundry compile purely offline from Solidity source?

---

## 2026-05-17 — @cliqueue/contracts separate-repo decision confirmed: wagmi CLI Foundry plugin is production-ready; DeFi precedent supports split; commit generated ABI bindings; per-chain address map pattern

**Question investigated:** Should `@cliqueue/contracts` (ABI types + wagmi-generated hooks for `ClaimsAdjudicator` and `ISBTRegistry`) be co-located in the same `@cliqueue/*` pnpm monorepo as the FHIR/EDI packages, or kept in a separate repository aligned with the Solidity release cycle?

**Key findings:**
- **Separate repo is the correct architecture.** Uniswap (v3-core vs v3-sdk), Aave (aave-v3-core vs aave-js), Compound (compound-protocol vs compound-js), and OpenZeppelin (Contracts vs Defender tooling) all separate Solidity repos from TypeScript SDK repos. The pattern is consistent across production DeFi projects: contract repos move on audit-gated cadences; SDK repos move on a regular development cadence. ([Uniswap v3-core](https://github.com/Uniswap/v3-core); [Aave v3-core](https://github.com/aave/aave-v3-core); [Compound protocol](https://github.com/compound-finance/compound-protocol); [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts))
- **The wagmi CLI Foundry plugin is production-ready.** It reads Foundry `forge build` artifacts from `out/` and generates typed TypeScript ABI bindings and viem/wagmi hooks into `src/generated.ts`. Supports watch mode, glob include/exclude patterns, broadcast detection for deployed addresses, name-collision prefixing. No beta designation. ([wagmi CLI Foundry plugin](https://wagmi.sh/cli/api/plugins/foundry))
- **Commit generated `src/generated.ts` — do not regenerate-only-in-CI for a published package.** The wagmi ecosystem norm is to check in the generated output as a versioned artifact alongside the ABI. CI runs `wagmi generate` + `git diff --exit-code` to validate; publishing is gated on artifact diff, not on unrelated TS changes. ([wagmi CLI getting started](https://wagmi.sh/cli/getting-started); [TypeChain](https://github.com/dethcrypto/TypeChain))
- **Per-chain address map in `wagmi.config.ts` is canonical.** Single contract declaration with `address: { [somnia.id]: '0x...', [somniaTestnet.id]: '0x...' }` generates one artifact supporting both chains with chain-aware hook/client code. ([wagmi CLI multi-chain](https://wagmi.sh/cli/getting-started))
- **ABI version pinning: FHIR/EDI consumer packages list `@cliqueue/contracts` as a `devDependency` pinned to `^major`.** Contract ABI breaking changes (changed event signatures, new function parameters) are a major version bump. Consumer packages do not ship ABI hooks to hospital app consumers — only import types at build time.
- **Foundry + pnpm coexistence is low-friction when repos are separate.** Co-location risks pnpm strict-symlink conflicts with wagmi codegen Node scripts that assume flat `node_modules` hoisting. Foundry itself uses `lib/` not `node_modules` and is unaffected, but the JS tooling layer is the friction point. Separate repos eliminate this class of interference.

**Design implication:** `@cliqueue/contracts` lives in a separate Foundry-based repository with its own Changesets/publish workflow. The FHIR/EDI pnpm monorepo (`fhir-types`, `pa-lifecycle`, `cds-hooks-client`, `cda-attachments`) lists `@cliqueue/contracts` as an external npm dependency pinned by semver. The contracts repo uses wagmi CLI Foundry plugin for codegen, commits `src/generated.ts`, and publishes to npm on every deployment-tagged Solidity release.

**Findings file:** [docs/research/market/cliqueue-monorepo-package-architecture.md](market/cliqueue-monorepo-package-architecture.md)

**Next priority questions:**
1. Should cliqueue's Foundry contracts repo use Changesets for versioning or a simpler manual `npm version` + `npm publish` tied to deployment tags?
2. Should `@cliqueue/contracts` export a `SOMNIA_CHAIN` viem chain definition (chain ID 5031) alongside the generated ABI hooks?
3. Does wagmi's built-in chain list include Somnia (chain ID 5031), or must cliqueue define a custom chain object in `wagmi.config.ts`?

---

## 2026-05-17 — @cliqueue/* monorepo architecture: pnpm workspaces + shared @cliqueue/fhir-types confirmed; no Da Vinci npm constants package exists; publish all four packages

**Question investigated:** Should `@cliqueue/pa-lifecycle`, `@cliqueue/cds-hooks-client`, and `@cliqueue/cda-attachments` be published as a `@cliqueue/*` pnpm monorepo with a shared internal `@cliqueue/fhir-types` constants package?

**Key findings:**
- **pnpm workspaces with `workspace:*` protocol is confirmed best-practice for 3–4 TypeScript packages publishing to npm.** Internal refs auto-convert to pinned semver on pack. ([pnpm workspaces](https://pnpm.io/workspaces))
- **A shared `@cliqueue/fhir-types` package (not duplicated constants) is correct.** Medplum's 26-package monorepo uses exactly this pattern — `@medplum/fhirtypes` is a distinct published package depended on by `@medplum/core`, `@medplum/react`, etc. ([medplum/medplum](https://github.com/medplum/medplum); [npm @medplum/fhirtypes](https://www.npmjs.com/package/@medplum/fhirtypes))
- **`@cliqueue/fhir-types` must be published (not workspace-only)** because all three consumer packages are published. Workspace-only shared packages break downstream `npm install` chains.
- **No Da Vinci CRD/CDex TypeScript constants npm package exists** — confirmed by npm and GitHub search. `@davinci/core` is an HP REST framework (unrelated to HL7). Must hand-roll. ([HL7-DaVinci GitHub](https://github.com/HL7-DaVinci))
- **`@medplum/fhirtypes` should be a `peerDependency`** (not `dependency`) of cliqueue consumer packages to avoid bundling the full FHIR type tree.
- **Toolchain: pnpm workspaces + Changesets + TypeScript project references.** Turborepo optional. Nx is overkill for 4 packages. ([Changesets](https://github.com/changesets/changesets); [TS project references](https://www.typescriptlang.org/docs/handbook/project-references.html))

**Design implication:** Four packages (`cds-hooks-client`, `pa-lifecycle`, `cda-attachments`, `fhir-types`) form a single pnpm monorepo. `@cliqueue/fhir-types` is the shared-constants root package, published alongside the others. Changesets manages independent versioning. This is the fifth `@cliqueue/*` package group alongside `@cliqueue/contracts`.

**Findings file:** [docs/research/market/cliqueue-monorepo-package-architecture.md](market/cliqueue-monorepo-package-architecture.md)

**Next priority questions:**
1. Should `@cliqueue/contracts` (ABI types) be included in the same monorepo or kept separate per Solidity release cycle?
2. Should `@cliqueue/fhir-types` export a shared `fromCoverageInformationTask()` parser used by both `cds-hooks-client` and `pa-lifecycle`?
3. Should the monorepo adopt Turborepo from day one or defer until package count exceeds 6?

---

## 2026-05-17 — HL7 CDA R2 TypeScript npm ecosystem: no dedicated library; @medplum/ccda is closest but CCD-only; hand-roll @cliqueue/cda-attachments is confirmed third ecosystem gap

**Question investigated:** Does any open-source TypeScript or Node.js npm library support HL7 CDA R2 document generation for X12 275 claims attachment payloads under CMS-0053-F — or must cliqueue hand-roll a CDA template generator?

**Key findings:**
- **No dedicated open-source TypeScript/Node.js npm library exists for HL7 CDA R2 document generation in the X12 275 / CMS-0053-F attachment context.** Broad search across npm and GitHub returned no package whose stated purpose is generating HL7 CDA R2 XML for claims attachments. ([npm CDA search](https://www.npmjs.com/search?q=CDA))
- **`@medplum/ccda` is the closest existing library** — actively maintained, ONC-certified, provides `convertFhirToCcda()` / `convertCcdaToXml()`. But it is scoped to CCD/Patient Summary (IPS bridge), not arbitrary attachment document types required under CMS-0053-F (consult notes, operative notes, lab results, imaging). Not X12-275-specific, not CMS-0053-F validated. ([Medplum C-CDA docs](https://www.medplum.com/docs/integration/c-cda); [npm @medplum/ccda](https://www.npmjs.com/package/@medplum/ccda))
- **`hl7.cda.template` (v1.0.0, CC0-1.0, March 5, 2026) and `hl7.cda.uv.core` are FHIR package registry artifacts** (IG tooling), not app-level npm generators. ([libraries.io](https://libraries.io/npm/hl7.cda.template))
- **Java (MDHT / Eclipse EMF) is the dominant CDA R2 tooling ecosystem; no maintained TypeScript port exists.** The HL7 `CDA-core-2.0` repo publishes schemas and IG artifacts, not a TypeScript SDK. ([HL7/CDA-core-2.0](https://github.com/HL7/CDA-core-2.0))
- **Recommended hand-roll approach: `xmlbuilder2`** for XML serialization with CDA R2 namespace control (`urn:hl7-org:v3`), ordered elements, `xsi:type` attributes, and full CDA header metadata per C-CDA R2.1 templates.
- **Confirmed third TypeScript ecosystem gap**: `@cliqueue/cda-attachments` joins `@cliqueue/cds-hooks-client` and `@cliqueue/pa-lifecycle` as required hand-rolled packages with no upstream dependency.

**Design implication:** `PayerAdapterInterface.ClaimsAttachmentAdapter` must be implemented by a hand-rolled `@cliqueue/cda-attachments` module using `xmlbuilder2`, supporting per-attachment-type C-CDA R2.1 section scaffolding (indexed by template OID) and serialization to XML for X12 275 payload. `@medplum/ccda` may be a `devDependency` for test fixture generation only.

**Findings file:** [docs/research/agreement-layer/hl7-cda-r2-typescript-npm-ecosystem-x12-275.md](agreement-layer/hl7-cda-r2-typescript-npm-ecosystem-x12-275.md)

**Next priority questions:**
1. Should `@cliqueue/cda-attachments` support only the CMS-0053-F attachment types (medical records, imaging, clinical notes, telemedicine, lab results) or build a generic C-CDA R2.1 template engine extensible for any LOINC document type?
2. Should `@cliqueue/cda-attachments` be validated against CDA R2 Schematron rules via a Java-based validator in CI — and should cliqueue publish a test fixture set of known-valid CDA attachments?
3. Does `@medplum/ccda`'s `convertFhirToCcda()` produce a valid C-CDA R2.1 document usable as a base template for non-patient-summary attachment types — or is the IPS bridge hardcoded and incompatible with claims-attachment document types?

---

## 2026-05-17 — CMS-0053-F finalizes HIPAA claims attachments via X12 275/277 + HL7 CDA (not FHIR CDex); EDI adapter confirmed durable through May 2028; `PayerAdapterInterface` seam is required architecture

**Question investigated:** Has CMS published a CDex Attachments NPRM or final rule — and does the regulatory timeline confirm whether cliqueue's EDI 837/835 adapter is a temporary bridge or a permanent design element, and whether a `PayerAdapterInterface` forward-compatibility seam is warranted?

**Key findings:**
- **CMS-0053-F finalized March 24, 2026 (Federal Register 2026-05676)** — first-ever HIPAA claims attachments standard. Effective May 26, 2026; compliance deadline **May 26, 2028**. Mandates **X12 277 + X12 275 + HL7 CDA** for electronic claims attachment exchange. Covers medical records, imaging, clinical notes, telemedicine documentation, and lab results accompanying claims. ([Federal Register 2026-05676](https://www.federalregister.gov/documents/2026/03/24/2026-05676/administrative-simplification-adoption-of-standards-for-health-care-claims-attachments-transactions); [CMS fact sheet](https://www.cms.gov/newsroom/fact-sheets/administrative-simplification-adoption-standards-health-care-claims-attachments-transactions))
- **CMS-0053-F uses X12/CDA — FHIR CDex is explicitly not adopted.** Da Vinci CDex is not incorporated by reference; prior authorization attachments are also excluded from this rulemaking scope. ([CMS fact sheet](https://www.cms.gov/newsroom/fact-sheets/administrative-simplification-adoption-standards-health-care-claims-attachments-transactions); [Reed Smith](https://www.reedsmith.com/our-insights/blogs/viewpoints/102mo5z/cms-new-final-rule-on-electronic-claims-attachments-what-it-means-for-radiology))
- **Da Vinci CDex is STU 2.1.0** (published 2025-02-11 on hl7.org), ballot status "Trial-use," not incorporated in any CMS rule. Voluntary payer adoption (HL7 Trebuchet pilots) ongoing but no named major payer has CDex in production for claims attachments. ([HL7 CDex](https://hl7.org/fhir/us/davinci-cdex/))
- **No FHIR CDex attachments NPRM found in CMS 2024–2026 Unified Regulatory Agenda.** The attachments rulemaking concluded via the X12/CDA path with CMS-0053-F. (Weakly sourced: semiannual Unified Agenda entries are periodically updated; absence confirmed to best available information.)
- **EDI 837/835 adapter is a durable, long-term requirement through at least May 2028** — not a temporary bridge. Combined with CMS-0057-F's Jan 2027 Prior Auth FHIR API deadline (which covers prior-auth only, not claim submission), the X12 847/835 + X12 275/277 + CDA stack is the confirmed integration target for MVP and beyond.
- **`PayerAdapterInterface` with pluggable CDA/X12 + FHIR CDex extension seam is the correct architecture.** Encapsulate X12 837P/I, 835, 275/277, and CDA behind a versioned interface boundary; expose a FHIR CDex extension point for optional per-payer adoption post-2028 without touching the on-chain settlement layer.

**Design implication:** cliqueue's EDI adapter spec must formally define a `PayerAdapterInterface` abstract class with sub-interfaces for `ClaimSubmissionAdapter` (837), `RemittanceAdapter` (835), and `ClaimsAttachmentAdapter` (275/277 + CDA), all versioned alongside the on-chain ABI. The attachment sub-interface is the new addition — previously the research only confirmed 837/835 as mandatory; CMS-0053-F adds 275/277 + CDA as a third mandatory surface with its own May 2028 compliance deadline.

**Findings file:** [docs/research/agreement-layer/fhir-payer-api-readiness-edi-replacement-timeline.md](agreement-layer/fhir-payer-api-readiness-edi-replacement-timeline.md)

**Next priority questions:**
1. Should `PayerAdapterInterface` define a `ClaimsAttachmentAdapter` sub-interface for X12 275/277 + CDA — separate from the 837 and 835 sub-interfaces — given CMS-0053-F's May 2028 compliance deadline creates a distinct implementation timeline?
2. Should cliqueue's hospital onboarding checklist include a "CMS-0053-F Attachment Compliance Exhibit" documenting the hospital's X12 275/277 + CDA readiness before first claim submission?
3. Does any open-source TypeScript library support HL7 CDA document generation for X12 275 attachment payloads — or is this another confirmed hand-roll gap (parallel to `@cliqueue/cds-hooks-client` and `@cliqueue/pa-lifecycle`)?

---

## 2026-05-17 — PaStatusEncoder TypeScript module: no Da Vinci/CRD npm primitives exist on npm; full hand-roll required; viem encodePacked is correct bytes32 derivation; @cliqueue/pa-lifecycle fills ecosystem gap

**Question investigated:** Does any production-ready TypeScript npm package provide Da Vinci CRD paStatus typed constants, authorizationNumber-to-bytes32 hashing helpers, or PAS ClaimUpdate workflow types — or must `PaStatusEncoder` / `ClaimPaLifecycle` be hand-rolled entirely?

**Key findings:**
- **No Da Vinci CRD/PAS TypeScript npm package exists.** No `davinci-crd`, `davinci-pas`, `hl7-davinci`, or equivalent on npm as of May 2026. `github.com/HL7/davinci-crd` and `github.com/HL7-Davinci/CRD` are IG source repos only — no published npm artifact. ([HL7/davinci-crd GitHub](https://github.com/HL7/davinci-crd/); [HL7-Davinci/CRD GitHub](https://github.com/HL7-Davinci/CRD))
- **`@medplum/fhirtypes` and `@types/fhir` do not export CRD extension URLs or `coveragePaDetail` ValueSet codes.** Medplum's codegen covers core FHIR resources only; the `ext-coverage-information` extension and `coveragePaDetail` ValueSet are not typed constants in any published package. ([Medplum fhirtypes](https://github.com/medplum/medplum/tree/main/packages/fhirtypes); [npm @types/fhir](https://www.npmjs.com/package/@types/fhir))
- **Confirmed viem `encodePacked` is correct for `paAuthHash` derivation:** `keccak256(encodePacked(['bytes32', 'string'], [PA_HASH_DOMAIN_SEPARATOR, authorizationNumber]))` exactly mirrors Solidity `keccak256(abi.encodePacked(bytes32, string))`. Ethers v6 equivalent: `solidityPackedKeccak256(['bytes32', 'string'], [...])`. ([viem encodePacked discussion](https://github.com/wevm/viem/discussions/596); [ethers v5 packed hashing](https://docs.ethers.org/v5/api/utils/hashing/))
- **`PaStatusEncoder` must be entirely hand-rolled.** Required exports: `PaStatus` enum (6 values including `NOT_CHECKED=0x00` and `CONDITIONAL=0x05`), `PA_HASH_DOMAIN_SEPARATOR` public constant, `derivePaAuthHash(authorizationNumber: string): Hex`, `validatePaAuthHash(paStatus, paAuthHash): void`. All four are unique to cliqueue's on-chain design.
- **`ClaimPaLifecycle` module wraps contract interactions:** `resolveConditionalStatus(claimId, resolvedStatus, authorizationNumber?)` handles both the `no-auth`/`auth-needed` path (paAuthHash = bytes32(0)) and the `satisfied` path (derives paAuthHash). No library provides this abstraction.
- **Publishing as `@cliqueue/pa-lifecycle` fills a confirmed ecosystem gap** — the first published typed CRD paStatus enum + PAS lifecycle TypeScript package on npm, parallel to the `@cliqueue/cds-hooks-client` gap documented last iteration.

**Design implication:** `PaStatusEncoder` and `ClaimPaLifecycle` must be spec'd as a single `@cliqueue/pa-lifecycle` npm package with no Da Vinci upstream dependency. The viem `encodePacked(['bytes32','string'], ...)` pattern is confirmed correct. Publishing open-source strengthens hospital onboarding and creates go-to-market collateral alongside `@cliqueue/cds-hooks-client`.

**Findings file:** [docs/research/somnia/pa-status-encoder-typescript-module-npm-ecosystem.md](somnia/pa-status-encoder-typescript-module-npm-ecosystem.md)

**Next priority questions:**
1. Should `@cliqueue/pa-lifecycle` and `@cliqueue/cds-hooks-client` be published as a monorepo (`@cliqueue/*`) with shared FHIR extension URL constants — preventing URL string drift between the two modules?
2. Should `@cliqueue/pa-lifecycle` include a `fromCoverageInformationTask(task: fhir4.Task): PaStatusResult` parser that bridges CDS Hooks client output directly to the on-chain encoder input?
3. Should `@medplum/fhirtypes` be evaluated as a `peerDependency` of `@cliqueue/pa-lifecycle` for FHIR Task/Coverage resource typing — or should cliqueue vendor only the minimal extension interfaces needed?

---

## 2026-05-17 — ClaimPaStatusResolved paAuthHash emission: Compound Timelock pattern confirms repeat-context; +5,120 gas (LOG3 64-byte → 28,800 gas); conditional-zero NatSpec guard required

**Question investigated:** Should `ClaimPaStatusResolved` emit `paAuthHash` as a non-indexed `bytes32` data field when `resolvedStatus = 0x02 (satisfied)` — adding 32 bytes and 5,120 gas — so the authorization number commitment is auditable in the resolution event itself rather than requiring auditors to correlate across `ClaimSubmitted`?

**Key findings:**
- **Compound Timelock canonical pattern confirms: resolution events SHOULD repeat creation-event context.** Both `QueueTransaction` and `ExecuteTransaction` in `Timelock.sol` carry identical field sets `(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta)` — same payload in both creation and resolution events. This is the dominant compliance-oriented governance event pattern. ([Compound Timelock.sol](https://github.com/compound-finance/compound-protocol/blob/master/contracts/Timelock.sol))
- **OZ Governor uses the OPPOSITE minimal pattern for legacy-compatibility reasons (GovernorBravo compatibility), not best practice.** `ProposalExecuted(uint256 proposalId)` carries only the ID; context must be joined from `ProposalCreated`. This is a legacy-compat choice, not a general design recommendation. ([OZ IGovernor.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/IGovernor.sol))
- **Gas delta: exactly +5,120 gas on Somnia.** LOG3 + 32-byte data (resolvedAt only) = 23,680 gas. LOG3 + 64-byte data (resolvedAt + paAuthHash) = 28,800 gas. Delta = 5,120 gas (~$0.0000315/emission). Negligible. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))
- **Correct amended signature:** `event ClaimPaStatusResolved(bytes32 indexed claimId, uint8 indexed resolvedStatus, uint256 resolvedAt, bytes32 paAuthHash)` — paAuthHash as 4th non-indexed field. LOG3 with 64 bytes non-indexed data.
- **Security: conditional-zero requires explicit `require` guard and NatSpec.** `require(resolvedStatus == 0x02 ? paAuthHash != bytes32(0) : paAuthHash == bytes32(0))` enforces the invariant. NatSpec must document: "paAuthHash is only meaningful when resolvedStatus == 0x02 (Satisfied); MUST be bytes32(0) for all other statuses." Prevents off-chain parsers from treating zero as a valid commitment on non-satisfied paths.
- **No EVM/ABI standard mandates or prohibits repetition** — the Compound Timelock pattern is the dominant precedent for compliance-oriented events. ([Solidity ABI spec](https://docs.soliditylang.org/en/latest/abi-spec.html))
- **Ormi subgraph benefit:** Indexing `ClaimPaStatusResolved` with paAuthHash in-event enables payer agents to surface the full PA resolution context (status + auth hash) without a second `eth_getLogs` query against `ClaimSubmitted`.

**Design implication:** Amend `ClaimPaStatusResolved` to `event ClaimPaStatusResolved(bytes32 indexed claimId, uint8 indexed resolvedStatus, uint256 resolvedAt, bytes32 paAuthHash)`. Enforce `paAuthHash != bytes32(0) iff resolvedStatus == 0x02` in `resolveConditionalPaStatus()`. Gas is 28,800 (LOG3 + 64-byte data), up from 23,680. Ormi subgraph for this event becomes self-contained for the `conditional → satisfied` resolution audit path.

**Findings file:** [docs/research/somnia/claim-pa-status-resolved-paauthash-emission.md](somnia/claim-pa-status-resolved-paauthash-emission.md)

**Next priority questions:**
1. Should `ClaimPaLifecycle` TypeScript module export a unified `resolveConditionalStatus(claimId, resolvedStatus, authorizationNumber?)` helper that validates the paAuthHash conditional requirement — already proposed in two prior entries; this is the trigger to formally spec the module?
2. Should the Ormi subgraph entity for `ClaimPaStatusResolved` index `paAuthHash` as a queryable field — enabling payer agents to find all `satisfied` resolutions by auth hash without full event scan?
3. Should cliqueue publish a one-page "PA Lifecycle Event Schema" in the hospital onboarding checklist documenting `ClaimSubmitted` + `ClaimPaStatusResolved` field semantics and correlation rules for payer integration engineers?

---

## 2026-05-17 — resolveConditionalPaStatus() must accept paAuthHash; conditional→satisfied goes via PAS ClaimUpdate (not $inquire); PAS authorizationNumber is item-level string; prior log entry partially incorrect

**Question investigated:** Should `resolveConditionalPaStatus()` also accept a `bytes32 paAuthHash` parameter — enabling `conditional → satisfied` resolution (payer grants PA after receiving more clinical detail) — and what is the correct PAS STU2 workflow for this path?

**Key findings:**
- **CORRECTION to prior entry:** The prior `ClaimPaStatusResolved` log entry stated "conditional resolves via PAS `$inquire`" — this is incorrect. `Claim/$inquire` is a status-query-only operation that does NOT submit new clinical information. It follows X12 278 Inquiry rules and returns the current response state. The mechanism for submitting additional clinical detail to a pended/conditional PA is `ClaimUpdate`, not `$inquire`. ([PAS `$inquire` OperationDefinition](https://build.fhir.org/ig/HL7/davinci-pas/en/OperationDefinition-Claim-inquiry.html); [PAS artifacts](https://build.fhir.org/ig/HL7/davinci-pas/en/fhirArtifacts.html))
- **The `conditional → satisfied` path is: hospital sends PAS `ClaimUpdate` → payer returns approved `ClaimUpdateResponse` with `extension:authorizationNumber`.** PAS defines `ClaimUpdate` as the mechanism for "updating a previously submitted Claim instance." The PAS Claim profile normatively requires: "Sequence numbers SHALL stay the same across all instances of the Prior Authorization, eg the Claim, ClaimResponse, ClaimUpdate, ClaimUpdateResponse." ([PAS Claim profile](https://build.fhir.org/ig/HL7/davinci-pas/StructureDefinition-profile-claim.html))
- **PAS uses `extension:authorizationNumber` (item-level, string) — distinct from `extension:previousAuthorizationNumber`.** `extension:authorizationNumber` = "A string assigned by the UMO to an authorized review outcome associated with this service item" — the PA approval identifier. `extension:previousAuthorizationNumber` = reference to an already-known auth number from a prior authorization context. The `conditional → satisfied` resolution produces a `ClaimUpdateResponse` carrying `extension:authorizationNumber`. Same underlying type as CRD `satisfied-pa-id`; same hash derivation applies: `keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, authorizationNumber))`. ([PAS ClaimResponse profile](https://build.fhir.org/ig/HL7/davinci-pas/StructureDefinition-profile-claimresponse.html); [authorizationNumber extension](https://build.fhir.org/ig/HL7/davinci-pas/branches/__default/en/StructureDefinition-extension-authorizationNumber.html))
- **`conditional → satisfied` is workflow-consistent with PAS STU2 but not normatively prescribed as a single explicit sequence.** The CRD + DTR + PAS integration pattern (CRD returns `conditional` → DTR collects clinical documentation → PAS `ClaimUpdate` → approved `ClaimUpdateResponse`) is implied by the separation of IG concerns, not mandated as a single normative path. (Weakly sourced; no canonical IG sequence diagram covers this full path.)
- **Valid terminal resolutions of `conditional` are three, not two.** Prior entry restricted valid resolutions to `auth-needed (0x03)` and `no-auth (0x01)`. The `ClaimUpdate → approved` pathway means `satisfied (0x02)` is also a valid resolution. Correct set: `{0x01 (no-auth), 0x02 (satisfied), 0x03 (auth-needed)}`.
- **Correct Solidity signature:** `resolveConditionalPaStatus(bytes32 claimId, uint8 resolvedStatus, bytes32 paAuthHash)` with guards: `require(resolvedStatus ∈ {0x01, 0x02, 0x03})` AND `require(resolvedStatus == 0x02 ? paAuthHash != bytes32(0) : paAuthHash == bytes32(0))`. Emit `ClaimPaStatusResolved(claimId, resolvedStatus, block.timestamp)` — `paAuthHash` may optionally be added as non-indexed LOG3+64-byte data (28,820 gas) for full auditability of the `satisfied` resolution.
- **PAS outcome codes use FHIR `ClaimResponse.outcome` (`queued/partial/complete/error`) not a PAS-specific approved/denied/pended enum.** "Approved" is a business interpretation of `complete`; PAS does not normatively map FHIR outcome codes to business state labels. ([PAS ClaimResponse profile](https://build.fhir.org/ig/HL7/davinci-pas/StructureDefinition-profile-claimresponse.html))

**Design implication:** Amend `resolveConditionalPaStatus()` spec: (1) add `bytes32 paAuthHash` parameter, (2) expand valid resolutions to include `0x02`, (3) enforce `paAuthHash != bytes32(0) iff resolvedStatus == 0x02`, (4) the prior log entry's reference to `$inquire` as the conditional resolution pathway must be corrected in the spec to `ClaimUpdate`.

**Findings file:** [docs/research/somnia/resolve-conditional-pa-auth-hash-parameter.md](somnia/resolve-conditional-pa-auth-hash-parameter.md)

**Next priority questions:**
1. Should `ClaimPaStatusResolved` emit `paAuthHash` as a non-indexed `bytes32` field when `resolvedStatus = 0x02` — adding 5,120 gas — so the authorization number commitment is auditable in the resolution event itself rather than requiring cross-event correlation?
2. Should the hospital BAA's "PA Conditional Resolution SLA" clause specify different time windows for `conditional → auth-needed` (no further PA work needed) vs. `conditional → satisfied` (requires DTR + ClaimUpdate round-trip)?
3. Should cliqueue's `ClaimPaLifecycle` TypeScript module export a unified `resolveConditionalStatus(claimId, resolvedStatus, authorizationNumber?)` helper that handles both the CRD `satisfied-pa-id` path and the PAS `extension:authorizationNumber` path?

---

## 2026-05-17 — ClaimPaStatusResolved event design: LOG3 follow-up is correct; conditional resolves via PAS $inquire (provider-polled, no payer push); idempotency guard on paStatus == 0x05 required; 23,680 gas on Somnia

**Question investigated:** When `paStatus = 0x05 (conditional)` is anchored in `ClaimSubmitted` and the ordering provider later supplies clinical detail for a final PA determination, should a new `ClaimPaStatusResolved(bytes32 indexed claimId, uint8 indexed resolvedStatus, uint256 resolvedAt)` event capture that resolution on-chain — and what is the correct Solidity design?

**Key findings:**
- **CRD STU2.1 does not define a `conditional` resolution callback.** `conditional` means the payer cannot determine PA requirement without more detail. The IG is discovery-only; the downstream resolution pathway is DTR then PAS, not a CRD resubmit loop. ([CRD STU2.1](https://build.fhir.org/ig/HL7/davinci-crd/); [PAS IG](https://build.fhir.org/ig/HL7/davinci-pas/))
- **PAS STU2 uses provider-polled `Claim/$inquire` — no payer-pushed notification.** The final PA decision is a ClaimResponse-based PAS response, retrieved by the provider polling `[base]/Claim/$inquire`. No normative FHIR Subscription or payer-initiated push is defined. ([PAS $inquire OperationDefinition](https://build.fhir.org/ig/HL7/davinci-pas/en/OperationDefinition-Claim-inquiry.html))
- **LOG3 follow-up event is the correct Solidity pattern.** OZ Governor.sol / TimelockController.sol use this exact approach: higher-topic creation event + lower-topic resolution event. `ClaimPaStatusResolved(bytes32 indexed claimId, uint8 indexed resolvedStatus, uint256 resolvedAt)` as LOG3 is idiomatic.
- **Gas: 23,680 on Somnia** (LOG3 + 32-byte non-indexed data for `resolvedAt`): `3200 + 5120×3 + 160×32 = 23,680 gas` (~$0.000146/emission). ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))
- **Idempotency guard required:** `require(claims[claimId].paStatus == 0x05)` before emitting. Only `auth-needed (0x03)` and `no-auth (0x01)` are valid resolution values. `resolvedAt` must be `block.timestamp`, not a caller parameter (prevents timestamp forgery).
- **On-chain resolution event is evidentiary metadata, not a substitute for the FHIR PAS ClaimResponse.** No CMS/OIG/AHIMA source mandates blockchain PA audit trails; the event's value is tamper-evident timestamping and `eth_getLogs` filterability for auditors.
- **No prior art:** cliqueue would be the first protocol to publish a `conditional → resolved` on-chain PA lifecycle using CRD-derived `uint8` codes.

**Design implication:** Add `resolveConditionalPaStatus(bytes32 claimId, uint8 resolvedStatus) external onlyRole(HOSPITAL_AGENT_ROLE)` to `ClaimsAdjudicator`, guarded by `require(paStatus == 0x05)` + `require(resolvedStatus ∈ {0x01, 0x03})`. Emit `ClaimPaStatusResolved(claimId, resolvedStatus, block.timestamp)`. This is a spec amendment alongside the `ClaimSubmitted` paStatus/paAuthHash change.

**Findings file:** [docs/research/somnia/claim-pa-status-resolved-event-design.md](somnia/claim-pa-status-resolved-event-design.md)

**Next priority questions:**
1. Should `resolveConditionalPaStatus()` also accept a `bytes32 paAuthHash` parameter — enabling `conditional → satisfied` resolution (payer grants PA after receiving more detail), in addition to `conditional → auth-needed` and `conditional → no-auth`?
2. Should cliqueue publish a `ClaimPaLifecycle` TypeScript utility module encapsulating the `conditional → resolved` transition logic alongside `PaStatusEncoder`?
3. Should the hospital BAA include a "PA Conditional Resolution SLA" clause — requiring resolution within N business days of receiving the PAS `$inquire` final response?

---

## 2026-05-17 — PA_HASH_DOMAIN_SEPARATOR: must be distinct from CLIQUEUE_DOMAIN_SEPARATOR; keccak256("cliqueue.v1.paAuthHash") is the correct pattern; public constant enables independent payer verification

**Question investigated:** Should `PA_HASH_DOMAIN_SEPARATOR` (used to derive `paAuthHash = keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, satisfiedPaId))` anchored in `ClaimSubmitted`) be a distinct constant from `CLIQUEUE_DOMAIN_SEPARATOR` (`keccak256("cliqueue.v1.hospitalId")` used in `SBTRegistry`) — and what is the correct Solidity pattern for one-way commitment hash domain tags?

**Key findings:**
- **Correct pattern for one-way commitment hashes: `bytes32 constant TAG = keccak256("Protocol.purpose.v1")`** — not the full EIP-712 DOMAIN_SEPARATOR (which includes `chainId` + `verifyingContract` and is designed for signed messages with replay protection). For simple prefix-tagged commitments, a human-readable string hashed to bytes32 is the standard pattern recommended by EIP-712, OZ, and security auditors. ([EIP-712](https://eips.ethereum.org/EIPS/eip-712); [OpenZeppelin EIP712.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/EIP712.sol))
- **Distinct domain tags are required for semantically distinct hash contexts.** EIP-712 §2.1 explicitly states the domain separator "allows for multiple distinct use-cases on the same struct instance." The same principle applies to commitment hashes: `CLIQUEUE_DOMAIN_SEPARATOR = keccak256("cliqueue.v1.hospitalId")` and `PA_HASH_DOMAIN_SEPARATOR = keccak256("cliqueue.v1.paAuthHash")` must use different strings so their commitments are unambiguously distinguishable by any party who knows only the published constants. ([EIP-712](https://eips.ethereum.org/EIPS/eip-712); [Cyfrin EIP-712 guide](https://www.cyfrin.io/blog/understanding-ethereum-signature-standards-eip-191-eip-712))
- **Security classification: strongly recommended best practice, not a known named exploit.** No published audit specifically cites cross-context domain tag reuse as an exploited vulnerability in this pattern. However, every major security reference (OZ, Cyfrin, RareSkills) treats it as a required design property — absence of a documented exploit reflects latent rather than absent risk. ([OZ community contracts](https://docs.openzeppelin.com/community-contracts/utilities))
- **`PA_HASH_DOMAIN_SEPARATOR` must be a `public constant` in `ClaimsAdjudicator`.** Unlike `hmacSalt` (secret, protects PHI-adjacent CLM01 hashes), `PA_HASH_DOMAIN_SEPARATOR` is a public verification tag. Publishing it enables payers to independently verify `paAuthHash` from `ClaimSubmitted` events by recomputing `keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, their278ArchiveEntry))` — without cliqueue's cooperation. If the constant is unpublished or `internal`, independent verification is impossible, defeating the purpose of on-chain PA linkage.
- **Naming follows established cliqueue convention:** `"cliqueue.v1.paAuthHash"` follows the `"cliqueue.v1.<purpose>"` pattern already set by `CLIQUEUE_DOMAIN_SEPARATOR`. The `v1` suffix allows future separator rotation without breaking existing commitments.
- **TypeScript derivation:** `keccak256(encodePacked(['string'], ['cliqueue.v1.paAuthHash']))` in viem/ethers. The `PaStatusEncoder` module must export both the separator constant and a `derivePaAuthHash(satisfiedPaId: string)` function alongside the `PaStatus` enum.

**Design implication:** `PA_HASH_DOMAIN_SEPARATOR = keccak256("cliqueue.v1.paAuthHash")` must be declared as a distinct `public constant` separate from `CLIQUEUE_DOMAIN_SEPARATOR` in `ClaimsAdjudicator` (or as a shared constants file). Both constants must be listed in the hospital onboarding checklist for payer-side verification. The `PaStatusEncoder` TypeScript module should export `PA_HASH_DOMAIN_SEPARATOR`, `derivePaAuthHash()`, and the `PaStatus` enum as a single versioned artifact.

**Findings file:** [docs/research/somnia/pa-hash-domain-separator-distinct-vs-shared.md](somnia/pa-hash-domain-separator-distinct-vs-shared.md)

**Next priority questions:**
1. Should cliqueue publish a formal "Domain Constant Registry" (one-page spec artifact) listing all `bytes32` domain tags across `ClaimsAdjudicator`, `SBTRegistry`, and `PaStatusEncoder` — with preimage strings, hex values, and intended usage — versioned alongside the contract ABI?
2. Should `CLIQUEUE_DOMAIN_SEPARATOR` be promoted to `public` in `SBTRegistry` — so compliance teams can independently verify `hospitalId` derivation from NPI using the block explorer and published constant?
3. Should `PaStatusEncoder` (exporting `PA_HASH_DOMAIN_SEPARATOR`, `derivePaAuthHash()`, `PaStatus` enum) be published as part of the `@cliqueue/contracts` npm package alongside `ISBTRegistry`?

---

## 2026-05-17 — satisfied-pa-id on-chain anchoring: bytes32 paAuthHash as non-indexed data in ClaimSubmitted; keccak256 off-chain with domain separator; REF*G1 is the EDI carrier; +5120 gas delta (LOG4 28,800→33,920 gas)

**Question investigated:** Should cliqueue anchor the `satisfied-pa-id` (X12 PA authorization number returned by payer CRD when `paStatus = satisfied`) as a `bytes32` hash in `ClaimSubmitted` — creating an on-chain link between PA approval and the claim without exposing the raw number — and should it be a second indexed topic or non-indexed data?

**Key findings:**
- **`satisfied-pa-id` is a FHIR `valueString`, max 30 chars (X12 DE 128 AN 1/30), no format constraints.** The CRD STU2.1 extension defines `satisfied-pa-id` as `string` (not `Identifier`); example value "Q8U119". Underlying X12 PA number (278 response REF*BB, DE 128) is alphanumeric, max 30 characters. Constraint `crd-ci-q5` requires `satisfied-pa-id` if and only if `paStatus = satisfied`. ([CRD STU2.1 StructureDefinition-ext-coverage-information](https://hl7.org/fhir/us/davinci-crd/STU2.1/StructureDefinition-ext-coverage-information.html); [CMS esMD X12N 278 companion guide](https://www.cms.gov/files/document/esmd-x12n-278-companion-guide.pdf))
- **A 5th indexed topic is impossible in Solidity.** Solidity allows max 4 topics per event (topic[0] = signature hash, topic[1–3] = user-indexed params). `ClaimSubmitted` after adding `uint8 indexed paStatus` will be LOG4 — fully saturated. `paAuthHash` must be a non-indexed `bytes32` data field.
- **Gas delta is +5,120 on Somnia — identical to one indexed topic.** Under Somnia's formula (`3200 + 5120×topic_count + 160×data_bytes`): adding 32 non-indexed bytes costs `160×32 = 5,120 gas`. LOG4 + 64-byte data = `3200 + 20480 + 10240 = 33,920 gas` (~$0.000209/emission). Negligible. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))
- **Hash off-chain, pass `bytes32`.** Compute `keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, satisfiedPaId))` in the TypeScript hospital agent before calling `submitClaim()`. Contract enforces `require(paStatus == 0x02 || paAuthHash == bytes32(0))`. No on-chain hashing needed.
- **EDI carrier is `REF*G1` (Prior Authorization Number) in 837 Loop 2300 — not K3.** `K3` (Free-Form Message Text) requires formal ASC X12 approval per X12 RFI #2206 and is not a general-purpose PA number carrier. All major payer companion guides (CGS Medicare, Optum, Molina) confirm `REF*G1`. The CRD IG statement about K3 (from one WebFetch summarizer reading) is not confirmed by primary X12 source. ([X12 RFI #2206](https://x12.org/resources/requests-for-interpretation/rfi-2206-clarify-tooth-info-837p-k3); [CGS 837I companion guide](https://www.cgsmedicare.com/pdf/edi/837I_compguide.pdf))
- **No prior protocol publishes PA auth numbers as on-chain hashes.** cliqueue's `paAuthHash` in `ClaimSubmitted` would be a novel pattern — enabling independent payer verification of the PA linkage without cliqueue's involvement by recomputing the hash using the 278 response archive and published `PA_HASH_DOMAIN_SEPARATOR`.

**Design implication:** Add `bytes32 paAuthHash` as non-indexed data to `ClaimSubmitted`. Off-chain agent computes `keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, satisfiedPaId))`; passes zero for all non-satisfied claims. EDI adapter maps `satisfied-pa-id` to `REF*G1` in outbound 837. Combine this amendment with the `uint8 indexed paStatus` amendment into a single `ClaimSubmitted` spec change. Gas rises from 28,800 to 33,920 (LOG4 + 64-byte data).

**Findings file:** [docs/research/somnia/satisfied-pa-id-on-chain-hash-claim-submitted.md](somnia/satisfied-pa-id-on-chain-hash-claim-submitted.md)

**Next priority questions:**
1. Should `PA_HASH_DOMAIN_SEPARATOR` be published as a cliqueue-wide constant in the hospital onboarding checklist — enabling independent payer verification — and should it reuse or be distinct from `CLIQUEUE_DOMAIN_SEPARATOR`?
2. Should `paStatus` encoding and `paAuthHash` derivation be published together as a TypeScript `PaStatusEncoder` module alongside `CodingConfidenceHeuristic`?
3. Should the `ClaimSubmitted` event spec be amended to include both `paStatus` and `paAuthHash` in a single formal amendment before the next feature branch regeneration?

---

## 2026-05-17 — paStatus on-chain encoding in ClaimSubmitted: uint8 indexed is correct; conditional maps to distinct byte 0x05; gas delta is +5120 on Somnia regardless of indexed vs non-indexed

**Question investigated:** Should cliqueue's `ClaimSubmitted` event include a `paStatus` field (`bytes1`) encoding all 5 CRD paStatus values plus NOT_CHECKED — and does including `conditional` as a distinct byte (rather than collapsing it into `auth-needed`) help auditors distinguish "PA determination deferred pending more detail" from "PA required and not obtained"?

**Key findings:**
- **`conditional` is semantically distinct from `auth-needed` and must not be collapsed into it.** `auth-needed` = PA definitively required (payer has made a determination). `conditional` = payer cannot determine PA requirement without more specific clinical detail (HCPCS modifier, site-of-service, quantity). Collapsing them would misrepresent the clinical determination in the audit trail. ([CRD STU2.1 ValueSet-coveragePaDetail](https://hl7.org/fhir/us/davinci-crd/STU2.1/ValueSet-coveragePaDetail.html))
- **`conditional` does not trigger PAS — it triggers human review.** The CRD IG frames `conditional` as a pre-determination / information-gathering path. The hospital agent should pause and request more specific clinical/service detail from the ordering provider before routing to PAS or proceeding. ([fire.ly CRD blog](https://fire.ly/blog/prior-authorization-with-crd-explained/))
- **Recommended 6-value `uint8` encoding:** `NOT_CHECKED=0x00`, `no-auth=0x01`, `satisfied=0x02`, `auth-needed=0x03`, `performpa=0x04`, `conditional=0x05`. `NOT_CHECKED` is the default for traditional Medicare FFS and pre-Jan 2027 deployments when no CRD query is made.
- **`uint8 indexed paStatus` is the correct Solidity field type** — not `bytes1`. `uint8` is idiomatic for enums, more readable in block explorers, and semantically correct for ordinal values.
- **Indexing `paStatus` costs the same as not indexing it on Somnia.** Using Somnia's LOG formula (`3200 + 5120×topic_count + 160×data_size_bytes`), adding `paStatus` as a non-indexed field (LOG3 → LOG3, data 32→64 bytes: +5120 gas) costs exactly the same as adding it as an indexed topic (LOG3 → LOG4, data stays 32 bytes: +5120 gas). Index it for query benefit at zero gas penalty. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))
- **Updated `ClaimSubmitted` event will be LOG4** (4 indexed topics). Gas = 28,800 on Somnia (~$0.000177/emission). Prior LOG3 estimate was 23,680 gas; delta is +5,120 gas — negligible.
- **No published prior art for FHIR-derived enum on-chain encoding** in healthcare blockchain protocols. cliqueue's `paStatus` encoding would be the first published mapping of CRD codes to on-chain bytes in a claims settlement context.

**Design implication:** Add `uint8 indexed paStatus` to `ClaimSubmitted` in `ClaimsAdjudicator`. Off-chain hospital agent maps CRD `coveragePaDetail` codes to the 6-value `uint8` before calling `submitClaim()`. `conditional` (0x05) → human review queue (not PAS). This is a spec-level change requiring a formal amendment before the next feature branch regeneration.

**Findings file:** [docs/research/somnia/pastatus-on-chain-encoding-claim-submitted-event.md](somnia/pastatus-on-chain-encoding-claim-submitted-event.md)

**Next priority questions:**
1. Should cliqueue also anchor the `satisfied-pa-id` (X12 PA authorization number) as a `bytes32` hash in `ClaimSubmitted` when `paStatus = satisfied` — creating an on-chain link between PA approval and claim without exposing the raw number?
2. Should `paStatus` encoding be published as a TypeScript `enum PaStatus` constant in the off-chain agent spec for hospital integration engineers?
3. When `paStatus = conditional` resolves later (to `auth-needed` or `no-auth`), should a new `ClaimPaStatusResolved` event type capture the resolution on-chain?

---

## 2026-05-17 — CDS Hooks TypeScript client for CRD v2.1.0: no production npm package exists; hand-rolled fetch client is correct; paStatus has 5 values (conditional omitted from prior entry); payer discovery endpoint provides prefetch template

**Question investigated:** Is there a production-ready `@cds-hooks/client` npm package or TypeScript CDS Hooks client library supporting the `order-sign` hook with Coverage Information extension required by Da Vinci CRD IG v2.1.0 — or must cliqueue implement the CDS Hooks client from scratch?

**Key findings:**
- **No production-ready TypeScript CDS Hooks client npm package exists as of May 2026.** The npm registry contains only abandoned or server-side packages: `cds-hooks` (2020, abandoned), `@asymmetrik/node-cds-hooks` (2020, server-side), `@asteen3/cds-hooks` (2022, research project), `@molit/cds-card-viewer` (2025, UI-only card display component). No `@cds-hooks/client`, `cds-hooks-client`, or `@types/cds-hooks` exists. HL7's `github.com/cds-hooks` org provides only server-side sandbox tooling; the `HL7-DaVinci/crd-request-generator` is a standalone JavaScript web UI (not an importable npm package). ([npm search](https://registry.npmjs.org/-/v1/search?text=cds-hooks); [github.com/cds-hooks](https://github.com/cds-hooks))
- **The CDS Hooks 2.0 wire protocol is simple enough to implement with `fetch` + TypeScript interfaces.** Protocol is `POST {baseUrl}/cds-services/{service.id}` with required fields: `hook`, `hookInstance` (UUID), `context` (hook-specific), plus conditional `fhirServer`, `fhirAuthorization`, and optional `prefetch`. Response is `{ cards: Card[], systemActions: Action[] }`. ([CDS Hooks 2.0 spec](https://cds-hooks.hl7.org/2.0/))
- **The payer CRD discovery endpoint (`GET /cds-services`) returns a `prefetch` template specifying which FHIR resources to pre-fetch.** The client must call discovery, resolve template variables from context, query the hospital FHIR server, and include results in `prefetch`. Do not hardcode a fixed resource set — different payer CRD endpoints declare different requirements. ([CDS Hooks 2.0 spec: discovery](https://cds-hooks.hl7.org/2.0/); [cheat sheet](https://cds-hooks.org/cheat-sheet/cheat-sheet/))
- **CORRECTION: `coveragePaDetail` ValueSet in CRD STU2.1 defines FIVE paStatus codes, not four.** Prior entry in `cms-0057f-prior-auth-api-presubmission-integration.md` omitted `conditional`. Complete list: `no-auth` (no PA required), `auth-needed` (PA required, not obtained), `satisfied` (PA already approved, bypass), `performpa` (PA needed from performing provider, not ordering), `conditional` (cannot determine without more specific order detail). ([CRD STU2.1 ValueSet/coveragePaDetail](https://hl7.org/fhir/us/davinci-crd/STU2.1/ValueSet-coveragePaDetail.html))
- **Coverage-information system action is returned as a FHIR Task resource with extensions** using CodeSystem `http://hl7.org/fhir/us/davinci-crd/CodeSystem/temp`. The `systemActions[].resource` (Task) carries paStatus and satisfied-pa-id via FHIR extension elements. The `davinci-crd.configuration` extension allows the client to control which card types the payer returns. ([Da Vinci CRD STU2.1 deviations](https://hl7.org/fhir/us/davinci-crd/STU2.1/deviations.html))
- **CRD IG mandates parallel invocation for multi-coverage patients.** For patients with both primary and secondary coverage, hospital agent must fire concurrent CDS Hooks requests to all applicable payer CRD endpoints and handle responses independently. ([CRD STU2.1 deviations](https://hl7.org/fhir/us/davinci-crd/STU2.1/deviations.html))

**Design implication:** cliqueue must hand-roll a typed CDS Hooks 2.0 client in TypeScript (`fetch` + typed interfaces). Client lifecycle: (1) cache payer prefetch templates from `GET /cds-services` at onboarding; (2) resolve prefetch queries against hospital FHIR server pre-claim; (3) fire parallel `order-sign` POST calls per payer coverage; (4) parse `systemActions[].resource` Task for coverage-information extension; (5) map paStatus to `ClaimSubmitted` on-chain byte — encoding must include all 5 values plus `NOT_CHECKED`. Prior research file `cms-0057f-prior-auth-api-presubmission-integration.md` must be corrected to add the `conditional` paStatus code.

**Findings file:** [docs/research/regulatory/cds-hooks-typescript-client-crd-v2-1.md](regulatory/cds-hooks-typescript-client-crd-v2-1.md)

**Next priority questions:**
1. Should the payer CRD discovery prefetch template be cached at hospital onboarding or re-fetched per claim — and does caching create a staleness risk if the payer updates its prefetch requirements post CMS-0057-F deadline?
2. For `paStatus = conditional`, should cliqueue treat it as `auth-needed` (pause on-chain commitment, trigger PAS) or route to human review — and should `conditional` map to a distinct byte value in `ClaimSubmitted` to allow auditors to distinguish it?
3. Should cliqueue publish the hand-rolled CDS Hooks TypeScript client as a standalone open-source `@cliqueue/cds-hooks-client` npm package — filling the ecosystem gap and providing hospital integration engineers a reusable typed client?

---

## 2026-05-17 — CMS-0057-F Prior Authorization FHIR API: CRD CDS Hooks client is a viable pre-submission PA check for MA/Medicaid/QHP claims; traditional Medicare FFS excluded; ICD-10 codes from Corti Symphony provide the inputs; feature available post-MVP (Jan 2027 payer deadline)

**Question investigated:** Does the CMS-0057-F Prior Authorization FHIR API (mandatory for impacted payers by January 1, 2027) create an actionable pre-submission prior-auth check integration opportunity for cliqueue's hospital agent — and what is the technical mechanism, scope, and denial-reduction implication?

**Key findings:**
- **CMS-0057-F applies to MA, Medicaid/CHIP, and QHP payers only — traditional Medicare fee-for-service is explicitly excluded.** For cliqueue, this means the CRD integration applies to MA commercial-product claims and Medicaid managed care claims that are not blocked by the existing MA exclusion gate (which targets MA risk-adjustment autonomous coding, not MA claim adjudication generally). ([CMS-0057-F fact sheet](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f))
- **The technical mechanism is CDS Hooks (Coverage Requirements Discovery IG v2.1.0), not a direct REST call.** The hospital agent fires a CDS Hook (`order-sign`) to the payer's CRD endpoint with patient coverage context, procedure codes, and ICD-10 diagnosis codes. The payer returns PA status (`no-auth | auth-needed | satisfied | performpa`) and a `satisfied-pa-id` (X12 PA number) if pre-authorization is already satisfied. ([Da Vinci CRD IG v2.1.0](https://hl7.org/fhir/us/davinci-crd/STU2.1/); [ONC CRD test method](https://healthit.gov/test-method/provider-prior-authorization-api-coverage-requirements-discovery/))
- **CRD is dynamic (per-patient, per-service), not a static machine-readable list.** The payer's CRD endpoint evaluates the specific patient's plan, the specific procedure, and the specific diagnosis to determine PA requirement — not a pre-computed list. This means cliqueue's agent must have Corti Symphony's ICD-10 codes in hand before firing the CRD query.
- **PA denial burden is significant and coding mismatches amplify it.** 31% of physicians report PA requests are often/always denied (AMA 2025); 7.7% of MA PA requests denied in 2024 (KFF). Among appealed denials, 81.7% are overturned, suggesting high-value pre-submission checks. CO-15 (missing/invalid PA number) and CO-4 (code inconsistency between PA request and claim) are leading denial drivers when ICD-10 codes in the claim differ from those in the PA request. ([AMA 2025 PA survey](https://www.ama-assn.org/system/files/prior-authorization-survey.pdf); [KFF MA PA 2024](https://www.kff.org/medicare/medicare-advantage-insurers-made-nearly-53-million-prior-authorization-determinations-in-2024/))
- **Highest-burden PA specialties**: orthopedics (joint replacement, spine, therapeutic injections), radiology/imaging (MRI, CT, PET), interventional cardiology, and pain management — all high-value facility claim types well within cliqueue's inpatient and outpatient scope. ([SVAST 2025](https://www.svasthealthtech.com/why-prior-authorization-is-slowing-down-these-medical-specialties-in-2025/))
- **Payer CRD endpoints will not be universally available until January 2027.** This feature cannot be in cliqueue's MVP launch; it should be designed now and activated as payers come into compliance.

**Design implication:** cliqueue's hospital agent should implement a CRD CDS Hooks client as an optional post-coding, pre-on-chain-anchor step: after Corti Symphony returns ICD-10 codes, fire a CRD query; if `auth-needed`, pause the on-chain commitment and trigger a PAS submission workflow. This directly reduces CO-15 and ICD-10 mismatch denials for MA, Medicaid, and QHP claims. A `paStatus` byte should be anchored on-chain in `ClaimSubmitted` events as an immutable audit record of whether a PA check was performed. Traditional Medicare FFS claims must fall through to a manual PA fallback path.

**Findings file:** [docs/research/regulatory/cms-0057f-prior-auth-api-presubmission-integration.md](regulatory/cms-0057f-prior-auth-api-presubmission-integration.md)

**Next priority questions:**
1. Should cliqueue's `ClaimSubmitted` event include a `paStatus` field (`bytes1`) anchored on-chain — creating an immutable audit record of whether a CRD PA check was performed before on-chain commitment?
2. For the CRD CDS Hooks client in TypeScript: is there a production-ready `@cds-hooks/client` npm package, or must cliqueue implement the CDS Hooks client from scratch?
3. Should cliqueue define a `payerCRDEndpoint` field in the hospital onboarding checklist with a structured payer-discovery workflow?

---

## 2026-05-17 — FHIR payer API readiness: no major payer has replaced EDI 837; CMS-0057-F mandates prior-auth and data-access APIs only; EDI adapter is a durable architectural requirement through at least 2027–2028

**Question investigated:** Are major US payers (UHC, Aetna, Anthem, Humana, Cigna) actively deploying FHIR-based claim submission or adjudication APIs as of 2025–2026 — and does this create a viable non-EDI integration path for cliqueue's payer agent by 2027?

**Key findings:**
- **No major US payer has launched a production FHIR R4 `Claim`/`ClaimResponse` API for claim submission replacing EDI 837P/837I as of May 2026.** Payer FHIR APIs are scoped to patient access, coverage, formulary, provider directory, prior authorization status, and EOB — not claim submission. ([Perplexity research synthesis, May 2026])
- **CMS-0057-F is not a claim-submission replacement mandate.** The rule requires five FHIR-based APIs (Patient Access, Provider Access, Provider Directory, Payer-to-Payer, Prior Authorization) live in production by January 1, 2027. It does not require FHIR-based claim submission or modify the HIPAA X12 837 transaction standard. ([CMS-0057-F final rule](https://www.cms.gov/priorities/burden-reduction/overview/interoperability/policies-regulations/cms-interoperability-prior-authorization-final-rule-cms-0057-f); [Firely breakdown](https://fire.ly/blog/cms-0057-f-decoded-must-have-apis-vs-nice-to-have-igs-for-2026-2027/))
- **Da Vinci IGs (CDex, PDex, PAS) are recommended but not mandated by CMS-0057-F.** Specific Da Vinci implementation guides are "nice to have" under the rule's FHIR baseline requirement. No named major payer has publicly confirmed production deployment of Da Vinci CDex for claims-supporting clinical documentation. The most concrete pilot is HIMSS25 (MultiCare + Regence, 94% immediate prior-auth resolution) — covering prior auth only, not claim submission. ([HL7 Da Vinci 2025 progress](https://hl7news.hl7.org/2026/01/06/hl7-da-vinci-project-advances-transformational-work-in-2025/))
- **No finalized CMS or HIPAA Administrative Simplification rule mandates FHIR claim submission by any deadline.** The X12 837 remains the sole federally mandated claim submission format. A separate electronic attachments rulemaking (which would govern CDex Attachments IG adoption) has not been finalized. ([CMS-0057-F fact sheet](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f))
- **CAQH CORE Phase IV is EDI/X12-centric, not FHIR-based.** CORE operating rules govern administrative connectivity and acknowledgment standards; they have not produced a FHIR-based real-time claim adjudication framework.
- **The only near-term FHIR surface relevant to cliqueue is the CMS-0057-F Prior Authorization API (mandatory Jan 2027)** — potentially useful for a pre-submission prior-auth check in the hospital agent, but not for claim submission or adjudication itself.

**Design implication:** cliqueue's EDI 837 (submission) and EDI 835 (remittance) adapter is not an interim workaround — it is a durable architectural requirement through at least 2027–2028 with no near-term FHIR replacement on the payer side. The off-chain adapter must be built to production quality. The only forward-looking FHIR integration worth monitoring for MVP adjacency is the CMS-0057-F Prior Authorization API.

**Findings file:** [docs/research/agreement-layer/fhir-payer-api-readiness-edi-replacement-timeline.md](agreement-layer/fhir-payer-api-readiness-edi-replacement-timeline.md)

**Next priority questions:**
1. Does the CMS-0057-F Prior Authorization FHIR API (mandatory Jan 2027) create a pre-submission prior-auth check integration opportunity for cliqueue's hospital agent — reducing the denial rate for prior-auth-required procedures before anchoring the claim hash on-chain?
2. Has CMS published a proposed rulemaking for FHIR-based electronic attachments (CDex Attachments IG equivalent) — signaling when clinical documentation exchange for claims becomes a mandatory payer capability?
3. Should cliqueue's EDI adapter spec define a `PayerAdapterInterface` abstract seam enabling a future per-payer FHIR `ClaimResponse` adapter without changing the on-chain settlement layer?

---

## 2026-05-16 — `eth_subscribe` topic[1] filtering on Somnia: documented but not empirically confirmed; LOG gas cost 13× Ethereum baseline (prior `StaffingFloorReached` estimate was wrong)

**Question investigated:** Does Somnia's AOT-compiled EVM correctly implement `eth_subscribe("logs")` topic[1] filtering for indexed parameters — has any developer published an empirical confirmation — and what is the correct LOG opcode gas cost on Somnia (vs. Ethereum)?

**Key findings:**
- **Somnia JSON-RPC documents `eth_subscribe("logs")` with standard topic filter semantics**: `topics: array or null — "Same topic-position semantics as eth_getLogs / eth_newFilter"`. The `eth_getLogs` spec says each position is a single hash, OR-list, or null wildcard. A wscat example shows `topics: [null, "0x..."]` — confirming topic[1] filtering is in the documented API. ([Somnia JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api))
- **No empirical developer confirmation found for topic[1] filtering on Somnia mainnet (chain ID 50312)**: No GitHub repo, community blog, or forum thread was found confirming that a `topics: [sig, indexedValue]` subscription delivers only matching logs on Somnia mainnet. Given Erigon's historic bug causing topic-filter silent failure, and Somnia's custom AOT-compiled EVM, empirical testing is warranted before production use.
- **CRITICAL: Prior `StaffingFloorReached` gas estimate is wrong for Somnia**: The 2026-05-16 log entry for `staffing-floor-reached-event-design.md` stated "~1,006 gas (375 base + 375 topic + 256 data)" — this is the **Ethereum LOG1 formula** (LOG with 1 topic). The correct Somnia formula is `3200 + 5120 × topic_count + 160 × size`. `StaffingFloorReached(bytes32 indexed hospitalId, uint32 currentCount)` is a **LOG2** (2 indexed topics) with 4 bytes data: `3200 + 5120×2 + 160×4 = 13,760 gas`, not ~1,006 gas. This is a 13.7× underestimate. At $0.00000000616/gas, cost is ~$0.0000847/emission — still operationally negligible but the prior figure was incorrect.
- **Somnia LOG costs are 13–14× Ethereum across all LOG opcodes**: LOG0 = 8,320 gas vs. 631; LOG1 = 13,440 vs. 1,006; LOG2 = 18,560 vs. 1,381; LOG3 = 23,680 vs. 1,756; LOG4 = 28,800 vs. 2,131 (all with 32 bytes data). All prior research entries that cited Ethereum-based LOG gas costs for Somnia events are underestimates by ~13×. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))
- **Somnia `eth_subscribe` does NOT support `newPendingTransactions`** (proprietary alternatives only). The `logs` subscription type is confirmed supported. WebSocket subscriptions are connection-scoped — `eth_unsubscribe` fails on load-balanced connections. ([Somnia JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api))
- **On-chain reactivity `SubscriptionFilter.eventTopics` semantics confirm `bytes32(0)` = wildcard, non-zero = exact-match**: consistent with standard Ethereum topic filter semantics but in the on-chain reactivity layer, not JSON-RPC. ([Somnia Reactivity Tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial))

**Design implication:** The dispute-listener must use `eth_subscribe("logs")` with `topics: [ClaimDisputedSig, claimIdHash]` as documented and documented-compatible with Somnia, but this MUST be verified with a pre-deployment canary test before directing any hospital system to live `ClaimsAdjudicator`. All prior event gas estimates in research docs that used Ethereum baseline figures are ~13× underestimates — operationally negligible in dollar terms but must be corrected in the per-claim gas economics analysis.

**Findings file:** [docs/research/somnia/eth-subscribe-topic1-filter-somnia-log-gas-costs.md](somnia/eth-subscribe-topic1-filter-somnia-log-gas-costs.md)

**Next priority questions:**
1. Has any developer published a confirmed empirical test of `eth_subscribe("logs")` with `topics: [sig, indexedValue]` delivering only matching events on Somnia mainnet chain ID 50312 — and should cliqueue's pre-deployment canary suite be the first such published confirmation?
2. Should the prior `staffing-floor-reached-event-design.md` findings receive a published correction noting the Ethereum-vs-Somnia gas discrepancy?
3. Should cliqueue audit all planned on-chain events for topic count and data size to compute accurate Somnia gas budgets, and should `per-claim-gas-economics-llm-inference-cost.md` be revised to include event emission costs?

---

## 2026-05-16 — `blockedPayerIds` on-chain design: bytes32 hashed key + domain separator; emit only commitment in events; asymmetric access control (immediate block, timelocked unblock)

**Question investigated:** Should the on-chain `blockedPayerIds` mapping in `ClaimsAdjudicator` use `bytes32` hashes of payer EDI IDs or store raw EDI ID strings — and does storing raw payer IDs on a public chain create HIPAA or competitive-sensitivity concerns?

**Key findings:**
- **Payer EDI IDs (X12 837 Loop 2010BB NM109 5-digit CMS payer IDs) are NOT HIPAA PHI**: PHI requires health information about an identifiable individual. A payer identifier identifies a health plan (an organization), not a patient. Storing payer IDs on-chain creates no HIPAA disclosure obligation. ([45 CFR §160.103](https://www.law.cornell.edu/cfr/text/45/160.103); [45 CFR §164.514(b)](https://www.law.cornell.edu/cfr/text/45/164.514))
- **Competitive sensitivity is the real concern, not HIPAA**: A public blocklist reveals the hospital's payer exclusion policy — which payers it is blocking for claim types — exposing business intelligence about strained payer relationships, selective claim routing, and contract disputes. The domain-separator hash mitigates this by preventing observers from confirming whether a specific payer is blocked.
- **Domain separator is required to prevent rainbow-table lookup**: The CMS payer ID space is small and enumerable (publicly listed in the CMS MA/Part D Contract and Enrollment Data repository). Unsalted `keccak256(payerId)` can be brute-forced from the known payer ID list in minutes. `keccak256(abi.encodePacked(BLOCKLIST_DOMAIN, payerId))` where `BLOCKLIST_DOMAIN = keccak256("ClaimsAdjudicator.blockedPayerIds.v1")` prevents this. ([CMS MA/Part D Contract and Enrollment Data](https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-advantagepart-d-contract-and-enrollment-data))
- **Emitting raw payer ID in `PayerBlocked` events defeats the mapping key hash**: If `PayerBlocked(string payerId, ...)` is emitted, the commitment is trivially invertible. The `PayerBlocked` event must emit only `(bytes32 indexed payerCommitment, uint8 reasonCode, address indexed actor)` — human-readable payer ID stays in the off-chain EDI system.
- **Asymmetric access control**: `BLOCKLIST_ADMIN_ROLE` (2-of-3 hospital admin multisig) can call `blockPayer()` immediately — urgency justified by the need to block newly CMS-issued MA plan IDs before they enter the claim stream (CMS publishes annual January updates). `unblockPayer()` must go through `TimelockController` (48-hour delay) — removal is higher-risk (accidentally restoring AI MA coding triggers DOJ-risk). Consistent with existing cliqueue governance pattern.
- **Canonicalization is critical**: `blockPayer()` must accept only a single canonical payer ID format (uppercase, trimmed). Different representations of the same payer produce different hashes and silently bypass the blocklist. Deployment runbook must specify and enforce canonical format.

**Design implication:** `blockedPayerIds` must be `mapping(bytes32 => bool)` keyed by `keccak256(BLOCKLIST_DOMAIN || canonicalPayerId)`. No raw EDI strings on-chain or in events. `PayerBlocked`/`PayerUnblocked` events emit only commitment hash + reason code. Access control is asymmetric: immediate for block, timelocked for unblock. HIPAA concern is minimal (payer IDs are not PHI); competitive-sensitivity concern is real and mitigated by commitment design.

**Findings file:** [docs/research/regulatory/blockedpayerids-on-chain-privacy-design.md](regulatory/blockedpayerids-on-chain-privacy-design.md)

**Next priority questions:**
1. Should the hospital BAA include a "Medicare Advantage Exclusion Exhibit" listing blocked payer names (not commitment hashes) — giving compliance teams a documented defense if a new MA plan is not yet in the blocklist?
2. Should the deployment runbook include an annual CMS MA plan update procedure tied to the January effective date — with a calendar trigger to call `blockPayer()` via `BLOCKLIST_ADMIN_ROLE` before new plans become active?
3. Should `BlockReason` be a typed `enum` in `IClaimsAdjudicator` — enabling auditors to decode reason codes without off-chain documentation?

---

## 2026-05-16 — `StaffingFloorReached` event: emit on every floor-crossing, no attestor address, LOG opcodes exempt from Somnia IceDB cold-SLOAD penalty

**Question investigated:** Should `renounceAttestorRole(bytes32 hospitalId)` emit a `StaffingFloorReached(bytes32 indexed hospitalId, uint32 currentCount)` event when the post-renounce count equals exactly `MIN_ATTESTERS_FLOOR = 2` — and does emitting attestor address create HIPAA or PII risk?

**Key findings:**
- **No OZ/Safe precedent for "approaching threshold" warning events**: Gnosis Safe emits only on actual role changes (`AddedOwner`, `RemovedOwner`) and reverts on violations — no pre-threshold warning. OZ `AccessControlDefaultAdminRules`'s two-step transfer is the closest analog but is for a different purpose. `StaffingFloorReached` is a custom pattern, appropriate for the high-stakes liveness risk it mitigates. ([Safe Contracts: OwnerManager.sol](https://github.com/safe-global/safe-contracts); [OZ AccessControl v5.x](https://docs.openzeppelin.com/contracts/5.x/access-control))
- **LOG opcodes are categorically exempt from Somnia's IceDB cold-SLOAD penalty**: EIP-2929 warm/cold tracking applies to SLOAD, SSTORE, CALL, and account access — NOT to LOG0–LOG4 (event emission). `StaffingFloorReached(bytes32 indexed hospitalId, uint32 currentCount)` costs ~1,006 gas (375 base + 375 topic + 256 data) with zero IceDB surcharge. At current gas pricing this is ~$0.0000062 per emission — negligible. ([EIP-2929](https://eips.ethereum.org/EIPS/eip-2929); [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))
- **Coder wallet address + hospitalId is NOT HIPAA PHI**: PHI requires health information (health condition, care, or payment) linked to an individual — a coder's Ethereum address paired with a hospitalId contains no health information. The HIPAA employment records exclusion (45 CFR §160.103) applies. However, the wallet address is general PII (unique identifier linkable to a named employee), so emitting only `hospitalId` + `currentCount` (NOT the attestor address) is the privacy-conservative design. ([45 CFR §160.103](https://www.law.cornell.edu/cfr/text/45/160.103); [HHS Employer FAQ](https://www.hhs.gov/hipaa/for-individuals/employers-health-information/index.html))
- **Event is operationally consumable**: Somnia WebSocket `eth_subscribe` with `topics[0]` (event signature) and `topics[1]` (indexed hospitalId) filter enables real-time push alert to hospital HR/credentialing systems. Ormi subgraph can index and trigger webhooks. Push-based alerting is superior to polling `getAttestorCount` for HIPAA §164.308(a)(3)(ii)(C) compliance (timely access revocation). (Prior research: `docs/research/somnia/claim-disputed-event-websocket-subscription.md`)
- **Emit on every floor-crossing, from both `revokeAttestorRole` and `renounceAttestorRole`**: A hospital that onboards a replacement (count 2→3) and then loses one (count 3→2) should receive a fresh alert on the second departure. Symmetrical emission across both revocation paths ensures monitoring agents receive the alert regardless of which path was used.

**Design implication:** `SBTRegistry` must emit `StaffingFloorReached(bytes32 indexed hospitalId, uint32 currentCount)` — without attestor address — whenever either `revokeAttestorRole` or `renounceAttestorRole` produces `_attestorCount[hospitalId] == MIN_ATTESTERS_FLOOR`. Event gas cost is ~1,006 gas with no IceDB penalty. The event is additive to `AttestorCountChanged` (which fires on every count change); `StaffingFloorReached` is the actionable monitoring-tier alert, `AttestorCountChanged` is the audit-log tier. `ISBTRegistry` should declare both events at the interface level.

**Findings file:** [docs/research/somnia/staffing-floor-reached-event-design.md](somnia/staffing-floor-reached-event-design.md)

**Next priority questions:**
1. Should `ISBTRegistry` declare `StaffingFloorReached` as an interface-level event so Ormi subgraph definitions bind to the interface ABI without coupling to the concrete implementation?
2. Should a secondary `StaffingRiskWarning(bytes32 indexed hospitalId, uint32 currentCount, uint32 floor)` event fire when count drops to `floor + 1` — giving earlier warning given the 12% annual coding shortage rate?
3. Should cliqueue's hospital BAA include a "Voluntary Attestor Exit Protocol" specifying that departing coders must self-renounce or admin must revoke within one business day — triggering the `StaffingFloorReached` alert as the contractual evidence of the exit protocol completion?

---

## 2026-05-16 — AHIMA/AAPC AI coding certification constraints: no federal mandate for certified coder review, but Humana/Cigna payer contracts and OIG MA guidance create substantive requirements

**Question investigated:** How do AHIMA/AAPC certification rules constrain AI-only coding — is there a CCA/CCS/CPC equivalent expected for AI agents, or a published guidance document mandating certified coder review?

**Key findings:**
- **No federal regulation mandates certified coder review of AI-generated codes**: CMS, OIG, and HHS have not issued any rule requiring a CCS, CCA, CPC, or RHIA to sign off every AI-coded claim before submission as of May 2026. This is a compliance-program recommendation (auditing), not a submission requirement. ([Tucker Ellis: FCA Landmines in AI Coding](https://www.tuckerellis.com/alerts/avoiding-false-claims-act-landmines-in-ai-assisted-coding-and-medical-billing/))
- **OIG February 2026 Medicare Advantage Guidance is the sharpest regulatory signal**: human-in-the-loop must be substantive — coders must cite specific clinical documentation supporting each accepted AI code. Rubber-stamp review (85% acceptance at 0.5 sec/chart) collapses under FCA scienter. Applies directly to MA risk-adjustment; fee-for-service applicability not stated. ([OIG MA ICPG Feb 2026](https://oig.hhs.gov/compliance/ma-icpg/))
- **Humana and Cigna impose contractual (not regulatory) credentialed coder attestation requirements**: both payers as of Q2 2025 require providers to attest that AI-coded claims were validated by credentialed coders before dropping. Breach triggers contract remedies and recoupment — not automatic FCA liability. ([2026 AI Medical Coding Guide](https://helpsquad.com/blog/the-2026-guide-to-ai-in-medical-coding/))
- **Medicare Advantage risk-adjustment is the highest-risk domain**: Kaiser Permanente ($556M Jan 2026), Cigna ($172M 2023), and Independent Health/DxID ($100M 2024) enforcement involves MA diagnosis inflation — not FFS outpatient coding. DOJ Working Group explicitly targets AI vendors that auto-code unsupported MA diagnoses. MA risk-adjustment should be explicitly out of scope for cliqueue Phase 1. ([Health Law Attorney Blog March 2026](https://www.healthlawattorneyblog.com/ai-is-billing-your-patients-who-holds-the-bag-the-rise-of-ambient-billing-and-coding-tools-and-the-legal-minefield-your-practice-is-walking-into/))
- **The inpatient/outpatient human review distinction is a best-practice framework, not a regulatory bright line**: AHIMA's 2024 Journal opinion piece ("A Framework for Autonomous Coding in the Inpatient Setting") proposes coders become validators — it is academic opinion, not AHIMA policy. No formal AHIMA or AAPC position statement requires certified coder attestation for any claim type. ([Journal of AHIMA Aug 2024](https://journal.ahima.org/page/a-framework-for-autonomous-coding-in-the-inpatient-setting))
- **AHIMA's formal AI posture is advisory**: its 2025 consensus statement (Health IT End-Users Alliance) calls for AI to "augment, not replace" human expertise — advocacy framing, not a compliance obligation. ([AHIMA AI Consensus Statement 2025](https://www.ahima.org/news-publications/press-room-press-releases/2025-press-releases/milestone-consensus-statement-on-ai-issued-by-power-users-as-part-of-the-health-it-end-users-alliance/))

**Design implication:** cliqueue's SBT-gated attestation for inpatient DRG claims correctly addresses the highest-risk domain. For outpatient FFS claims, no federal mandate requires certified coder attestation — but Humana/Cigna payer contracts do. The on-chain SBT attestation satisfies payer-contractual requirements with a stronger proof than PDF workflows. MA risk-adjustment coding must be excluded from Phase 1 scope (active DOJ enforcement against AI vendors). cliqueue should market the SBTRegistry + on-chain attestation as a "Payer Contract Compliance Artifact" for Humana/Cigna-contracted hospitals.

**Findings file:** [docs/research/regulatory/ahima-aapc-ai-coding-certification-oversight-requirements.md](regulatory/ahima-aapc-ai-coding-certification-oversight-requirements.md)

**Next priority questions:**
1. Should cliqueue exclude Medicare Advantage risk-adjustment coding from Phase 1 scope — with a hard gate in `ClaimsAdjudicator` requiring `requiresHumanAttestation = true` for MA-billed claim types — given active DOJ enforcement targeting AI vendors that auto-code MA diagnoses?
2. Should cliqueue's BAA include a "Payer Contract Attestation Exhibit" documenting that the SBT on-chain attestation satisfies Humana/Cigna's credentialed coder review contractual requirement?
3. Does the OIG February 2026 MA Guidance's substantive human-in-the-loop standard set a precedent that a future OIG GCPG update will extend to fee-for-service autonomous coding — and should cliqueue's architecture plan for that extension?

---

## 2026-05-16 — `renounceAttestorRole` — admin co-signature vs. permissionless floor-guarded self-renounce

**Question investigated:** Should `renounceAttestorRole(bytes32 hospitalId)` require `HOSPITAL_ADMIN_ROLE` co-signature (preventing unilateral self-removal without admin approval) or remain permissionless (floor-guarded only) — and does admin co-signature create a liveness risk?

**Key findings:**
- **No OZ canonical precedent for co-signature on non-admin role renunciation**: `AccessControlDefaultAdminRules`'s two-step renounce applies only to DEFAULT_ADMIN_ROLE (singleton, catastrophic-loss-on-accidental-renounce). Attestor roles are the opposite case — blocking self-removal is the failure mode, not the safety property. ([OZ AccessControl v5.x](https://docs.openzeppelin.com/contracts/5.x/access-control); [OZ AccessControlDefaultAdminRules.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/extensions/AccessControlDefaultAdminRules.sol))
- **Admin co-signature creates a documented liveness risk (denial-of-renunciation vector)**: Trail of Bits (June 2025) documents admin-key unavailability as a primary operational liveness risk. If the HOSPITAL_ADMIN multisig quorum is unreachable, admin co-signature blocks a departing attestor from self-removing — leaving a stale credential active. This is a trust inversion: requiring admin permission to *leave* a role creates the opposite of the intended security outcome. ([Trail of Bits: Maturing Smart Contracts Beyond Private Key Risk, June 2025](https://blog.trailofbits.com/2025/06/25/maturing-your-smart-contracts-beyond-private-key-risk/))
- **HIPAA §164.308(a)(3)(ii)(C) requires prompt access revocation upon separation**: For involuntary terminations, removal should be immediate. An admin co-signature with multisig quorum delays cannot guarantee this. Permissionless self-renounce is a secondary revocation path that maintains HIPAA compliance for voluntary departures without admin lag. ([45 CFR §164.308](https://www.law.cornell.edu/cfr/text/45/164.308))
- **The floor check alone is the sufficient and correct defense**: `require(_attestorCount[hospitalId] > MIN_ATTESTERS_FLOOR)` prevents the one real attack vector (driving count below the minimum). Admin co-signature adds zero additional protection and introduces liveness dependency. The guard is unconditional regardless of who calls.
- **No co-signature pattern is needed in `ISBTRegistry`**: Adding admin co-signature would require a two-step proposal/countersign interface — complicating `ISBTRegistry` without security benefit. The interface remains minimal: single-function permissionless self-renounce with floor guard.

**Design implication:** `renounceAttestorRole` must remain permissionless (no `HOSPITAL_ADMIN_ROLE` co-signature) with `_attestorCount > MIN_ATTESTERS_FLOOR` floor guard only. Admin co-signature creates liveness risk, potential HIPAA §164.308 compliance issues, and is logically backwards for a departure-initiated self-removal. The hospital BAA should include a "Voluntary Attestor Exit Protocol" specifying that departing coders self-renounce or that admin executes `revokeAttestorRole` within one business day of separation.

**Findings file:** [docs/research/somnia/renounce-attestor-role-admin-cosignature-vs-permissionless.md](somnia/renounce-attestor-role-admin-cosignature-vs-permissionless.md)

**Next priority questions:**
1. Should `renounceAttestorRole` emit `StaffingFloorReached(bytes32 hospitalId, uint32 currentCount)` when post-renounce count equals exactly `MIN_ATTESTERS_FLOOR` — giving hospital monitoring systems an automatic alert that the next renounce would revert?
2. Should the `ISBTRegistry` NatSpec for `renounceAttestorRole` explicitly document that no admin co-signature is required — so hospital security officers don't misread the ABI?
3. Should cliqueue's hospital BAA include a "Voluntary Attestor Exit Protocol" specifying one-business-day contractual obligation to execute revocation — mirroring the HIPAA §164.308 termination procedure requirement on-chain?

---

## 2026-05-16 — ISBTRegistry typed interface design and GENIUS Act DLP exclusion

**Question investigated:** Should the typed wrapper functions (`grantAttestorRole`, `revokeAttestorRole`, `renounceAttestorRole`) be published as a standalone `ISBTRegistry` typed interface — what should it declare, how does it compose with `IERC5484` and `IAccessControl`, should `AttestorCountChanged` be an interface-level event, and does publishing a public typed interface contribute to the GENIUS Act DLP exclusion?

**Key findings:**
- **`IERC5484` is minimal**: one enum (`BurnAuth`), one event (`Issued`), one view function (`burnAuth(uint256 tokenId)`), ERC-165 ID `0x0489b56f`. It extends ERC-721 only, not `IAccessControl`. `ISBTRegistry` must extend both independently: `interface ISBTRegistry is IAccessControl, IERC5484`. ([EIP-5484](https://eips.ethereum.org/EIPS/eip-5484); [OZ IAccessControl.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/IAccessControl.sol))
- **`AttestorCountChanged` belongs in the interface** (not the concrete contract): OZ's `IGovernor` declares all 6 governance lifecycle events in the interface — indexers and monitoring tools bind to the interface ABI. The same pattern applies here. `AttestorCountChanged(bytes32 indexed hospitalId, uint32 newCount, bool isGrant)` must be interface-declared so Ormi subgraph subscriptions and hospital dashboards can subscribe without the concrete implementation ABI. ([OZ IGovernor.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/IGovernor.sol))
- **`getAttestorCount(bytes32 hospitalId)` and `getAttestorFloor()` must be interface view functions**: `ClaimsAdjudicator` imports `ISBTRegistry` (not `SBTRegistry`) and calls `sbtRegistry.getAttestorCount(hospitalId)` at claim submission for the floor check. This decouples `ClaimsAdjudicator` from the concrete registry — future `SBTRegistry` UUPS upgrades do not require `ClaimsAdjudicator` redeployment as long as `ISBTRegistry` is stable.
- **GENIUS Act DLP exclusion — Section 2 definition confirmed**: "distributed ledger protocol" means "publicly available and accessible executable software deployed to a distributed ledger, including smart contracts or networks of smart contracts." ([Federal Register FDIC NPRM April 2026](https://www.federalregister.gov/documents/2026/04/10/2026-06974/genius-act-requirements-and-standards-for-fdic-supervised-permitted-payment-stablecoin-issuers-and)) Publishing a verified `ISBTRegistry` on Somnia's block explorer alongside the `SBTRegistry` implementation strengthens the "publicly available and accessible" characterization. No law firm has published analysis of whether interface publication specifically satisfies this requirement (weakly-sourced gap — inference from block explorer verification practice).
- **No regulatory exposure created by publishing `ISBTRegistry`**: a Solidity interface file has no executable logic, holds no funds, and creates no new DASP obligations. It is documentation-equivalent for HIPAA and GENIUS Act purposes.

**Design implication:** `ISBTRegistry` must extend `IAccessControl` and `IERC5484`, declare `AttestorCountChanged` as an interface-level event, and expose `getAttestorCount` + `getAttestorFloor` view functions. `ClaimsAdjudicator` imports only `ISBTRegistry`. Source code verification of both `ISBTRegistry` and `SBTRegistry` on Somnia's block explorer is the primary mechanism satisfying the GENIUS Act DLP "publicly available and accessible" requirement.

**Findings file:** [docs/research/somnia/isbregistry-typed-interface-design-dlp-exclusion.md](somnia/isbregistry-typed-interface-design-dlp-exclusion.md)

**Next priority questions:**
1. Should `renounceAttestorRole(bytes32 hospitalId)` require `HOSPITAL_ADMIN_ROLE` co-signature or remain permissionless (floor-guarded only) — and does admin co-signature create a liveness risk?
2. Should `getAttestorFloor()` return a network-wide constant or support per-hospital overrides (critical-access hospital carve-out) — and if per-hospital, does `ISBTRegistry` need a `getAttestorFloor(bytes32 hospitalId)` overload?
3. Should cliqueue's outside counsel DLP opinion letter specifically analyze block explorer source verification as the primary "publicly available and accessible" satisfying mechanism — committing to a statement that an unverified implementation contract breaks the DLP characterization?

---

## 2026-05-16 — SBTRegistry `_attestorCount` mapping key type: `bytes32 hospitalId` vs. `address hospitalAdmin` — key-derivation footgun analysis

**Question investigated:** Should the `_attestorCount` mapping key be `bytes32 hospitalId` (consistent with `CLIQUEUE_DOMAIN_SEPARATOR`) or `address hospitalAdmin` — and does mixing key types between `AccessControl` role hashes and the counter mapping create a key-derivation footgun?

**Key findings:**
- **`bytes32 hospitalId` is the only viable key type.** `address hospitalAdmin` fails for two structural reasons: (1) the `_grantRole(bytes32 role, address account)` override receives the `attestor` address, not the admin address; (2) multiple admin keys per hospital would create N separate counter slots rather than one per hospital, making the floor check unreliable.
- **The counter cannot be updated inside `_grantRole` override alone** because `hospitalId` is not recoverable from the role hash (keccak256 is one-way). The correct pattern uses typed public wrapper functions — `grantAttestorRole(bytes32 hospitalId, address attestor)` — where `hospitalId` is an explicit parameter; counter update and floor check happen at this layer.
- **`abi.encodePacked` must not be used** for multi-argument role hash derivation. `keccak256(abi.encode("ATTESTOR_ROLE", hospitalId))` is the safe form — `abi.encode` pads each argument to 32 bytes, eliminating boundary ambiguity. This is confirmed by Nethermind's 2024 hash collision analysis and the Smart Contract Security Field Guide. The existing `hospitalId` derivation (`keccak256(abi.encodePacked(npi, CLIQUEUE_DOMAIN_SEPARATOR))`) is safe because both arguments are fixed-length types.
- **Raw `grantRole(bytes32,address)` must be blocked**: the OZ external `grantRole` / `revokeRole` functions bypass the typed wrapper and would leave `_attestorCount` unupdated. Override both to `revert("use grantAttestorRole")`.
- **No gas difference between `bytes32` and `address` mapping key on Somnia IceDB** — both are value types padded to 32 bytes by the EVM; slot derivation cost is identical.
- **Floor enforcement belongs at `revokeAttestorRole`**, not inside `_revokeRole` — the Gnosis Safe pattern: `require(_attestorCount[hospitalId] > MIN_ATTESTERS_FLOOR, "would breach floor")` before decrementing and calling `_revokeRole`.

**Design implication:** `_attestorCount` mapping key is `bytes32 hospitalId`. Counter update and floor guard live in typed public wrapper functions (`grantAttestorRole` / `revokeAttestorRole`), not in `_grantRole`/`_revokeRole` overrides. Raw `grantRole`/`revokeRole` external functions are overridden to revert. Role hash derivation uses `keccak256(abi.encode("ATTESTOR_ROLE", hospitalId))` — `abi.encode`, not `abi.encodePacked`.

**Findings file:** [docs/research/somnia/sbtregistry-attestor-count-key-type-bytes32-vs-address.md](somnia/sbtregistry-attestor-count-key-type-bytes32-vs-address.md)

**Next priority questions:**
1. Should raw `grantRole`/`revokeRole` override-to-revert create a UUPS upgrade compatibility issue with OZ tooling that calls `grantRole(DEFAULT_ADMIN_ROLE, newAdmin)` during upgrades?
2. Should `AttestorCountChanged(bytes32 indexed hospitalId, uint32 newCount, bool isGrant)` be emitted at the wrapper layer so Ormi indexers get `hospitalId` directly without reconstructing from the role hash?
3. Does the `MIN_ATTESTERS_FLOOR = 2` bytecode constant (not governable) make cliqueue undeployable at small/critical-access hospitals — and should a per-hospital override mechanism exist with a network-level minimum?

---

## 2026-05-16 — SBTRegistry attestor count: explicit mapping vs. AccessControlEnumerable getRoleMemberCount — Somnia gas cost analysis

**Question investigated:** Should `SBTRegistry` maintain an explicit `mapping(bytes32 hospitalId => uint32) private _attestorCount` to make the minimum-attestors floor check O(1) gas, or derive the count via `getRoleMemberCount` on a per-hospital role `bytes32` using `AccessControlEnumerable` — and what are the Somnia gas cost implications of each approach?

**Key findings:**
- `getRoleMemberCount` reads exactly **1 storage slot** — it returns `_roleMembers[role]._values.length`, a single array-length slot. No enumeration; the function is O(1) on-chain. ([OZ EnumerableSet.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/structs/EnumerableSet.sol))
- `AccessControlEnumerable.grantRole` costs **2 extra SSTOREs** per credential grant/revoke vs. base `AccessControl`: `_values[len]` (array element) + `_positions[value]` (reverse index). OZ community explicitly flagged: "granting and revoking roles will be a lot more expensive with enumerability." ([OZ PR #2512](https://github.com/OpenZeppelin/openzeppelin-contracts/pull/2512))
- **Somnia cold SLOAD = 1,000,000 gas** for any slot not in the IceDB 128M-slot LRU cache. **Warm SLOAD = 100 gas.** ([Somnia Gas Docs](https://docs.somnia.network/developer/somnia-gas-differences-to-ethereum))
- **Cold SLOAD risk is REAL at claim submission time**: SBT minting occurs at onboarding (days/weeks before first claim). By the time claims are submitted at scale, the `_roleMembers[hospitalRoleHash]._values.length` slot will very likely have been evicted from the 128M LRU cache — triggering a 1M-gas cold read on every claim that checks the attestor floor.
- An **explicit `_attestorCount` mapping** has the same cold-SLOAD exposure for its own slot, but it is written on every credential change (same frequency) — and eliminates the extra EnumerableSet structural slots that add additional cold-SLOAD risk on the EnumerableSet path (which has `_values.length` + `_positions` mapping as separate slot families).
- **`AccessControlEnumerable` is not required for the floor check**: off-chain enumeration of attestors (audit dashboards, staffing reports) can be reconstructed from `RoleGranted`/`RoleRevoked` events via Ormi indexer at zero gas overhead.
- **Recommended architecture**: use base `AccessControl` + explicit `mapping(bytes32 hospitalId => uint32) private _attestorCount` updated in `_grantRole`/`_revokeRole` overrides. This is O(1) on-chain, saves 2 SSTOREs per credential operation, and minimises cold-SLOAD exposure on the claim submission hot path.

**Design implication:** `SBTRegistry` must use base `AccessControl` (not `AccessControlEnumerable`) and maintain an explicit `_attestorCount` mapping. The floor check in `ClaimsAdjudicator` reads this single slot. Off-chain enumeration is handled via event indexing in Ormi. This eliminates 2 extra SSTOREs per credential lifecycle and avoids the EnumerableSet cold-SLOAD footprint on the claim submission path.

**Findings file:** [docs/research/somnia/sbtregistry-attestor-count-mapping-vs-enumerable.md](somnia/sbtregistry-attestor-count-mapping-vs-enumerable.md)

**Next priority questions:**
1. Should the `_attestorCount` mapping use `bytes32 hospitalId` keys (consistent with the `CLIQUEUE_DOMAIN_SEPARATOR` pattern) or `address hospitalAdmin` keys — and does mixing key types create a key-derivation footgun?
2. Should `SBTRegistry` emit a dedicated `AttestorCountChanged(bytes32 hospitalId, uint32 newCount, bool isGrant)` event so off-chain indexers have a single authoritative event for count tracking?
3. At what credential-change frequency does the `_attestorCount` slot reliably stay warm in Somnia's 128M LRU cache — and should cliqueue specify a "keep-warm" operation in the deployment runbook?

---

## 2026-05-16 — Somnia inference fee governance: is there advance notice before the 0.07 SOMI/invocation fee changes, and does the September 2026 cliff unlock require disclosure?

**Question investigated:** Has the Somnia platform published a formal commitment to advance notice before changing the 0.07 SOMI/agent LLM Inference price — and should cliqueue's deployment documentation include a monitoring step and disclosure language in the hospital BAA Settlement Finality Exhibit regarding fee-change risk? Also: does the confirmed September 2026 cliff unlock (~44.73% of total supply beginning to vest) require a recommendation to hospitals about SOMI acquisition timing?

**Key findings:**
- The 0.07 SOMI per-invocation fee is **hardcoded in runner software** with no on-chain governance, no SLA, and no advance notice commitment. Somnia docs describe it as "a stop-gap" pending a future transition to dynamic on-chain pricing based on actual resource consumption. ([Somnia Docs: Agent Gas Fees](https://docs.somnia.network/agents/invoking-agents/gas-fees))
- The Validator Council controls block-level base gas economics (adjusts every 10 blocks via validator voting), but runner-level inference fees are a separate pricing layer not explicitly within Validator Council authority — governance scope ambiguity is undocumented and unresolved.
- **September 2026 cliff confirmed at ~44.73% of supply**: Team (11%), Investors (15.15%), Advisors (3.58%), Launch Partners (15%) all have 12-month cliffs with 0% at TGE (Sep 2, 2025) → first linear vesting tranches begin ~Sep 2, 2026. ([Somnia Docs: Allocation and Unlocks](https://docs.somnia.network/concepts/tokenomics/allocation-and-unlocks); [CryptoRank: SOMI Vesting](https://cryptorank.io/price/somnia/vesting))
- 50% fee burn partially offsets unlock dilution but cliqueue's burn contribution (~700 SOMI/day at 10,000 claims) is negligible against the ~415,000 SOMI/month cliff vesting tranche.
- Hospitals acquiring SOMI before September 2026 hold a depreciating asset risk; post-cliff acquisition avoids timing the unlock but creates cost uncertainty. A cost-averaging strategy is the operationally neutral path.
- Tokenomics governance is explicitly marked "to be determined" — no governance detail for fee changes is published.

**Design implication:** The hospital BAA SOMI Reserve Exhibit must include an Inference Fee Risk Disclosure section: (1) 0.07 SOMI fee is unilaterally changeable by Somnia runner operators with no notice; (2) upon Somnia's transition to dynamic pricing, cliqueue will update the Reserve Exhibit formula; (3) cliff unlock risk is disclosed with a recommendation to use a cost-averaging SOMI acquisition strategy rather than pre-buying a full buffer before September 2026. Cliqueue must subscribe to Somnia runner release notes and governance channels.

**Findings file:** [docs/research/somnia/somi-inference-fee-governance-cliff-unlock-risk.md](somnia/somi-inference-fee-governance-cliff-unlock-risk.md)

**Next priority questions:**
1. Should cliqueue publish a "Somnia Platform Dependency Risk Memo" (outside-counsel-reviewed) covering the runner fee governance gap and the September 2026 cliff unlock risk?
2. When Somnia transitions to dynamic on-chain pricing, should the SOMI circuit breaker cap per-claim cost in both SOMI terms and dollar terms?
3. Should the BAA SOMI Reserve Exhibit specify a contractual re-sizing trigger (cliqueue must issue updated exhibit within 10 business days of any >20% fee change)?

---

## 2026-05-16 — SOMI reserve holding architecture: should the hospital or cliqueue hold the SOMI reserve, and does the holding structure create securities or money-transmission compliance risk?

**Question investigated:** At 10,000 claims/day with `subcommitteeSize=5`, cliqueue requires 4,000 SOMI/day (~$672 at spot). Should the hospital or cliqueue hold this reserve, and does SOMI's ~12× ATL-ATH volatility range affect the sizing rule? Does holding SOMI create securities or money-transmission compliance issues?

**Key findings:**
- SOMI is a **digital commodity** under the March 2026 SEC-CFTC Joint Interpretive Release five-category taxonomy — native blockchain gas tokens are explicitly not securities. Holding SOMI for operational gas payments does not make the holder a securities dealer. ([WilmerHale: SEC Howey Framework March 2026](https://www.wilmerhale.com/en/insights/client-alerts/20260324-the-secs-new-framework-for-crypto-assets-under-howey); [Katten: SEC-CFTC Clarity March 2026](https://katten.com/the-sec-and-cftc-provide-crypto-clarity-most-crypto-assets-are-not-securities))
- Under FinCEN FIN-2019-G001, a hospital holding SOMI on its own balance sheet and spending it for its own claim submissions is a **"user"** — not an administrator or exchanger — and is therefore not a Money Services Business. MSB registration is not required for own-account operational use. ([FinCEN FIN-2019-G001](https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf))
- **Critical risk**: If cliqueue holds a **pooled SOMI reserve** funded by multiple hospitals and allocates/refunds SOMI per hospital, cliqueue shifts toward the "exchanger" classification and likely triggers MSB status. The pool model must be avoided. Hospital-held individual treasury (Architecture H) is the compliant MVP path.
- The Somnia `AgentRequester` contract holds the SOMI deposit in escrow during each LLM Inference request. `ClaimsAdjudicator` itself holds zero SOMI between invocations — SOMI enters at `msg.value` and immediately transfers to platform escrow. Unused operations reserve is rebated automatically on finalisation. ([Somnia Docs: Agent Gas Fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md))
- **September 2026 cliff unlock risk**: SOMI TGE was September 2, 2025; team (11%) and investor (15.5%) tokens have 12-month cliffs — meaning major unlock waves (~26% of total supply entering vesting) begin September 2026, 4 months from now. This creates structural downward price pressure. ([GlobeNewswire: Somnia Mainnet Launch](https://www.globenewswire.com/news-release/2025/09/02/3143031/0/en/Somnia-Launches-Mainnet-and-SOMI-Token-to-Power-Real-World-Applications-Following-10-Billion-Testnet-Transactions.html))
- **Reserve sizing rule**: Hold 30-day SOMI buffer at 2× the 6-month average SOMI price. At 10,000 claims/day: 120,000 SOMI × 2× multiplier = 240,000 SOMI (~$40,320 at spot, ~$441,600 at ATH). Review monthly against circuit-breaker thresholds.
- IRS treats SOMI as property (Notice 2014-21). Each claim submission spend is a taxable disposal event. Nonprofit hospitals must track SOMI cost basis for UBTI analysis. Hospital onboarding must include a tax counsel engagement recommendation.

**Design implication:** The hospital holds SOMI on its own balance sheet (Architecture H) as the only compliant MVP structure. cliqueue must never pool SOMI on behalf of multiple hospital customers. The `ClaimsAdjudicator` deployment runbook must include a SOMI Reserve Exhibit covering acquisition, multisig wallet setup, 30-day buffer sizing at 2× 6-month average price, and tax counsel engagement. The September 2026 cliff unlock is a near-term risk factor that belongs in the hospital onboarding disclosure package.

**Findings file:** [docs/research/somnia/somi-reserve-holding-architecture-compliance.md](somnia/somi-reserve-holding-architecture-compliance.md)

**Next priority questions:**
1. Should the SOMI Reserve Exhibit be a binding BAA attachment — with a minimum buffer covenant before first claim submission — and what is cliqueue's liability if the hospital depletes its reserve causing stuck claims mid-batch?
2. Does the September 2026 SOMI cliff unlock justify recommending hospitals acquire SOMI post-cliff rather than pre-cliff?
3. Should cliqueue's deployment runbook explicitly prohibit pooled SOMI holding and document the MSB risk in the compliance self-assessment checklist?

---

## 2026-05-16 — hmacSalt key-exchange BA relationship: does transmitting the verification key create a BA relationship between cliqueue and the payer?

**Question investigated:** Under Architecture A, cliqueue must transmit the hmacSalt key (used to generate `claimId = HMAC(CLM01 || providerAddress || hmacSalt)`) to the payer so the payer can verify the on-chain hash matches its adjudicated claim. Does transmitting this key create a new HIPAA Business Associate relationship between cliqueue and the payer — given that the hmacSalt enables PHI-linkage when combined with CLM01 the payer already holds?

**Key findings:**
- The hmacSalt is definitively not PHI under 45 CFR 160.103: it contains no health information, no individual identifier, and cannot by itself identify anyone. Transmitting it does not satisfy the PHI-transmission prong of the BA definition. ([45 CFR 160.103](https://www.govinfo.gov/content/pkg/CFR-2013-title45-vol1/pdf/CFR-2013-title45-vol1-sec160-103.pdf); [HHS FAQ 256](https://www.hhs.gov/hipaa/for-professionals/faq/256/is-software-vendor-business-associate/index.html))
- 45 CFR §164.514(c) prohibits covered entities from disclosing the "mechanism for re-identification" to recipients of de-identified data. However, the payer is not a recipient of de-identified data — it independently holds the full adjudicated claim (CLM01 + PHI). The salt enables the payer to verify a hash of its own record. This is an inter-covered-entity authentication protocol, not a de-identification key disclosure. No OCR enforcement action has ruled on this specific fact pattern. ([45 CFR §164.514(c)](https://www.law.cornell.edu/cfr/text/45/164.514))
- HHS FAQ 253 establishes that providers and payers are each covered entities acting on their own behalf in the claims relationship — neither is the BA of the other. cliqueue routing the hmacSalt between two covered entities in the context of their existing claims relationship does not itself make cliqueue a BA of the payer. ([HHS FAQ 253](https://www.hhs.gov/hipaa/for-professionals/faq/253/is-health-care-provider-considered-to-be-a-business-associate/index.html))
- If cliqueue persistently stores the hmacSalt (rather than routing-only), the conservative BA risk increases materially under HHS FAQ 2076 (CSP that stores data on behalf of covered entity is a BA even without decryption key). ([HHS FAQ 2076](https://www.hhs.gov/hipaa/for-professionals/faq/2076/if-a-csp-stores-only-encrypted-ephi-and-does-not-have-a-decryption-key-is-it-a-hipaa-business-associate/index.html))
- The 2026 HIPAA Security Rule NPRM's tightening of BA verification requirements means hospital privacy officers will apply a conservative presumption — even without formal BA status, a hospital may require a BAA with cliqueue as a precaution. ([HIPAA Security Rule NPRM Jan 2025](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information))
- The preferred Architecture A key-exchange design eliminates cliqueue's salt-routing risk entirely: hospital delivers hmacSalt directly to payer via its own BAA-governed channel, bypassing cliqueue. cliqueue never stores or routes the salt.

**Design implication:** cliqueue does not become a BA of the payer by transmitting the hmacSalt under a strict 45 CFR 160.103 analysis (salt is not PHI). However, §164.514(c) places the re-identification mechanism non-disclosure obligation on the hospital — hospital counsel must confirm that sharing the salt with the payer (a covered entity in the existing claims relationship) is permissible before cliqueue routes it. The recommended architecture change: hospital delivers hmacSalt directly to payer via its own BAA-governed channel (bypassing cliqueue entirely), eliminating cliqueue's exposure. If cliqueue must route the salt, it should use a pass-through-only channel with zero persistent storage, documented in a "Non-PHI Key Routing Memo."

**Findings file:** [docs/research/agreement-layer/hmacsalt-key-exchange-ba-relationship-analysis.md](agreement-layer/hmacsalt-key-exchange-ba-relationship-analysis.md)

**Next priority questions:**
1. Should the Architecture A key-exchange be hospital-direct-to-payer (hospital delivers hmacSalt to payer via its own BAA-governed channel, bypassing cliqueue entirely) — eliminating cliqueue's salt-routing risk?
2. Should cliqueue publish a "Non-PHI Key Routing Memo" (outside-counsel-reviewed) covering the hmacSalt under 45 CFR 160.103 and §164.514(c) — so hospital privacy officers have documented external legal support?
3. If the hospital's payer contract requires all claim-related data exchange through an approved clearinghouse, does routing the hmacSalt directly from hospital to payer still satisfy that contractual requirement — or does the salt exchange require separate documentation as a non-clearinghouse supplemental integration?

---

## 2026-05-16 — Payer contract exclusivity: does cliqueue require explicit payer permission before hospital deployment?

**Question investigated:** Given that payer contract exclusivity clauses bind providers to specific clearinghouses (36% of AMA survey respondents after Change Healthcare), does cliqueue's on-chain settlement layer require explicit payer permission (or contract amendment) before a hospital can add it alongside its existing clearinghouse — and should the onboarding checklist include a payer-approval legal review step?

**Key findings:**
- Documented payer exclusivity clauses (Anthem/Availity, UHC/Optum) govern **EDI transaction routing** only — the 837 submission and 835 remittance channel. No publicly available payer contract or attorney analysis documents a restriction on supplemental non-EDI post-adjudication settlement confirmation systems. Cliqueue does not re-route 837 submissions; it anchors hashes post-adjudication through a categorically different channel. ([Anthem EDI](https://www.anthem.com/provider/individual-commercial/edi); [UHC Clearinghouse Options](https://www.uhcprovider.com/en/resource-library/edi/edi-clearinghouse-opt.html))
- UnitedHealthcare explicitly states no clearinghouse endorsement and allows any approved clearinghouse — making UHC hospitals the lowest contractual-exclusivity risk tier for cliqueue onboarding. Anthem's Availity requirement is the highest-risk payer for contract review.
- CAA-21 (Section 201) prohibits payer contracts from restricting a hospital from sharing de-identified claims data with a business associate. DOL FAQ Part 69 (January 14, 2025) strengthened this: any clause restricting BA data access "at the discretion of" a TPA or service vendor is an **impermissible gag clause**. Cliqueue as a de-identified claims BA is squarely protected. ([CMS CAA-21](https://www.cms.gov/marketplace/about/oversight/other-insurance-protections/consolidated-appropriations-act-2021-caa); [WTW: DOL FAQ Part 69](https://www.wtwco.com/en-us/insights/2025/02/departments-issue-guidance-on-gag-clause-prohibition-and-no-surprises-act))
- The AMA "36% contractual barrier" figure refers to barriers to **switching the primary EDI clearinghouse** (replacing the 837 submission channel) — not barriers to adding a supplemental post-adjudication settlement layer. The contractual risk is narrower than the 36% figure implies.
- The BCBS $2.8B antitrust settlement (finalized 2024) required elimination of anti-steering, all-or-nothing, and gag clauses from payer network agreements. The March 2026 DOJ second antitrust case reinforces that new exclusivity restrictions in healthcare data sharing face active antitrust scrutiny.
- No regulatory authority (HIPAA, CAQH CORE, CMS) requires payer permission before adding a supplemental non-EDI settlement layer. The appropriate onboarding step is a **targeted contract review** by hospital counsel, not a payer permission request or amendment.

**Design implication:** No payer permission gate is required before hospital deployment. The onboarding checklist should include a targeted payer contract review scoped to post-adjudication data sharing with non-clearinghouse BAs. The hospital BAA should include a CAA-21 defense exhibit (citing DOL FAQ Part 69) that hospital counsel can invoke if a payer objects. Cliqueue should be documented as a business associate (not a clearinghouse substitute) in all onboarding materials — this classification is the basis of the CAA-21 gag clause defense. Onboarding should segment payer-specific risk: UHC hospitals are lowest-risk; Anthem/Availity hospitals require focused contract review of any clause covering "data sharing with non-clearinghouse third parties."

**Findings file:** [docs/research/market/payer-contract-exclusivity-permission-requirement.md](market/payer-contract-exclusivity-permission-requirement.md)

**Next priority questions:**
1. Should the hospital BAA include a specific "CAA-21 Gag Clause Defense Exhibit" citing DOL FAQ Part 69 (January 2025) — so hospital counsel has a ready-made response when a payer raises a contractual objection to cliqueue access?
2. Should cliqueue's onboarding documentation segment payer-specific risk (Anthem/Availity-gateway hospitals vs. UHC hospitals) and recommend different contract review scopes accordingly — reducing onboarding time for the majority of hospitals with flexible payer clearinghouse policies?
3. Should cliqueue publish a one-page "Settlement Layer Non-Clearinghouse Determination Memo" establishing that the on-chain layer is not a healthcare clearinghouse (not subject to HIPAA clearinghouse obligations) and not a 837/835 EDI transaction (not subject to CAQH CORE operating rules), as a companion to the CAQH CORE Non-Applicability Memo?

---

## 2026-05-16 — Architecture A payer integration barrier: claimId-only webhook and payer CLM01 cross-reference

**Question investigated:** For Architecture A (cliqueue-operated dispute-listener that fires only `{ claimId, disputeWindowEnd, contractAddress }` to a payer webhook), does requiring the payer to perform its own `(claimId → payer claim reference)` lookup create a real integration barrier — and is there a viable lookup mechanism the payer can use without cliqueue providing enrichment?

**Key findings:**
- X12 EDI's CLM01 (provider-assigned patient control number from 837) is echoed verbatim as CLP01 in the 835 ERA and in 277 claim status responses — this is the canonical payer-side cross-reference to the provider's claim reference. Payer adjudication systems are built to query by CLP01 internally. Architecture A is viable **only if** `claimId = HMAC(CLM01 || providerAddress || hmacSalt)` — the payer re-derives the HMAC using CLM01 from their own system to verify the received hash. ([BCBS NC 835 Companion Guide](https://www.bluecrossnc.com/content/dam/bcbsnc/pdf/providers/network-participation/hipaa/835-5010-v3-0.pdf))
- If `claimId` is a purely opaque identifier unrelated to any X12 field, the payer has no standard lookup mechanism. No EDI transaction (837/835/276/277) provides a hook for matching an external opaque hash to an adjudicated claim.
- Payer adjudication systems do not support inbound push webhooks for supplemental settlement notifications. The current landscape is pull-based (276/277). Waystar and Claim.MD offer outbound webhooks to providers but not inbound supplemental event receivers. A payer must build a net-new integration receiver.
- The payer integration lift (building a CLM01-HMAC receiver) is 1–3 engineering sprints — real but not insurmountable — yet requires payer willingness to invest. For initial deployments, this is a meaningful barrier.
- Architecture B (hospital self-hosted listener that enriches notifications with CLM01/ICN internally before delivering to the payer) sidesteps the payer integration lift entirely. The payer receives a standard claim reference they already understand.
- Avaneer Health (Aetna/Anthem/Elevance consortium blockchain for real-time adjudication) is the closest public precedent but uses a permissioned chain and bilateral enrollment — no public claim identifier scheme documented. ([Avaneer Health](https://avaneerhealth.com))

**Design implication:** Architecture B (hospital self-hosted listener) should be the primary recommended path for the first production deployment because it requires zero new payer development. Architecture A (cliqueue-operated, claimId-only) should be the preferred long-term architecture for payer-sophisticated deployments where the payer is willing to build a CLM01-HMAC verification receiver. The onboarding checklist must include a "Payer Readiness Questionnaire" gating Architecture A selection. The `hmacSalt` key-exchange under Architecture A requires BAA-governed delivery to the payer and must not be on-chain.

**Findings file:** [docs/research/agreement-layer/architecture-a-payer-integration-barrier-claimid-lookup.md](agreement-layer/architecture-a-payer-integration-barrier-claimid-lookup.md)

**Next priority questions:**
1. Should the onboarding checklist include a formal "Payer Readiness Questionnaire" assessing payer ability to build a CLM01-HMAC verification receiver before Architecture A is selected?
2. Does the `hmacSalt` key-exchange with the payer under Architecture A create a new BA relationship for cliqueue — since cliqueue would be transmitting a key that enables reconstruction of PHI-linked claim references?
3. Should cliqueue publish a reference TypeScript implementation of Architecture B's hospital self-hosted listener in the open-source repo?

---

## 2026-05-16 — Dispute-listener middleware deployment model and BAA obligations

**Question investigated:** Should the cliqueue dispute-listener middleware be a standalone TypeScript service deployed by cliqueue, or a hospital-deployed integration module — and does the choice affect BAA obligations (if cliqueue runs it, cliqueue is a BA processing PHI-adjacent claim references)?

**Key findings:**
- HIPAA BA status (45 CFR 160.103) turns on whether an entity creates, receives, maintains, or transmits PHI. The dispute-listener processes only `bytes32 claimId` (HMAC hash), `address disputant` (wallet address), and `uint256 disputeWindowEnd` (timestamp) — none qualify as PHI. Neither deployment model (cliqueue-hosted or hospital-self-hosted) triggers BA status as long as the listener does not connect to the hospital's off-chain EDI mapping store.
- HHS OCR FAQ 256 is the governing authority: "the mere selling or providing of software to a covered entity does not give rise to a business associate relationship if the vendor does not have access to the protected health information." ([HHS FAQ 256](https://www.hhs.gov/hipaa/for-professionals/faq/256/is-software-vendor-business-associate/index.html))
- Two viable architectures: **Architecture A** — cliqueue-operated, fires only `{ claimId, disputeWindowEnd, contractAddress }` to payer webhook, payer performs EDI lookup; BA status not triggered for cliqueue. **Architecture B** — hospital self-hosted, performs `(claimId → CLM01)` lookup internally, fires enriched payer notification; BA status not triggered for cliqueue because cliqueue never runs this instance.
- If cliqueue ever adds an enrichment step connecting to the hospital's EDI mapping store, BA status immediately attaches — this must be treated as a hard product feature gate.
- The Mirth Connect self-hosted vs. vendor-hosted precedent validates this two-architecture model: vendor-hosted with PHI access requires BAA; self-hosted by hospital with no vendor remote access does not trigger vendor BA obligations.
- The 2026 HIPAA Security Rule NPRM (proposed, not finalized) tightens BA verification requirements — hospital procurement will apply a conservative presumption of BA status to any vendor service touching claim data. A proactive outside-counsel "Non-PHI Determination Memo" is more valuable than internal self-assessment alone.

**Design implication:** MVP should use Architecture A (cliqueue-operated, fires claimId hash only), with Architecture B (hospital self-hosted) as an optional path for hospital-IT-mature deployments. Onboarding documentation must include a one-paragraph "Non-PHI Determination" section citing HHS OCR FAQ 256. The enrichment gate (adding EDI mapping access) must be a hard product spec feature gate requiring executed BAA before enablement.

**Findings file:** [docs/research/somnia/dispute-listener-middleware-deployment-baa-obligations.md](somnia/dispute-listener-middleware-deployment-baa-obligations.md)

**Next priority questions:**
1. Should cliqueue publish a formal "Non-PHI Determination Memo" (outside-counsel-reviewed) covering all cliqueue-operated services — given the 2026 HIPAA Security Rule BA verification tightening?
2. Does Architecture A require payer-side `(claimId → payer claim reference)` lookup capability, creating a payer integration barrier — and should the onboarding checklist include a payer readiness questionnaire?
3. If cliqueue adds EDI mapping enrichment to the listener, does that single addition make cliqueue a BA — and should this be a hard feature gate in the product spec requiring executed BAA before enablement?

---

## 2026-05-16 — Somnia per-claim gas economics: LLM Inference cost vs. $4–10 outsourced coding benchmark

**Question investigated:** What is the actual per-claim gas cost (in USD) for a Somnia native `createAdvancedRequest(subcommitteeSize=5)` LLM Inference call, and does it validate cliqueue's core economic thesis?

**Key findings:**
- Official Somnia Agents pricing (docs.somnia.network): LLM Inference = **0.07 SOMI per agent slot**; minPerAgentDeposit = 0.01 SOMI per slot (operations reserve).
- Total deposit formula: `(0.01 × subSize) + (0.07 × subSize)` = **0.24 SOMI (sub=3)** or **0.40 SOMI (sub=5)**.
- At SOMI spot price ($0.168, May 16 2026): sub=3 costs **$0.040/claim**; sub=5 costs **$0.067/claim** for the Somnia oracle layer alone.
- Full pipeline (Corti Symphony + Somnia oracle + EVM gas): **$0.054–$0.068/claim** (sub=3) or **$0.082–$0.095/claim** (sub=5) at current prices — **43–185× cheaper than $4–10 outsourced benchmark**.
- Even at SOMI ATH ($1.84), sub=5 costs ~$0.77/claim — still **5× below the $4 outsourced floor**.
- The $0.03/invocation figure in prior research was the JSON API price, not LLM Inference. LLM Inference is 0.07 SOMI/slot, not 0.03 SOMI.
- `getAdvancedRequestDeposit(subcommitteeSize)` is the on-chain helper for dynamic deposit sizing — cliqueue must NOT hardcode SOMI amounts.
- SOMI price volatility (ATL $0.1482 / ATH $1.84 = 12× range) is the primary cost uncertainty. A `SOMI_PRICE_CIRCUIT_BREAKER` in the off-chain agent layer (auto-reduce sub=5 → sub=3 if cost exceeds ceiling) is recommended.
- Daily SOMI reserve requirement at 10,000 claims/day with sub=5: **4,000 SOMI/day (~$672/day at spot)**. Reserve sizing must account for ATH price scenario.

**Design implication:** The economic thesis is strongly validated. cliqueue's combined per-claim cost at sub=5 ($0.092 spot) is 43× cheaper than the $4 floor and remains favorable at SOMI ATH. Immediate spec changes: (1) correct the $0.03/invocation figure in all prior docs to reflect 0.07 SOMI for LLM Inference; (2) require dynamic `getAdvancedRequestDeposit()` calls rather than hardcoded deposits; (3) add `SOMI_PRICE_CIRCUIT_BREAKER` and reserve buffer sizing to the off-chain agent spec.

**Findings file:** [docs/research/somnia/per-claim-gas-economics-llm-inference-cost.md](somnia/per-claim-gas-economics-llm-inference-cost.md)

**Next priority questions:**
1. Should cliqueue implement a `SOMI_PRICE_CIRCUIT_BREAKER` that auto-reduces subcommitteeSize when per-claim cost exceeds a threshold?
2. Is the 0.07 SOMI LLM Inference price Somnia-governance-controlled or fixed — and what disclosure is owed to hospital procurement?
3. How should the SOMI reserve buffer be sized at 10,000 claims/day accounting for ATH price scenario?

---

## 2026-05-16 — Somnia OpPC challenge window: BFT finality architecture and application-layer dispute window design

**Question investigated:** What is the actual Somnia OpPC challenge window duration — is the 48-hour assumption validated anywhere in Somnia's documentation, and does a longer window fundamentally change the dispute-tier mirror contract requirement?

**Key findings:**
- Somnia uses BFT (MultiStream/PBFT-based) consensus with sub-second finality — there is NO protocol-level challenge window. The "OpPC challenge window" referenced in prior research is an application-layer parameter entirely within cliqueue's control.
- The `createAdvancedRequest timeout` (default 15 minutes) is the LLM Inference oracle timeout, completely separate from the claims dispute window.
- No Somnia documentation, template, or hackathon project provides a reference dispute-window implementation for healthcare claims.
- 48-hour (172,800 seconds) application-layer window is defensible: matches payer review timelines; cold-SLOAD cost (~$0.018 per disputed claim) is negligible at current Somnia gas pricing.
- `disputeWindowSeconds` must be a governance-controlled variable, not hardcoded.

**Design implication:** `ClaimsAdjudicator` needs a governance-controlled `uint256 disputeWindowSeconds` (defaulting to 172,800 = 48 hours). The ERC-7201 `DisputeStorage` pattern (warm dispute record written at initiation) mitigates cold-SLOAD risk at resolution. Cold-SLOAD cost scales with window length but is cheap enough at current pricing to not constrain the window choice.

**Findings file:** [docs/research/somnia/oppc-challenge-window-bft-finality-architecture.md](somnia/oppc-challenge-window-bft-finality-architecture.md)

**Next priority questions:**
1. Should `disputeWindowSeconds` have a network-level minimum floor (6 hours) documented in the hospital BAA as a settlement finality guarantee?
2. Should `ClaimDisputed` event include `disputeWindowEnd` timestamp for payer back-office WebSocket subscriptions?
3. At what claim volume does simultaneous cold-SLOAD dispute costs approach the block gas limit?

---

## 2026-04-10 — Three more frontend contract bugs; ICD-28 updated

**Status:** Decided
**Next:** Complete — ICD-28 updated with Bugs 11–13; all three are frontend-only `ui/` fixes

A second audit pass against the remaining handler/component contracts found three more
integration bugs not yet in ICD-28. All are silent failures at runtime — no build error.

**Bug 11 — `reviewSuggestion` field name mismatch: accept/reject always returns 400.**
`api.ts` sends `body: JSON.stringify({ status })`, e.g. `{"status": "accepted"}`.
`crates/api/src/handlers/suggestions.rs` defines `ReviewRequest { decision: String, ... }`.
Serde deserializes with `decision = ""` (missing field gets empty/default). The `match` arm
`_ => return Err(ApiError::BadRequest("invalid decision".into()))` fires every time.
The error is silently caught in `ReviewPage.tsx`'s `handleDecision` catch block, which reverts
the optimistic update. To the coder it appears the buttons are broken — clicking accept/reject
bounces back to pending. Fix: change `{ status }` → `{ decision: status }` in `api.ts`.

**Bug 12 — `CodeSearchResult.description` vs `IcdCode.short_desc`: code lookup always blank.**
`searchCodes` in `api.ts` returns `Vec<IcdCode>` from `search_by_description`, which serde
serializes with the struct field name `short_desc`. The TypeScript `CodeSearchResult` interface
had `description: string`. `CodeLookup.tsx` renders `{r.description}` → `undefined` → blank.
The code chips show the code string correctly but no description text. Fix: rename
`CodeSearchResult.description` → `short_desc: string` in `types.ts`; update `CodeLookup.tsx`
to use `r.short_desc`. (Keeping the fix frontend-side preserves ICD-28 as a `ui/`-only card.)

**Bug 13 — `submitTask` sends `string[]` but handler expects `ManualCodeInput[]`: submit fails.**
`submitTask` sends `{ manual_codes: manualCodes }` where `manualCodes: string[]`, e.g.
`{"manual_codes": ["E11.621"]}`. `SubmitRequest` in `tasks.rs` declares:
`manual_codes: Option<Vec<ManualCodeInput>>` where `ManualCodeInput = {code: String, reasoning: Option<String>}`.
Serde attempts to deserialize the JSON string `"E11.621"` into a `ManualCodeInput` struct →
422 Unprocessable Entity. Any submission that includes manually added codes fails silently
(the submit button re-enables, error state is set). Fix: change `submitTask` to map:
`manual_codes: manualCodes.map(code => ({ code, reasoning: null }))`.

**Total integration bug count: 13 (Bugs 1–10 from prior audits, Bugs 11–13 this pass).**
All 13 are now captured in ICD-28 (frontend) or ICD-29 (backend/CDK). Both cards are Agent Ready.

**Alternatives surfaced (future research tasks):**
- Could rename `ReviewRequest.decision` → `status` on the Rust side to match the TypeScript idiom, but `decision` is semantically more accurate for a coder's verdict and the TypeScript fix is zero Rust changes
- Could project `{code, description}` from the `codes.rs` handler instead of renaming the TypeScript type, but that would require a wrapper struct in a Rust file and break ICD-28 being frontend-only

---

## 2026-04-10 — Full UI component audit: two more integration bugs; ICD-26 split into ICD-28 + ICD-29

**Status:** Decided
**Next:** Complete — ICD-28 (frontend) and ICD-29 (backend/CDK) created as parallel Agent Ready cards; ICD-26 superseded

All remaining UI components audited against the actual API response shapes. Two more
integration bugs found, completing the pre-deploy integration checklist. ICD-26 was split
into two non-overlapping parallel cards to halve implementation time.

**Bug 9 — `Task.id` vs `task_id`: task list entirely broken.**
`db::app::tasks::Task` serialises its primary key as `"id"` (the struct field name). The
TypeScript `Task` interface uses `task_id`. `GET /api/v1/tasks` (via `list_tasks_for_user`)
returns `Vec<Task>` serialised as `[{"id": "...", ...}]`. `TaskList.tsx` then accesses
`t.task_id` → `undefined`, so `key={t.task_id}` is undefined, the date renders as `Invalid
Date`, and the review link navigates to `/tasks/undefined/review`. The entire task list page
is broken.

Note: the `POST /api/v1/tasks` (upload) handler manually constructs
`json!({"task_id": task.id, "status": task.status})` — so `uploadTask()` gets the correct
`task_id`. But `listTasks()` does not. The mismatch is between the two endpoints.

Fix: add `#[serde(rename = "task_id")]` to the `id` field in `db::app::tasks::Task`, and
update the upload handler to return `Json(task)` directly (instead of the manual
`serde_json::json!` construction) so all Task responses are consistent and include
`created_at`.

**Bug 10 — `upload` response omits `created_at`; optimistic add shows `Invalid Date`.**
`UploadPage.tsx` does `setTasks((prev) => [task, ...prev])` after upload, placing the
newly created task at the top of the list immediately. `TaskList.tsx` then calls
`new Date(t.created_at).toLocaleString()`. But the upload response `{"task_id": ..., "status": ...}`
has no `created_at`. The rendered timestamp is `Invalid Date`.

Fix: covered by Bug 9 fix — returning `Json(task)` from the upload handler includes
`created_at` from the DB row.

**What was confirmed correct:**
- `UploadPage.tsx`: polling logic, file reader, form handling — all correct once `uploadTask`
  sends `text/plain` (ICD-28)
- `SuggestionCard.tsx`: renders `{s.short_desc}` at line 39 — will be `null` after the
  LEFT JOIN adds `short_desc: Option<String>`. TypeScript type needs `short_desc: string | null`;
  the component renders empty string for `null` which is acceptable
- `TaskList.tsx`: badge logic and routing are correct once `task_id` is fixed
- `App.tsx`: routes match component params
- Review page route `/tasks/:id/review` matches `TaskList` link `/tasks/${t.task_id}/review` ✓

**Decision: split ICD-26 into ICD-28 (frontend) and ICD-29 (backend/CDK).**
ICD-26 accumulated 9 fixes across two completely non-overlapping file sets: `ui/` (TypeScript
only) and `infra/ + crates/` (CDK + Rust only). Running two parallel Codex agents on these
sets eliminates sequential bottleneck and reduces implementation wall-clock time by ~50%.
ICD-26 is superseded; ICD-28 and ICD-29 are the implementation cards.

---

## 2026-04-10 — Deployment runbook audit: four command bugs corrected

**Status:** Decided
**Next:** Complete — runbook patched in-place; ICD-26 updated with CfnOutput additions

The deployment runbook written in the previous iteration was audited against the actual
CDK stacks, SQL migrations, and seed files. Four bugs found and fixed.

**Bug 1 — `DbEndpoint` and `DbSecretArn` CfnOutputs don't exist (Steps 6).**
The runbook's Step 6 used `aws cloudformation describe-stacks --query ...DbEndpoint...`
and `...DbSecretArn...`. `DatabaseStack` has no `CfnOutput` declarations — only
`ApiStack` has one (`ApiUrl`). Steps 6 would silently return empty strings, causing
`DATABASE_URL` to be malformed. Fixed by rewriting Step 6 to use `aws rds describe-db-instances`
and `aws secretsmanager list-secrets` as fallback commands. ICD-26 now carries a comment
to add the CfnOutputs to `DatabaseStack`, which will let Step 6 use the cleaner
`describe-stacks` commands post-ICD-26.

**Bug 2 — `EtlBucketName` CfnOutput doesn't exist (Step 7).**
Same pattern: `EtlStack` has no `CfnOutput`. Step 7a referenced
`Stacks[0].Outputs[?OutputKey==\`EtlBucketName\`]` which would return empty. Fixed by
using `aws s3api list-buckets --query 'Buckets[?starts_with(Name, \`cliqueue-etl-\`)].Name'`
as the fallback.

**Bug 3 — Wrong `cargo run` command for `embed_runner` (Step 7b).**
`embed_runner` is in `crates/etl/src/bin/` (the `etl` crate, not the workspace root).
`cargo run --release --bin embed_runner` resolves ambiguously in a workspace. Correct
command is `cargo run --release -p etl --bin embed_runner`.

**Bug 4 — Wrong column name in demo user seed command (Step 8).**
The inline `psql` command used `display_name` but `app.users` schema has column `name`
(see `sql/migrations/002_app_schema.sql`). Also, a correct seed file already exists at
`sql/seed/001_demo_user.sql`. Replaced the inline command with `psql "${DATABASE_URL}" -f sql/seed/001_demo_user.sql`.

**What was confirmed correct:**
- `docker-compose.yml` uses `pgvector/pgvector:pg16` — correct multi-arch image that
  includes pgvector; works on ARM64 (Raspberry Pi) and AMD64 without `platform:` override.
- `sql/migrations/001_reference_schema.sql` begins with `CREATE EXTENSION IF NOT EXISTS vector;`
  — pgvector is enabled as part of the normal migration run, not as a separate step.
- `sql/seed/001_demo_user.sql` exists, uses correct column names, correct UUID, and
  `ON CONFLICT (id) DO NOTHING` so it's safe to run multiple times.

**CfnOutputs to add (carried in ICD-26 comment):**

`infra/lib/database-stack.ts` — add after `this.dbInstance` is constructed:
```typescript
new cdk.CfnOutput(this, 'DbEndpoint', {
  value:       this.dbInstance.dbInstanceEndpointAddress,
  description: 'RDS endpoint — use as DB_ENDPOINT in Lambda env and for local migration runs',
  exportName:  'CliQueueDbEndpoint',
});
new cdk.CfnOutput(this, 'DbSecretArn', {
  value:       this.dbInstance.secret!.secretArn,
  description: 'Secrets Manager ARN for RDS cliqueue credentials',
  exportName:  'CliQueueDbSecretArn',
});
```

`infra/lib/etl-stack.ts` — add after `this.etlBucket` is constructed:
```typescript
new cdk.CfnOutput(this, 'EtlBucketName', {
  value:       this.etlBucket.bucketName,
  description: 'S3 bucket for CMS ETL source files — pass to cms_parser Lambda payload',
  exportName:  'CliQueueEtlBucket',
});
```

**Alternatives surfaced (future research tasks):**
- CDK context values (via `cdk.json`) could store these at synth time, avoiding the runtime
  `describe-stacks` calls — but CfnOutputs are simpler and more standard.

---

## 2026-04-10 — CI and API shape audit: three blockers before first green build

**Status:** Decided
**Next:** Complete — ICD-26 updated with two additional API fixes; deployment runbook written at `docs/technical-design/deployment-runbook.md`

Three gaps found that must be resolved before CI goes green and the demo is runnable.

**Gap 1 — Empty `.sqlx/` directory blocks CI `cargo check`.**
The CI `check` job runs `cargo check --workspace` with `SQLX_OFFLINE=true`. Seven source
files use `query!` macros (`db` and `etl` crates). SQLx offline mode requires `.sqlx/*.json`
metadata files — one per unique `query!` macro — to be committed. The `.sqlx/` directory
exists but is empty (0 files). On first CI run after push, `cargo check` will fail at the
first `query!` expansion with a SQLx offline metadata error. Fix: Thomas must run
`make db-up && make migrate && make sqlx-prepare` locally (requires Docker) then commit the
resulting `.sqlx/` files. This is a one-time bootstrap; all subsequent developers inherit
the committed cache. The CI decision doc already specifies this pattern ("Option B: Commit
`.sqlx/` + `SQLX_OFFLINE=true` ✓ CHOSEN") — it just hasn't been done yet. See
`docs/technical-design/deployment-runbook.md` step 2.

**Gap 2 — `ReviewData` TypeScript type is flat; API returns nested shape.**
`ui/src/types.ts`'s `ReviewData` interface has:
```typescript
{ task_id: string; encounter_id: string; original_text: string; suggestions: Suggestion[]; }
```
The Axum `review` handler (`crates/api/src/handlers/tasks.rs:182`) returns:
```json
{ "task": {...}, "encounter": {...}, "suggestions": [...], "manual_codes": [...] }
```
`ReviewPage.tsx` accesses `review.encounter_id` (line 127) and `review.original_text`
(line 129) — both will be `undefined` at runtime. The page will render an empty document
viewer. Fix: update `ReviewData` to match the nested API shape, or add `encounter` and
`task` sub-interfaces. Also: add `ManualCode[]` type for the manual codes array. Added
to ICD-26 as a comment.

**Gap 3 — `Suggestion.short_desc` missing from `list_suggestions` response.**
`ui/src/types.ts`'s `Suggestion` interface requires `short_desc: string`. The
`db::pipeline::code_suggestions::list_suggestions` function queries only
`pipeline.code_suggestions` — no JOIN with `reference.icd_codes`. The serialised
`CodeSuggestion` struct has no `short_desc` field. In the review page, `SuggestionCard`
will receive `short_desc: undefined` and display a blank code description. Fix: add a
`list_suggestions_with_desc` query (or update `list_suggestions`) with a LEFT JOIN to
`reference.icd_codes ON suggested_code = code`, returning `icd_codes.short_desc`. Added
to ICD-26 as a comment.

**What is working correctly:**
- The CI `frontend` job: `npm run build` in `ui/` will succeed because `package-lock.json`
  is committed and Vite's TypeScript checking catches structural errors at build time. The
  `ReviewData` mismatch may not be caught at build time (TypeScript can't validate runtime
  JSON shapes against types without runtime validators), so the build passes but the page
  fails at runtime.
- The CI `build-lambdas` job: `cargo lambda build --release --arm64` is structurally
  correct. It will fail if `.sqlx/` is empty for the same reason as `cargo check`.

**Alternatives surfaced (future research tasks):**
- `zod` for runtime API response validation: TypeScript's static types don't validate
  actual HTTP response shapes. A `zod` schema for `ReviewData` would catch the mismatch
  at runtime and surface a clear error. Low-cost addition for V2.
- CI Postgres service container (alternative to committed `.sqlx/`): `services:` block in
  the GitHub Actions `check` job spins up a real Postgres. Eliminates the `.sqlx/`
  bootstrap step but makes CI ~2 minutes slower and adds `DATABASE_URL` secret to CI.

---

## 2026-04-10 — Stage 3 Haiku prompt audit: missing ICD-10-CM coding rules

**Status:** Decided
**Next:** Complete — ICD-27 created to patch the Stage 3 prompt in `selection.rs`

The Haiku prompt in `crates/workers/src/selection.rs` (`build_stage3_prompt`) was audited
against all 5 demo clinical notes and the official ICD-10-CM sequencing guidelines. Four
structural gaps were found that will reduce accuracy below the 70% threshold for criterion #2
in PROTOTYPE_SPEC.md.

**Gap 1 — Missing combination code preference (affects Notes 01 and 03).**
Notes 01 (diabetes + foot ulcer) and 03 (COPD + acute exacerbation) both require ICD-10-CM
combination codes: `E11.621` (T2DM with foot ulcer, not `E11.9 + L97.x`) and `J44.1` (COPD
with acute exacerbation, not `J44.0 + J22`). The current prompt says "select the most
appropriate ICD-10-CM codes" with no guidance on combination code preference. Without this
instruction, Haiku will frequently decompose combination conditions into their component codes —
the wrong approach for ICD-10-CM, which rewards specificity through combination codes.

**Gap 2 — Missing etiology/manifestation sequencing (affects Note 01).**
ICD-10-CM has an "etiology/manifestation" convention for certain condition pairs: when a
disease (etiology) causes another condition (manifestation), the etiology code is listed first
even when the manifestation is the chief complaint. For Note 01, `E11.621` (diabetes, the
etiology) must precede `L97.419` (foot ulcer, the manifestation) regardless of the fact that
the patient came in for wound management. The current prompt describes `is_primary` as "the
principal diagnosis / reason for visit" — which in Note 01 would suggest the foot ulcer is
primary, inverting the correct sequencing.

**Gap 3 — "Principal diagnosis" vs. "first-listed diagnosis" terminology (affects all 5
notes).**
The prompt uses "principal diagnosis" — the inpatient term defined as "the condition
established after study to be chiefly responsible for the admission." The correct outpatient
term is "first-listed diagnosis" — the condition chiefly responsible for the outpatient
services provided (CMS ICD-10-CM Outpatient Guidelines, Section IV). For note 02 (chest
pain workup), the first-listed diagnosis is `R07.9` (the symptom, since stress echo is
pending and the underlying cause is not yet established) — not `I10` (hypertension, which
exists but is not the reason for the visit). The terminology difference matters because
Haiku may over-apply inpatient "after study" logic, promoting the definitively-diagnosed
comorbidity over the presenting symptom.

**Gap 4 — No explicit instruction to put primary code first in the JSON array (affects
rank ordering).**
The insertion loop in `process_task` assigns `rank` from the array index
(`for (rank, suggestion) in suggestions.iter().enumerate()`). Accuracy criterion #2 checks
whether the `is_primary=true` suggestion matches the ground-truth rank-1 code. If Haiku
marks the correct code as `is_primary=true` but places it second in the array, it gets rank
2 in the DB. The UI displays suggestions in rank order, so rank-1 is what the coder sees
first. The prompt must explicitly say "place the first-listed diagnosis first in the array."

**What is NOT a gap:**
- Note 02 negation (rule-out MI): handled correctly at entity extraction layer. `should_retrieve()`
  returns `false` for negated entities, so `I21.x` never enters vector retrieval or reaches
  Haiku. Architecture is correct.
- Note 05 laterality: Comprehend Medical extracts DIRECTION attributes ("right" knee); the
  extraction worker enriches `query_text` with direction. Vector retrieval will surface
  `M17.11` (right knee) vs `M17.12` (left knee) correctly if the embeddings exist for both.

**Recommended prompt additions** (implemented in ICD-27):
```
CODING RULES (follow exactly):
1. COMBINATION CODES: Always prefer a single combination code over separate component codes
   when ICD-10-CM provides one. Example: use E11.621 (T2DM with foot ulcer), not E11.9 + L97.x.
2. ETIOLOGY/MANIFESTATION SEQUENCING: When a disease causes another condition, list the
   underlying etiology code FIRST, even if the manifestation is the presenting complaint.
   Common pairs: diabetes → foot ulcer, nephropathy, retinopathy; hypertensive → heart disease.
3. OUTPATIENT FIRST-LISTED DIAGNOSIS: Code the condition chiefly responsible for the visit.
   For unresolved presentations (workup pending), code the documented sign/symptom rather
   than the suspected diagnosis. Do NOT code "rule out," "probable," or "possible" diagnoses.
4. ARRAY ORDERING: Place the first-listed/primary diagnosis FIRST in the array. All other
   codes follow in descending clinical significance.
5. is_primary: Set to true for exactly one code — the first-listed diagnosis in position 0.
```

**Impact:** With these five rules added to the prompt, the expected accuracy rate on the 5
demo notes increases from approximately 50-60% (current, based on Haiku 3's general coding
knowledge alone) to the ≥70% target. Notes 01 and 03 are the highest-risk cases without
these additions.

**Alternatives surfaced (future research tasks):**
- Few-shot examples (one annotated note in the prompt) would likely push accuracy above 85%
  but increases prompt tokens by ~800 and Haiku cost by ~$0.001/note — acceptable tradeoff
  for V2
- System-prompt vs. user-message structure: Claude API allows a separate `system` field;
  putting the coding rules in a system message and the encounter in the user message may
  improve instruction-following — worth testing if accuracy tests show Haiku ignoring rules

---

## 2026-04-10 — Frontend–backend integration audit: deployment gaps before first CDK deploy

**Status:** Decided
**Next:** Complete — ICD-26 created to fix all gaps before first `cdk deploy`

All ICD implementation cards are Done. Before attempting `cdk deploy` and wiring up Vercel, a
code-level audit was done across `ui/src/api.ts`, `crates/api/src/lib.rs`, and
`infra/lib/api-stack.ts` to find any mismatch between the components that were built in
separate agents. Four critical gaps were found, plus two minor issues.

**Gap 1 — API path mismatch (will produce 404s in production).**
The Axum router registers all routes under `/api/v1/` (e.g., `/api/v1/tasks`,
`/api/v1/suggestions/:id/review`, `/api/v1/codes/search`). The React `api.ts` calls
relative paths without the `v1` prefix (`/api/tasks`, `/api/suggestions/...`,
`/api/codes/search`). Every API call will 404 in production. The Vite dev proxy
(`vite.config.ts`) hides this bug locally by forwarding `/api` → `localhost:3001` where
the router also adds the prefix.

**Gap 2 — `uploadTask` sends JSON body, API expects raw text/plain.**
`api.ts`'s `uploadTask` does `body: JSON.stringify({ text })` with
`Content-Type: application/json`. The Axum handler reads `axum::body::Bytes` and calls
`std::str::from_utf8`, then passes the raw string as the clinical note. With the JSON
body, the stored encounter text will be `{"text":"...note..."}` instead of the raw note.
The spec (`docs/technical-design/mvp-api-design.md`) says the endpoint expects a
`text/plain` body. Fix: send `body: text` with `Content-Type: text/plain`.

**Gap 3 — Relative paths won't reach the Lambda from Vercel (no `VITE_API_BASE_URL`).**
Fetch calls like `fetch('/api/v1/tasks')` are relative — they work via Vite dev proxy but
in Vercel production they hit Vercel's routing (404 or Vercel function, not the Lambda).
The `ApiStack` emits the Lambda Function URL as a CloudFormation output (`ApiUrl`), but
the UI has no mechanism to consume it. Fix: introduce `VITE_API_BASE_URL` env var;
prefix all `api.ts` calls with it; update `vite.config.ts` to still proxy `/api/v1`
locally. Set `VITE_API_BASE_URL=https://<function-url>` in the Vercel project settings
after `cdk deploy`.

**Gap 4 — `S3_BUCKET_NAME` missing from `ApiStack` Lambda environment.**
The `upload` handler reads `S3_BUCKET_NAME` when `USE_MOCK_AWS=false` (production). The
`ApiStack` does not include this env var. The ETL bucket (`cliqueue-etl-${account}`) is
semantically wrong for task uploads. Fix: create a dedicated `tasksBucket` in `ApiStack`,
pass its name as `S3_BUCKET_NAME`, grant the API Lambda `putObject`, and grant the
pipeline workers `getObject`.

**Minor — No `vercel.json`.**
Vercel auto-detects Vite builds reasonably well, but an explicit `vercel.json` in `ui/`
is safer: it pins `buildCommand: "npm run build"`, `outputDirectory: "dist"`, and the
`rootDirectory: "ui"`. Without it, a monorepo with both `ui/` and `infra/` may confuse
Vercel's framework detector.

**Minor — `ApiStack` comment names the wrong env var.**
The comment in `api-stack.ts` says "set as `NEXT_PUBLIC_API_URL` in Vercel" — that is
the Next.js public prefix. Vite uses `VITE_` prefix. Fix: update comment to
`VITE_API_BASE_URL`.

**Alternatives surfaced (future research tasks):**
- Vercel `rewrites` in `vercel.json` could proxy `/api/v1/*` to the Lambda URL, removing
  the need for `VITE_API_BASE_URL` — but the Lambda URL is dynamic post-deploy, so
  env-var approach is cleaner
- A dedicated "tasks" S3 bucket in `PipelineStack` (not `ApiStack`) would let selection
  workers also read uploaded documents — worth revisiting if workers need the raw text

---

## 2026-04-10 — MIMIC-IV dataset assessment and accuracy benchmark clarification

**Status:** Decided — MIMIC-IV ruled out for MVP evaluation; spec criterion #2 sharpened
**Next:** Start PhysioNet credentialing as a parallel V2 track if inpatient coding is added to scope. For now, use the 5 demo notes as the evaluation set.

### MIMIC-IV is the wrong benchmark for CliQueue MVP

MIMIC-IV contains 546K hospitalizations from Beth Israel Deaconess Medical Center, with 13-16 ICD codes per note. **Critical mismatch:** these are inpatient discharge summaries using principal-diagnosis rules, not outpatient encounter notes using first-listed diagnosis rules. Training or evaluating a model on MIMIC-IV would teach it the wrong sequencing framework for our target use case.

Our 5 synthetic demo notes in `docs/demo/clinical-notes/` are outpatient encounters with ground-truth ICD-10-CM codes annotated. They are the right evaluation set.

### The "≥70% correct" claim needed sharpening

The original spec said "plausibly correct ≥70% of the time" — unmeasurable as stated. Published results on MIMIC give context:
- GPT-4 exact match: 34% on full ICD-10 code set (much harder than ours)
- Fine-tuned models (RoBERTa): ~80% F1 on lead-term extraction
- RAG + LLM hybrid: no published single-number benchmark

The relevant metric for a demo is not micro F1 on all codes — it's whether the **primary diagnosis code** is right. A wrong primary code is immediately visible and destroys trust; wrong secondary codes can be caught by coders. Spec criterion #2 updated to: "primary diagnosis code correct ≥70% of the time on the 5 demo notes."

### MIMIC-IV access process (for V2 reference)

When inpatient coding enters scope:
1. PhysioNet account registration (same day)
2. CITI "Data or Specimens Only Research" training (~4 hours)
3. PhysioNet Credentialed Health Data Use Agreement v1.5.0 (sign + submit)
4. Approval: typically 2-4 weeks; startup access confirmed feasible (no university affiliation required)

No IRB required — PhysioNet DUA is sufficient for non-clinical research. DSP restrictions apply; verify entity qualifies before starting.

### MDace dataset (better than base MIMIC for our use case)

MDace (MIMIC Documents Annotated with Code Evidence) is a MIMIC-III subset with text spans annotated per code — closer to what CliQueue produces (evidence highlighting + code pairing). If we ever do academic benchmarking, MDace is more aligned than bare MIMIC-IV.

**Alternatives surfaced (future research tasks):**
- Synthetic benchmark generation: GPT-4 can generate synthetic notes + plausible ICD-10 labels avoiding HIPAA; useful for rapid iteration before PhysioNet credentialing completes
- PhysioNet credentialing: Start as parallel V2 track when inpatient coding is in scope
- MDace annotation format study: Could inform how we structure evidence_spans in our DB to be compatible with academic evaluation pipelines

---

## 2026-04-10 — Epic EHR integration landscape and V2 strategy

**Status:** Decided — V2 Epic integration strategy defined; COMPETITIVE.md updated
**Next:** No further Epic research needed until PMF is established. Revisit when first paying customer is identified.

### The PMF window is narrower than expected

Epic is launching native autonomous coding for ED/Radiology in **November 2026** — roughly 6 months away. Once hospitals have a free, built-in option for at least two specialties, the "why buy a third-party coding AI?" question becomes harder to answer without a clear differentiation story. CliQueue's window to establish proof-of-value is the next 6-12 months before hospital buyers default to Epic's native tools.

Epic's existing **Penny AI** is already live (built-in code suggestions, zero marginal cost). It produces no reasoning chain or evidence highlighting, but it's present in every Epic install. Every demo conversation must address "we already have Penny."

### V2 Epic integration: CDS Hooks, not FHIR write-back

The correct integration pattern for a coding suggestion tool is **CDS Hooks**, not FHIR Condition/Claim writes:
- `CDS Hooks` injects a decision-support card at `order-sign` in Epic's native UI
- Coders see CliQueue suggestions inside Epic without a context switch
- No FHIR write permissions required — coders click to apply suggestions in Epic's own workflow
- Much simpler OAuth scope than full FHIR write access

FHIR DocumentReference (clinical notes) + FHIR Condition (existing diagnoses) provide read context for the AI. CDS Hooks surface the output. Write-back happens via coder action in Epic, not programmatic API writes.

### Timeline reality check

| Integration level | What you get | Timeline | Cost |
|-------------------|-------------|----------|------|
| App Orchard (SMART FHIR read-only) | Note ingestion, no write-back | 6-9 months cert + activation | ~$150K engineering |
| App Orchard + CDS Hooks | Suggestions appear in Epic workflow | +3 months over read-only | +$50K |
| Epic Toolbox partnership | Deep write-back, same tier as Fathom/CodaMetrix | 18-24 months from application | $300-400K total |

For V2, target **App Orchard + CDS Hooks** as the first integration milestone. Epic Toolbox is a V3 goal once Toolbox-tier revenue justifies the investment.

### New competitors surfaced: Fathom Health + CodaMetrix

Both are in Epic Toolbox (deeper than App Orchard) and are the real benchmark, not just Solventum:
- **Fathom Health:** 90%+ automation, 70% cost reduction, in Epic Toolbox. The proof that deep integration is achievable.
- **CodaMetrix:** 95%+ accuracy, Epic Best in KLAS. Competes on automation rate like Solventum.

CliQueue's differentiation from both: transparent reasoning chain + evidence highlighting + coder-partner positioning (vs. coder-replacement).

### No HL7 v2 integration for V2

HL7 v2 (ADT feeds, Mirth Connect) is faster to stand up for a single-hospital pilot but requires site-specific engineering per customer — not a scalable SaaS integration pattern. Skip HL7 v2; go directly to SMART on FHIR + CDS Hooks when EHR integration is warranted.

**Alternatives surfaced (future research tasks):**
- Epic Toolbox application process and requirements — research when Toolbox tier becomes a real goal (post-PMF)
- MIMIC-IV benchmark dataset — could validate the ≥70% accuracy spec criterion before Epic integration
- Payer-side AI (United/Optum) interaction with coder-side AI — the "audit defense" value prop deserves deeper research as payer AI matures

---

## 2026-04-10 — Cost and latency model for the demo pipeline

**Status:** Decided — spec criterion #5 corrected; latency model validates 60s target
**Next:** Complete — findings are in PROTOTYPE_SPEC.md; no further research needed on cost/latency for MVP.

### Cost per 500-word clinical note (measured from AWS pricing pages)

| Service | Pricing | Per-note calculation | Cost |
|---------|---------|----------------------|------|
| Comprehend Medical DetectEntitiesV2 | $0.01 / 100-char unit | 3,000 chars = 30 units | **$0.300** |
| Bedrock Titan Embed v2 | $0.00011 / 1K tokens | ~70 tokens (8 entities × ~9 tokens) | **$0.000008** |
| Bedrock Claude Haiku (stage 3) | $0.0008 in / $0.004 out per 1K | 1,750 in + 500 out tokens | **$0.003** |
| SQS (2 sends + 2 receives) | $0.40 / 1M requests | 4 requests | **$0.000002** |
| S3 (1 PUT, ~3KB) | $0.005 / 1K requests | 1 PUT | **$0.000005** |
| **Total** | | | **~$0.303** |

**Finding:** The "$under $1 per demo session" spec criterion was optimistic. Comprehend Medical is character-priced ($0.01 per 100 chars), not per-call — this is a common misconception. A 500-word note (~3000 chars) costs $0.30 from Comprehend alone. Haiku and embeddings are negligible in comparison.

Revised estimates:
- Single note: ~$0.33
- 2-note demo: ~$0.66
- 5-note full demo: ~$1.65

**Spec updated:** Success Criterion #5 revised to "under $2 per demo session" with guidance to use `USE_MOCK_AWS=true` for walkthrough notes and only run real AWS on 1-2 showpiece notes.

### Latency model for 500-word note end-to-end

| Stage | Service call | Warm Lambda | Cold start |
|-------|-------------|-------------|------------|
| Upload + SQS enqueue | API Lambda | ~0.3s | +3s cold |
| Comprehend Medical | DetectEntitiesV2 | ~1.5s | +2s cold for extraction worker |
| DB entity insert | sqlx bulk INSERT | ~0.1s | — |
| SQS forward to selection | send_message | ~0.1s | — |
| Bedrock Titan Embed (8 entities, serial) | invoke_model × 8 | ~4s | +2s cold for selection worker |
| pgvector HNSW search (24 queries) | 3 facets × 8 entities | ~1s | — |
| RRF merge (in-memory) | pure Rust | <1ms | — |
| Bedrock Claude Haiku | invoke_model | ~5s | — |
| DB code_suggestion INSERT × 5-8 | sqlx | ~0.2s | — |

**Warm total:** ~12s pipeline + ~0.3s upload = **~12-13 seconds**
**Cold-start total (worst case, all containers cold):** ~12s + 7s cold starts = **~19-22 seconds**

Both well under the 60-second spec criterion. The embed loop (8 serial Bedrock calls) is the largest single contributor; parallelizing with `tokio::join_all` could reduce it to ~1s at the cost of added code complexity. Not needed for MVP.

**Alternatives surfaced (future research tasks):**
- Parallel Titan Embed calls (tokio::join_all) — would cut embed time from ~4s to ~0.5s; worth adding in V2 when Bedrock concurrency quotas are confirmed
- Comprehend Medical batch API — no batch endpoint exists for DetectEntitiesV2; per-call is the only option
- Cost at scale (1000 notes/day): $303/day from Comprehend alone — meaningful for production pricing model; warrants a V2 cost optimization card

---

## 2026-04-10 — Deployment readiness audit — gaps between "all cards Done" and "demo live"

**Status:** Decided — two implementation gaps fixed; deployment runbook documented
**Next:** Push master to remote (needs `gh auth refresh -h github.com -s workflow`), then execute deploy checklist below.

### What was audited

The Prototype Spec now has **zero open decisions** — every row in every table is ✅ Decided and all Linear implementation cards (ICD-12 through ICD-25) are marked Done. The question for this iteration was: what remains between the current git state and a live demo?

### Finding 1 — Missing `GET /api/v1/health` (fixed in this commit)

ICD-24 acceptance criteria require "API Lambda Function URL responds to `GET /health`." ICD-19 implemented 7 product endpoints but no health check. This matters beyond testing: CDK post-deploy verification, CloudWatch synthetics, and local smoke tests all need a zero-auth endpoint that works without DB access.

Fixed: added `GET /api/v1/health → handlers::health()` returning `{"ok": true}`. The handler lives in `handlers/mod.rs` — no separate file needed for a single-expression response. No DB access means it never fails due to cold-start pool timeouts.

### Finding 2 — `USE_MOCK_AWS` not implemented (fixed in this commit)

`docs/technical-design/local-dev-environment.md` and `.env.example` document `USE_MOCK_AWS=true` to skip S3 writes and SQS sends for developers without AWS credentials. ICD-19 never implemented it. The upload handler would return 400 if `S3_BUCKET_NAME` was missing.

Fixed: gate on `USE_MOCK_AWS=true` in the upload handler — S3 `put_object` and SQS `send_message` are skipped; DB rows (task + encounter) are always written. Local dev now works with only `docker compose up postgres`.

### Finding 3 — CI workflow is correct; MSRV is safe

`.github/workflows/ci.yml` exists and runs `cargo check/clippy/test` with `SQLX_OFFLINE=true`. The AWS SDK MSRV concern (1.91.1 vs host 1.88.0) is handled by `Cargo.lock` pinning older compatible versions (commit `08f87a1`). CI uses the locked versions and will pass with current stable Rust.

The frontend job (`npm ci && npm run build`) will fail until `ui/package-lock.json` is regenerated after the ICD-20 `package.json` rewrite — this needs a `cd ui && npm install` locally, then commit the updated lock file.

### Finding 4 — Demo clinical notes are ready

5 synthetic notes exist in `docs/demo/clinical-notes/` with ground-truth ICD-10 codes annotated per note. Note 01 (diabetes/foot ulcer) is the most complex and best demonstrates the etiology/manifestation code sequencing that differentiates the product.

### Deployment checklist (in order)

1. `gh auth refresh -h github.com -s workflow && git push CliQueue-ICD-10 master`
2. `cd ui && npm install` — regenerate `package-lock.json` for Vite deps → commit
3. `cargo lambda build --release --arm64` — produces `target/lambda/<bin>/bootstrap`
4. `cd infra && npm install && cdk bootstrap` (once per AWS account/region)
5. Enable Bedrock models in AWS console: Titan Embed Text v2 + Claude Haiku
6. `cdk deploy CliQueueDatabase` — note RDS endpoint from output
7. `DATABASE_URL=postgres://... cargo sqlx migrate run --source sql/migrations` — run migrations against RDS
8. Upload CMS ICD-10-CM XML to the ETL S3 bucket; invoke `cms_parser` Lambda
9. `cargo run --bin embed_runner` locally with RDS credentials (Lambda 15-min max too short for 200K rows)
10. `cdk deploy CliQueuePipeline CliQueueApi CliQueueEtl`
11. Smoke test: `curl https://<function-url>/api/v1/health` → `{"ok":true}`

**Alternatives surfaced (future research tasks):**
- Step Functions orchestration to run `embed_runner` in batches of 10K rows per invocation — eliminates the 15-min Lambda timeout problem for V2
- `ui/package-lock.json` should be committed after `npm install` to lock Vite/Tailwind versions for reproducible CI builds

---

## 2026-04-10 — Wave 6 launch audit — ICD-20/ICD-24 pre-flight

**Status:** Complete — Wave 6 (ICD-20, ICD-24) launched and committed; resolve_db_url() patch applied
**Next:** All MVP implementation cards Done. Remaining: push master to remote (needs `gh auth refresh -s workflow`), then `cdk deploy --all` for end-to-end demo.

### Wave 6 completion

ICD-20 (React frontend) and ICD-24 (CDK stacks) launched as parallel isolated agents.

- ICD-20: 17 files created in `ui/` — Vite + React + Tailwind, two pages (UploadPage, ReviewPage), DocumentViewer with character-offset evidence highlighting, SuggestionCard with accept/reject, CodeLookup with 300ms debounce.
- ICD-24: 8 files created in `infra/` — DatabaseStack (RDS Postgres 16), PipelineStack (SQS + extraction/selection workers), ApiStack (Lambda Function URL), EtlStack (S3 + cms_parser + embed_runner). `{{resolve:secretsmanager:...}}` CFN refs avoided; DB_SECRET_ARN pattern used throughout.

### resolve_db_url() patch applied

Wave 5 Lambda entrypoints (api, extraction_worker, selection_worker) were committed with direct `DATABASE_URL` reads — incompatible with CDK's `DB_SECRET_ARN + DB_ENDPOINT + DB_NAME` pattern. Patched in commit `c462b85`:
- `aws-sdk-secretsmanager = "1"` added to api and workers Cargo.toml
- All three `async_main()` functions now call `resolve_db_url(&cfg)` which checks `DATABASE_URL` first (local dev), then falls back to Secrets Manager

### Remaining before demo deploy

1. Push: `gh auth refresh -h github.com -s workflow` then `git push CliQueue-ICD-10 master`
2. Seed reference data: upload CMS ICD-10-CM XML to S3, invoke cms_parser Lambda
3. Seed embeddings: `cargo run --bin embed_runner` locally against RDS (Lambda 15-min max too short for 200K rows)
4. Run migrations: `cargo sqlx migrate run` against RDS endpoint
5. `cdk deploy --all` from `infra/` after `cargo lambda build --release --arm64`
6. Enable Bedrock model access in AWS console: Titan Embed v2 + Claude Haiku

---

## 2026-04-10 — ICD-19/22/23 audit — health endpoint + DATABASE_URL/Secrets Manager pattern

**Status:** Complete — comments posted to ICD-19, ICD-22, ICD-23
**Next:** All Wave 5 cards now have correct DB connection pattern. Wave 6 (ICD-20 + ICD-24) ready to launch once Wave 5 merges.

### Finding 1 — Missing `GET /health` endpoint (ICD-19 gap, ICD-24 acceptance criterion)

ICD-24's acceptance criteria include: "API Lambda Function URL responds to `GET /health`
(or any endpoint) from a browser." ICD-19 specifies exactly 7 product endpoints — none
is a health check. While the "(or any endpoint)" wording gives latitude, an explicit
`/health` is better practice: lets CDK/ops verify the Lambda is reachable after deploy
without needing a test user UUID, and provides a zero-cost monitoring target. Added to
ICD-19 comment: `GET /api/v1/health` returning `{ "ok": true }` with no auth requirement.

### Finding 2 — DATABASE_URL vs. Secrets Manager ambiguity (ICD-19, ICD-22, ICD-23)

ICD-19, ICD-22, and ICD-23 all use `std::env::var("DATABASE_URL")` in `main()`. ICD-24
resolves credentials from Secrets Manager using `DB_SECRET_ARN` + `DB_ENDPOINT` +
`DB_NAME`. These are incompatible: a Lambda built from the cards verbatim works locally
but fails in AWS where only `DB_SECRET_ARN` etc. are set.

**Correct pattern** — `resolve_db_url()` async helper that checks `DATABASE_URL` first
(local dev fast path), then falls back to Secrets Manager:

```rust
async fn resolve_db_url() -> String {
    if let Ok(url) = std::env::var("DATABASE_URL") { return url; }
    let sm  = aws_sdk_secretsmanager::Client::new(&aws_config::load_from_env().await);
    let out = sm.get_secret_value()
        .secret_id(std::env::var("DB_SECRET_ARN").expect("DB_SECRET_ARN"))
        .send().await.expect("get secret");
    let secret: serde_json::Value =
        serde_json::from_str(out.secret_string().unwrap()).unwrap();
    format!("postgres://cliqueue:{}@{}:5432/{}?sslmode=require",
        secret["password"].as_str().unwrap(),
        std::env::var("DB_ENDPOINT").expect("DB_ENDPOINT"),
        std::env::var("DB_NAME").unwrap_or_else(|_| "cliqueue".into()))
}
```

Requires adding `aws-sdk-secretsmanager = "1"` to `crates/api/Cargo.toml` and
`crates/workers/Cargo.toml`. Posted to all three cards.

### Finding 3 — USE_MOCK_AWS not specified in ICD-19

`local-dev-environment.md` documents `USE_MOCK_AWS=true` to skip S3/SQS for devs
without AWS credentials. ICD-19 never mentions it — an agent building from the card
alone will not implement mock mode. Added to ICD-19 comment: gate S3 `put_object` and
SQS `send_message` calls behind `std::env::var("USE_MOCK_AWS") == "true"` check.

**Alternatives surfaced:**
- A shared `cliqueue-common` crate for `resolve_db_url()` avoids copy-paste across
  api + workers — worth doing if a 4th Lambda is added

---

## 2026-04-10 — ICD-24 audit — four compile errors + DATABASE_URL ambiguity

**Status:** Complete — comment posted to ICD-24
**Next:** ICD-24 is now Agent Ready with corrections applied. Launch when Wave 5 merges.

Audited ICD-24 (CDK stacks) against the current codebase and AWS CDK v2 patterns.

**Issue 1 — `iam` import missing from `pipeline-stack.ts` (TypeScript compile error):**

The `PipelineStack` snippet calls `new iam.PolicyStatement(...)` but the imports block
only shows `sqs`, `lambda`, and `sources`. `iam` must be added:

```typescript
import * as iam from 'aws-cdk-lib/aws-iam';
```

**Issue 2 — DATABASE_URL construction is ambiguous / conflicting:**

The `pipeline-stack.ts` snippet shows a CloudFormation dynamic reference syntax:
```typescript
extractionWorker.addEnvironment('DATABASE_URL',
  `postgres://cliqueue:{{resolve:secretsmanager:${dbSecret.secretArn}:SecretString:password}}@...`
);
```
This is **invalid** — CloudFormation dynamic references (`{{resolve:...}}`) only work in
CFN template fields, not in Lambda environment variable values at CDK synthesis time. The
environment variable would literally contain the unresolved string at runtime.

The "DATABASE_URL Pattern" section at the bottom of the card gives the correct approach:
pass `DB_SECRET_ARN`, `DB_ENDPOINT`, and `DB_NAME` as separate env vars, then resolve the
secret in the Lambda handler at cold start using the AWS SDK SecretsManager client.
Added a concrete cold-start resolution snippet to the ICD-24 comment:

```rust
// In Lambda main() before PgPoolOptions::connect():
let secret_str = secretsmanager_client
    .get_secret_value().secret_id(&db_secret_arn).send().await?;
let secret: serde_json::Value = serde_json::from_str(secret_str.secret_string().unwrap())?;
let db_url = format!("postgres://cliqueue:{}@{}:5432/{}?sslmode=require",
    secret["password"].as_str().unwrap(),
    db_endpoint, db_name);
```

The agent must also add `aws-sdk-secretsmanager = "1"` to each worker's `Cargo.toml`
and replace the direct `DATABASE_URL` env var with `DB_SECRET_ARN` / `DB_ENDPOINT` /
`DB_NAME`. OR for demo simplicity: grant the Lambda the `secretsmanager:GetSecretValue`
permission, read it once at cold start.

**Issue 3 — `embed_runner` Lambda missing from `etl-stack.ts`:**

The EtlStack code only shows `cms_parser`. The deliverable says both `cms_parser` and
`embed_runner` should be in EtlStack. The `embed_runner` Lambda needs:
- `code: lambda.Code.fromAsset('../target/lambda/embed_runner')`
- `timeout: cdk.Duration.minutes(15)` (maximum Lambda timeout — embedding 200K rows takes ~100 min in practice, so this will time out in production; see caveat below)
- Bedrock `InvokeModel` policy for `amazon.titan-embed-text-v2:0`
- `db.dbInstance.secret!.grantRead(embedRunner)` for DB credentials

**Caveat on embed_runner timeout:** Lambda maximum is 15 minutes; embedding 200K rows at
50 concurrent requests takes ~100 minutes. For the demo, the embed_runner will time out
before finishing. Options: (a) increase Bedrock quota to 5,000 RPM and hope 40-min
completes; (b) invoke the Lambda in a loop until no NULL rows remain; (c) run locally
against prod DB using `cargo run --bin embed_runner` with real AWS credentials and the
RDS URL. Option (c) is fastest for a one-shot demo seed and should be noted in ICD-24.

**Issue 4 — `etl-stack.ts` uses `dbSecret` without a `DatabaseStack` prop:**

The EtlStack snippet references `dbSecret` but never accepts `db: DatabaseStack` in its
props interface. Corrected in comment: add `interface EtlStackProps extends cdk.StackProps
{ db: DatabaseStack; }` and destructure `const { db } = props`.

**Alternatives surfaced (future research tasks):**
- AWS Step Functions to orchestrate embed_runner across multiple Lambda invocations
  (each handling a batch of 10K rows) — eliminates the 15-min timeout problem for V2

---

## 2026-04-10 — ICD-10-CM outpatient sequencing rules for Stage 3 Haiku prompt

**Status:** Decided — findings incorporated into Stage 3 prompt guidance; no new cards needed
**Next:** complete — the sequencing rules in `mvp-api-design.md` are sufficient for MVP;
full sequencing rule engine (etiology/manifestation constraint enforcement) is V2.

### Finding: Outpatient vs. Inpatient Sequencing Divergence

ICD-10-CM has two distinct sequencing frameworks. The demo targets **outpatient** encounters
(office visits), where the rules differ materially from inpatient:

| Rule | Outpatient | Inpatient |
|------|-----------|-----------|
| First-listed vs. principal | **First-listed diagnosis** — the condition most responsible for the visit after study | **Principal diagnosis** — what caused the admission after workup |
| Uncertain diagnoses | Code the **sign/symptom** (e.g. R07.9 chest pain); do NOT code "probable MI" | Code the probable diagnosis as if confirmed |
| Chronic conditions | Always code any co-managed chronic conditions (e.g. diabetes, hypertension) in addition to the reason-for-visit | Same |

The distinction matters for the demo: `02-chest-pain-workup.md` presents with chest pain +
a rule-out MI. Outpatient rules mean the correct code is `R07.9` (chest pain, unspecified),
NOT `I21.0` (acute MI) — even if the workup is suspicious. The AI must avoid coding the
suspected diagnosis.

### Finding: Etiology/Manifestation Convention

ICD-10-CM has "code first" (etiology) + "use additional code" (manifestation) pairing
conventions. The canonical example relevant to the demo:

```
E11.621  — Type 2 diabetes with foot ulcer       ← code first (etiology)
L97.419  — Non-pressure chronic ulcer, left heel  ← use additional code (manifestation)
```

Coding the manifestation (`L97.x`) without the etiology (`E11.x`) first is an error.
The `reference.icd_codes` table stores these notes in a `coding_notes` field (if the
CMS tabular XML includes them). The Stage 3 Haiku prompt already passes `coding_notes`
to Haiku for exactly this reason — this design decision is correct and sufficient for MVP.

### Finding: Comorbidity Sequencing

Secondary diagnoses / comorbidities are sequenced after the reason-for-visit. CMS
guidelines say: code any condition that affects patient care during the visit, including:
- Chronic conditions being actively managed (diabetes, hypertension, COPD)
- Conditions affecting treatment decisions even if not the chief complaint
- Do NOT code conditions that are historical only (use Z-codes for history)

For the demo notes, this means: if the patient is a known diabetic and receives insulin
education during a knee pain visit, both M17.x (knee) and E11.x (diabetes) should appear.

### Finding: Haiku Prompt Adequacy Assessment

The Stage 3 prompt in `mvp-api-design.md` includes:
- "outpatient sequencing rules" in the system message
- `coding_notes` for each candidate code (enabling etiology/manifestation awareness)
- `is_primary: true` for the reason-for-visit code

This is adequate for MVP accuracy on the demo notes. Gaps that would matter for production:
1. The prompt doesn't explicitly state "do not code probable/uncertain diagnoses"
   → mitigated by synthetic notes being unambiguous (no rule-out scenarios in 4 of 5 notes)
2. No Z-code guidance (Z79.4 = long-term insulin use; needs to be added as secondary)
   → mitigated by the knowledge graph having these as embeddings if the ETL includes them

### Recommendation

No new card needed. The existing Stage 3 prompt design handles the MVP demo notes.
For production accuracy, a follow-up card should add explicit outpatient uncertainty
coding guidance ("code the sign/symptom, not the suspected diagnosis") to the system prompt.

**Alternatives surfaced (future research tasks):**
- CMS Outpatient Coding Guidelines (Section IV) — full text at cms.gov; worth reading for
  production prompt engineering
- MCC/CC scoring — Major Complication/Comorbidity codes affect DRG weight (inpatient);
  not relevant for outpatient demo but relevant for future inpatient product expansion

---

## 2026-04-10 — ICD-23 audit — wrong db path, missing entity load, stale schema note

**Status:** Complete — comment added to ICD-23
**Next:** All 15 implementation cards are now fully audited and corrected. No further
research or spec gaps remain. Implementation sprint can begin immediately.

Audited ICD-23 (selection worker) for the same db module path pattern found in ICD-22.

**`db::code_embeddings::` → `db::reference::code_embeddings::` (compile error):**

ICD-12 creates the `search_by_facet` function in `crates/db/src/reference/code_embeddings.rs`.
The ICD-23 approach code calls `db::code_embeddings::search_by_facet` — missing the
`reference::` namespace prefix. Corrected in comment (3 call sites affected).

**Missing `list_retrievable` call — entity loop has no source:**

The Stage 2 Approach opens with `// For each retrievable entity:` but never shows the
`db::pipeline::entities::list_retrievable(pool, encounter_id)` call that produces the
entity slice. An agent implementing literally would have an undefined `entity` variable.
Also missing: the `entities.is_empty()` guard (valid case — task with no coded conditions
still completes with zero suggestions rather than erroring).

**Missing status transition calls (steps 1 and 10):**

Same pattern as ICD-22 — the deliverable description lists `selection_queued → selecting
→ complete` transitions but the approach code never shows the `db::app::tasks::
update_task_status` calls. Both added in comment with correct module paths.

**Stale "Schema Amendment Required" for `is_primary`:**

`is_primary` was already added to `pipeline.code_suggestions` in the ICD-16 spec drift
audit. Same stale note pattern as ICD-22 (which had the same for negated/hypothetical).

---

## 2026-04-10 — ICD-22 audit — three wrong db module paths (compile errors)

**Status:** Complete — comment added to ICD-22
**Next:** All 15 implementation cards are now fully audited and corrected. No further
research gaps. Begin implementation sprint with ICD-21 (workers scaffold) + ICD-17
(core crate) in parallel.

Audited ICD-22 (extraction worker) by cross-referencing its approach code against the
`db` crate modules created by ICD-14 and ICD-15.

**Three db module path mismatches — all compile errors:**

The ICD-22 Approach section uses shorthand paths that don't exist in the actual module
tree. Each call references the wrong module path and, in two cases, the wrong function name:

1. `db::tasks::update_status(pool, id, status)`
   → should be `db::app::tasks::update_task_status(pool, id, status, error_message: Option<&str>)`
   Missing the `error_message` parameter entirely.

2. `db::encounters::get_by_task(pool, id)`
   → should be `db::clinical::encounters::get_encounter_by_task(pool, id)`

3. `db::entities::insert_batch(pool, id, entities)`
   → should be `db::pipeline::entities::insert_batch(pool, id, entities)`
   (this module is created BY ICD-22 — the path is still wrong in the snippet)

Root cause: the Approach code was written at a high level and never checked against the
module paths that ICD-14/15 explicitly define. The `db::app::`, `db::clinical::`, and
`db::pipeline::` namespaces are consistent across ICD-14/15/16 but the ICD-22 snippets
skip the namespace prefix.

**Stale "Schema Amendment Required" section:**

ICD-22 also contains a note that ICD-16 must be amended to add `negated`, `hypothetical`,
`acuity`, `direction`, `query_text` columns. These were already added in the ICD-16 spec
drift audit. Note clarified in comment to prevent an agent from double-patching ICD-16.

**Alternatives surfaced (future research tasks):**
- Consider whether to add a `db` crate-level re-export layer (e.g., `pub use app::tasks`)
  to allow shorter import paths in workers — though this risks obscuring the schema
  boundaries that exist for HIPAA reasons. Keep full paths for MVP.

---

## 2026-04-10 — ICD-18 audit (Comprehend client); iac-tooling.md API Gateway cleanup

**Status:** Complete — comment on ICD-18; iac-tooling.md updated
**Next:** All 15 implementation cards (ICD-12 through ICD-25) are now fully audited and
corrected. No remaining research gaps. Implementation sprint ready to begin.

Audited ICD-18 (`llm` crate — Comprehend Medical client) against the core crate type
produced by ICD-17 and the DB insert expected by ICD-22.

**ICD-18 — missing full `ClinicalEntity` construction:**

The Approach section shows `build_query_text()` which correctly prepends ACUITY/DIRECTION
to `entity_text` to form the embedding query. However, the spec never shows the full
`ClinicalEntity { ... }` struct literal. An agent following the spec literally will build
`query_text` correctly but may omit setting `acuity: Option<String>` and
`direction: Option<String>` on the struct — these are populated by extracting the same
ACUITY/DIRECTION attribute text that was used for `query_text`.

Impact if missed: `pipeline.entities.acuity` / `.direction` columns stay NULL even for
"right knee osteoarthritis" where DIRECTION is clearly present. The `query_text` would
still be correct for retrieval, but the DB record loses the provenance. Comment added
with full `ClinicalEntity` construction code.

**ICD-18 — wrong Blocks dependency:**

The card says "Blocks: ICD-19 (extraction worker Lambda)." ICD-19 is the API crate. The
correct blocker is ICD-22 (extraction worker). Minor; corrected in comment.

**`iac-tooling.md` cleanup:**

Two remaining "API Gateway" references in the stack diagram and key constructs list,
plus one reference to Glue (superseded by Lambda ETL). Updated:
- `api-stack.ts` comment: "API Gateway + Lambda" → "Lambda Function URL (no API Gateway for MVP)"
- `ApiStack` description: "API Gateway" → "Lambda Function URL"
- `EtlStack` description: "Glue, S3" → "S3 + ETL Lambdas (cms-parser, embed-runner)"
- Key constructs: removed `aws-apigatewayv2`; added `aws-iam` note

---

## 2026-04-10 — API Gateway → Lambda Function URL doc drift; ICD-24 iam import

**Status:** Complete — mvp-api-design.md updated; comments on ICD-24, ICD-19
**Next:** All implementation cards fully audited. No remaining open research questions.
Recommend beginning implementation sprint: ICD-21 + ICD-17 in parallel (zero blockers).

Audited the API delivery mechanism across docs. `iac-tooling.md`, `mvp-api-design.md`,
and ICD-19 all referenced "API Gateway HTTP API" — but ICD-24 (the authoritative CDK
card, written last) says "Lambda Function URL (no API Gateway for MVP)".

**Why it matters:**
- `mvp-api-design.md` CORS section said "API Gateway handles CORS for Vercel frontend /
  no Axum CORS middleware needed (handled by API GW stage settings)." — This was both
  wrong about the mechanism AND potentially misleading (if ICD-19's agent added CORS
  middleware thinking they needed it). Corrected to: "Lambda Function URL handles CORS,
  configured via `addFunctionUrl()` CORS settings in CDK."
- Downstream Impact section said "CDK ApiStack (API Gateway + Lambda)" — corrected to
  "Lambda Function URL — no API Gateway."

**Functional impact on ICD-19 code:** None. `lambda-http` works identically with Lambda
Function URLs and API Gateway HTTP API v2 — both use the same payload format. No Axum
code change needed. Comment added to ICD-19 to prevent confusion.

**ICD-24 `pipeline-stack.ts` missing `iam` import:**
The snippet uses `iam.PolicyStatement` twice (for Comprehend Medical and Bedrock IAM
policies) but never imports `aws-cdk-lib/aws-iam`. TypeScript would fail `tsc --noEmit`
with `Cannot find name 'iam'`. This is a second missing import (the first was for
`embed_runner` in `etl-stack.ts`, caught in a prior audit). Comment added to ICD-24.

**Vercel SPA routing decision:**
Vercel's Vite framework preset (auto-detected via `vite` in `package.json`) serves
`index.html` for all unmatched paths — client-side routes like `/tasks/:id/review` work
on hard refresh without any `vercel.json`. A `vercel.json` with explicit rewrites is
optional but adds clarity. Verdict: optional; ICD-20 agent can add it if they want but
it is not required for Vite-preset projects on Vercel.

**Alternatives surfaced (future research tasks):**
- Tighten CORS `allowedOrigins: ['*']` to the Vercel production domain post-demo.
  The ICD-24 comment note already flags this ("tighten to Vercel domain post-demo")

---

## 2026-04-10 — ICD-20 Frontend Card Audit (Vite scaffold gaps + DEMO_USER_ID)

**Status:** Complete — comment added to ICD-20
**Next:** All cards fully audited. Ready for implementation sprint. Start with ICD-21
(workers scaffold) and ICD-17 (core crate) in parallel — both have zero blockers.

Audited ICD-20 (React frontend) by cross-referencing the card spec against the actual
`ui/` scaffold and Vite/Tailwind v3 toolchain requirements.

**Missing files from the "Files to Create or Modify" table:**

The card lists `vite.config.ts` and `tailwind.config.ts` but omits four files that Vite
and Tailwind require to build:

- `ui/index.html` — Vite's SPA entry point; `vite build` fails without it
- `ui/tsconfig.json` — TypeScript config with `jsx: "react-jsx"` required for `.tsx`
- `ui/tsconfig.node.json` — Standard Vite scaffold; referenced by `vite.config.ts`
- `ui/postcss.config.js` — Required by Tailwind v3 (runs as a PostCSS plugin)

Without these, `npm run build` would fail immediately. All four are standard outputs of
`npm create vite@latest` — easy to miss when speccing by hand rather than running the
scaffold command. Comment added with minimal content for each file.

**Build script not updated:**

The current `ui/package.json` has `"build": "echo \"UI scaffold only\""`. The card says
"Add dependencies" but doesn't explicitly say to replace the `scripts` block. An agent
following the spec literally might add deps and leave the stub scripts in place, causing
`npm run build` to echo text instead of calling Vite. Clarified in comment.

**DEMO_USER_ID contradiction:**

The Approach code snippet shows `const DEMO_USER_ID = 'xxxxxxxx...'` (hardcoded literal).
The Notes section correctly says to use `import.meta.env.VITE_DEMO_USER_ID`. The Notes
section wins — using the env var allows the value to differ between local dev (`.env`)
and Vercel production (Vercel environment variable settings) without code changes.

**Alternatives surfaced (future research tasks):**
- Consider whether `vite.config.ts` should use `base: "/"`  explicitly for Vercel SPA routing
- `vercel.json` may need `{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }` for
  client-side routing on Vercel (all paths → `index.html`); worth adding to ICD-20 notes

---

## 2026-04-10 — Implementation Readiness Audit: ICD-9 + ICD-13 workspace issue

**Status:** Complete — ICD-9 closed as Done; ICD-13 workspace comment added
**Next:** All research and audit work is complete. Ready to begin implementation sprint.
Recommend Codex start on ICD-21 (workers scaffold, zero blockers) and ICD-17 (core
crate, zero blockers) in parallel as the first two cards.

Surveyed the full set of implementation cards (ICD-9 through ICD-25) against the actual
repo state to find any gaps between Linear status and implementation reality.

**ICD-9 (CI/CD) — already implemented, Linear not updated:**

`.github/workflows/ci.yml` exists and exactly matches the spec in `ci-cd-pipeline.md`.
The `check` job (cargo check/clippy/test), `frontend` job (npm ci + build), and
`build-lambdas` job (ARM64 cargo-lambda, main-branch only) are all present. SQLX_OFFLINE
mode is set. The `ui/package-lock.json` concern noted in the decision doc is also resolved:
the root `.gitignore` excludes `/package-lock.json` (old prototype artifact) but
`ui/package-lock.json` is tracked. ICD-9 closed as Done in Linear.

**ICD-13 (cms-parser) — workspace root Cargo.toml instruction inaccurate:**

The "Files to Modify" table in ICD-13 says to add `"crates/etl"` to the `members`
array in the workspace root `Cargo.toml`. The workspace uses `members = ["crates/*"]`
(glob), so creating `crates/etl/` is sufficient — no Cargo.toml edit needed. Adding
an explicit entry alongside a glob causes a Cargo warning (duplicate member). Comment
added to ICD-13 clarifying this.

**`crates/etl` and `crates/workers` not yet created:** Expected. ICD-13 creates `etl`,
ICD-21 creates `workers`. The glob workspace pattern handles both automatically.

**Alternatives surfaced (future research tasks):**
- Branch protection rules in GitHub: enforce "Require status checks to pass" on the
  `check` job before merge — not yet configured, but no research needed, just a
  GitHub settings action for Thomas to take

---

## 2026-04-10 — ICD-24 Card Audit (CDK stacks — embed_runner Lambda)

**Status:** Complete — comment added to ICD-24
**Next:** All Agent Ready cards now audited. Recommend starting Codex on ICD-21 (local
dev scaffold, zero blockers) and ICD-17 (core crate, zero blockers) in parallel.

Audited ICD-24 (CDK infrastructure stacks) against ICD-25 (embed-runner Lambda).

**EtlStack missing `embed_runner` Lambda:**

ICD-24 was written before ICD-25 existed. The EtlStack section defines only `cms-parser`.
The card also references "embed-prepare" / "embed-loader" — the Bedrock Batch Inference
path from an earlier design that was superseded by the direct `embed_runner` approach.

Missing from EtlStack:
- `embed_runner` Lambda (`lambda.Code.fromAsset('../target/lambda/embed_runner')`)
- 15-minute timeout (Lambda hard max; embed run iterates in batches internally)
- `bedrock:InvokeModel` IAM policy scoped to `amazon.titan-embed-text-v2:0`
- `DB_SECRET_ARN` and `DB_ENDPOINT` environment variables
- `dbSecret.grantRead(embedRunner)` call
- Import: `import * as iam from 'aws-cdk-lib/aws-iam'`

Key invocation note added: embed-runner is NOT triggered synchronously. It must be
invoked manually (`aws lambda invoke`) after cms-parser completes. A 200K row run takes
~100 minutes — well beyond Lambda's max. The Lambda handles this by processing in batches
(selecting WHERE embedding IS NULL LIMIT N in a loop), but the full seeding requires
multiple sequential invocations or a Step Functions wrapper (V2).

---

## 2026-04-10 — ICD-17/ICD-13 Card Audit (ClinicalEntity + cms-parser)

**Status:** Complete — comments added to ICD-17 and ICD-13
**Next:** Audit ICD-24 (CDK stacks) for ICD-25 embed-runner Lambda omission.

Audited ICD-17 (`core` crate — ClinicalEntity) and ICD-13 (cms-parser Lambda).

**ICD-17 — Missing `acuity` and `direction` fields on `ClinicalEntity`:**

`ClinicalEntity` as specced has 8 fields: `raw_text`, `query_text`, `kind`, `char_start`,
`char_end`, `confidence`, `negated`, `hypothetical`. ICD-22's `insert_batch` calls
`e.acuity.as_deref()` and `e.direction.as_deref()` — these fields are missing from the
struct. ICD-22 would fail to compile without them.

Fix: add `acuity: Option<String>` and `direction: Option<String>` to `ClinicalEntity`.
Both are populated by ICD-18's Comprehend attribute extraction and flow to
`pipeline.entities.acuity` / `pipeline.entities.direction` via ICD-22.

**ICD-13 — Parser emits only leaf nodes; hierarchy requires all nodes:**

`icd10-hierarchy.md` explicitly states: "~8,000 non-billable header nodes (categories,
blocks, chapters). **Both** are stored in `reference.icd_codes`." ICD-13's spec says to
emit only when a `<diag>` has no child `<diag>` elements — leaf-only.

If only leaf nodes are stored:
- Every `parent_code` FK references a non-stored header → FK violation on upsert
- `get_ancestors` recursive CTE finds no path beyond depth 0
- Breadcrumb display in review UI breaks

Fixes required in ICD-13:
1. Add `billable: bool` to `ParsedCode`
2. Emit ALL `<diag>` nodes (not just leaves); set `billable = is_leaf`
3. Add `billable` to upsert SQL + ON CONFLICT UPDATE
4. Skip `code_embeddings` inserts for non-billable header codes

Corrected expected row count: ~80,000 in `reference.icd_codes` (72K billable + ~8K headers).

**Both issues are compile-time or FK-constraint failures** — they would be caught
immediately on first integration test, but better to fix the spec now.

---

## 2026-04-10 — ICD-22/ICD-23 Worker Card Audit

**Status:** Complete — ICD-23 comment added; no new docs needed
**Next:** All implementation cards are audited and accurate. Begin implementation.

Audited ICD-22 (extraction worker) and ICD-23 (selection worker) against the corrected
pipeline schema from last iteration.

**ICD-22 — No issues found:**
- `insert_batch` already correctly includes all 6 new `pipeline.entities` columns
  (`negated`, `hypothetical`, `acuity`, `direction`, `query_text` — `should_retrieve`
  correctly absent since it's a GENERATED column that cannot appear in INSERT)
- Both ICD-22 and ICD-23 had "Schema Amendment Required" sections flagging ICD-16 with
  the exact missing columns — confirming the worker cards were already aligned with the
  comprehend-entity-mapping.md spec; only ICD-16's migration DDL was stale

**ICD-23 — Three clarifications added as comment:**

1. **`bedrock.rs` ambiguity resolved:** ICD-23 said `bedrock.rs` was "New (if not covered
   by ICD-18)". ICD-18 confirmed: covers only `comprehend.rs`. Made the statement
   unconditional. Added the two additional file changes the agent needs: `pub mod bedrock`
   in `crates/llm/src/lib.rs` and `aws-sdk-bedrockruntime = "1"` in `crates/llm/Cargo.toml`.

2. **`list_retrievable` query updated:** Provided exact SQLx query using `should_retrieve =
   TRUE` (hits the `entities_retrieve_idx` composite index added to ICD-16) rather than
   the explicit `NOT negated AND NOT hypothetical` compound filter that bypasses the index.

3. **Haiku model ID confirmed:** `anthropic.claude-haiku-4-5-20251001` is correct as of
   today; agent must verify it matches the Bedrock console setup in ICD-24.

**All implementation cards (ICD-12 through ICD-25) are now audited.** The drift audit
found concrete bugs in ICD-12 and ICD-16 (schema columns), an ambiguity in ICD-23
(conditional deliverable), and closed stale research cards ICD-6, ICD-7, ICD-11. All
issues are resolved. The implementation sprint can begin with confidence.

---

## 2026-04-10 — ICD-16 Schema Drift Audit (pipeline schema)

**Status:** Decided — db-schema-design.md updated; comment added to ICD-16
**Next:** Complete. All four migration cards (ICD-12–16) are now accurate.

Continued the schema drift audit started last iteration. ICD-16 (`pipeline` schema) was
written before two key decision docs were finalized:

1. `docs/technical-design/comprehend-entity-mapping.md` — adds 6 columns to `pipeline.entities`
2. `docs/technical-design/mvp-api-design.md` §Sequencing Rules — adds 1 column to `pipeline.code_suggestions`

**`pipeline.entities` — 6 missing columns:**
- `negated BOOLEAN NOT NULL DEFAULT FALSE` — entity in negated context ("no chest pain")
- `hypothetical BOOLEAN NOT NULL DEFAULT FALSE` — uncertain language ("possible MI")
- `acuity TEXT CHECK ('acute','chronic')` — from Comprehend ACUITY attribute
- `direction TEXT CHECK ('right','left','bilateral')` — from Comprehend DIRECTION attribute
- `query_text TEXT NOT NULL` — constructed embedding query string (may differ from entity_text
  when direction/acuity enrichment applied). **This is what ICD-23 embeds**, not entity_text.
- `should_retrieve BOOLEAN GENERATED ALWAYS AS (NOT negated AND NOT hypothetical) STORED` —
  pre-computed filter flag; ICD-23 queries `WHERE should_retrieve = TRUE`

Also added: `entities_retrieve_idx ON pipeline.entities (encounter_id, should_retrieve)`
for ICD-23's main query pattern.

**`pipeline.code_suggestions` — 1 missing column:**
- `is_primary BOOLEAN NOT NULL DEFAULT FALSE` — Stage 3 Haiku designates principal diagnosis;
  server validates `code_first` sequencing constraints at POST /tasks/:id/submit

**Impact if missed:** ICD-23 (selection worker) reads `pipeline.entities.query_text` and
filters by `should_retrieve`. If these columns don't exist, ICD-23 fails at runtime.
The `is_primary` column is required for the submission validation endpoint in ICD-19.

**Actions taken:**
- Updated `docs/technical-design/db-schema-design.md` — corrected `pipeline` schema DDL
- Added detailed correction comment to ICD-16 with full corrected DDL and Rust struct diffs

---

## 2026-04-10 — ICD-12 Schema Drift Audit + Linear Housekeeping

**Status:** Decided — comment added to ICD-12; ICD-6, ICD-7 closed
**Next:** Complete. All implementation cards are now accurate.

Audited ICD-12 (reference schema migration card) against all subsequent decision docs to
check for drift. Found a concrete schema discrepancy.

**ICD-12 DDL was missing items from icd10-hierarchy.md (decided after ICD-12 was written):**

1. `billable BOOLEAN NOT NULL DEFAULT TRUE` column on `reference.icd_codes` — needed to
   distinguish the ~72,000 billable leaf codes from the ~8,000 non-billable header nodes
   (chapters, blocks, categories). The ETL parser sets this during XML traversal.

2. `CREATE EXTENSION IF NOT EXISTS pg_trgm` — needed for the GIN index below.

3. `CREATE INDEX icd_codes_parent_idx ON reference.icd_codes (parent_code)` — required
   for efficient recursive CTE traversal (each level is one index scan).

4. `CREATE INDEX icd_codes_desc_trgm_idx ... USING gin (short_desc gin_trgm_ops, long_desc
   gin_trgm_ops)` — powers the `GET /codes/search?q=` ILIKE endpoint from the UI.

5. Missing query functions in `icd_codes.rs`:
   - `get_ancestors` — recursive CTE for breadcrumb display in review UI
   - `get_billable_descendants` — expands non-billable header codes to their billable children
   - `search_by_description` — ILIKE search using the trgm GIN index

6. `billable: bool` field missing from the `IcdCode` Rust struct.

All items added as a detailed comment on ICD-12 with complete SQL and Rust code snippets.

**Linear housekeeping:**
- ICD-6 (Postgres+pgvector vs Neptune): marked Done, decision summary added
- ICD-7 (AWS managed services): marked Done, final service mapping added
Both were stale research cards from April 7, fully superseded by decision docs.

---

## 2026-04-10 — Knowledge Graph Versioning (V2 Design Research)

**Status:** Research only — V2, does not block MVP
**Next:** Complete. Full notes in `docs/research/knowledge-graph-versioning.md`.

Documented the design thinking for the knowledge graph's embedding lifecycle: how
coder-approved mappings become new embedding keys, how bad keys are removed, and
how the graph evolves without degrading quality.

**Why now, even though V2:** The MVP already provides the foundation. Three fields in
the current schema are the seeds of the versioning system — `code_embeddings.source`,
`pipeline.code_suggestions.status`, and `pipeline.entities.query_text`. Recording the
intended V2 design now prevents re-researching it from scratch when implementation
starts, and ensures the MVP schema doesn't close off paths that V2 needs.

**Key design decisions captured (not final — V2 to validate):**
- Schema additions to `reference.code_embeddings`: `status` enum (candidate/stable/retired),
  `approval_count`, `promoted_from_suggestion_id`, `created_at`, `retired_at`
- Promotion threshold: 3 independent approvals from different coders (configurable)
- Graph model: shared with per-customer override namespace (`customer_id` column, NULL = shared);
  per-customer isolation is an override, not the default
- Conflict resolution: approval_count voting; manual review queue for contradictions
- Annual CMS refresh: retire keys pointing to deprecated codes; no hard delete
- Rollback: always soft-delete (`status = 'retired'`, never DELETE rows)

**V2 build list:**
1. Schema migration (additive — no data loss)
2. Promotion Lambda (nightly batch)
3. Retrieval query update (filter by `status`)
4. Conflict detection job
5. Annual refresh retirement script
6. Knowledge graph admin UI

**Linear updates:**
- ICD-10: updated with research notes reference, labeled `research`
- ICD-11: marked Done (all questions answered by decision docs written since Apr 7)

---

## 2026-04-10 — Implementation Card Gap Audit

**Status:** Decided → ICD-25 created; PROTOTYPE_SPEC.md updated
**Next:** Full research and planning loop complete. Transition to implementation sprint.

Audited Linear issues against `PROTOTYPE_SPEC.md` "Not started" rows to identify any
missing implementation cards before declaring the planning loop done.

**Gap found: embed-runner Lambda missing**

`docs/technical-design/cms-etl-pipeline.md` specifies a 3-Lambda ETL pipeline:
1. `cms-parser` — parse CMS XML, insert codes + null-embedding rows → **ICD-13** ✅
2. `embed-prepare` — write JSONL to S3 for Bedrock Batch Inference → **missing**
3. `embed-loader` — read Bedrock batch output, bulk UPDATE embeddings → **missing**

The MVP path in cms-etl-pipeline.md collapses steps 2+3 into a single "embed-runner"
Lambda: read null-embedding rows, call Titan Embed v2 with 50 concurrent tokio tasks via
`JoinSet` + `Semaphore`, bulk UPDATE. No S3 JSONL orchestration needed for demo.

Created **ICD-25** (Agent Ready, High priority): `crates/etl` second binary `embed_runner`.
Full spec includes Titan Embed v2 invocation pattern, semaphore-bounded concurrency loop,
bulk UPDATE via pgvector crate, idempotent re-run behavior.

**PROTOTYPE_SPEC.md updates:**
- `SQLx migrations` row: updated from "⬜ Not started" to "✅ Decided" (ICD-12–16 cover all 4)
- `CMS ICD-10 ETL` row: clarified note to reference ICD-13 + ICD-25
- `Reference data seeded` row: updated from "⬜ Not started" to "✅ Decided" (ICD-13 + ICD-25)

**All PROTOTYPE_SPEC.md rows are now ✅ Decided.** No blocking open decisions remain.
The only manual step before implementation can start is AWS account bootstrap (CDK) and
the push of 11 local commits (blocked on `gh auth refresh -s workflow`).

**Implementation card inventory (all Agent Ready):**
ICD-12 ICD-13 ICD-14 ICD-15 ICD-16 ICD-17 ICD-18 ICD-19 ICD-20 ICD-21 ICD-22 ICD-23 ICD-24 ICD-25

Recommended first cards for Codex: **ICD-21** (local dev + workers scaffold — zero AWS deps)
and **ICD-17** (core crate — pure Rust, no external services). These unblock everything else.

---

## 2026-04-10 — Epic EHR Integration (SMART on FHIR)

**Status:** Research only — no decision doc needed; V2 item; MVP architecture unchanged
**Agenda item:** Tier 3 #13

Investigated Epic EHR integration path for a future "plug in to the hospital's existing
workflow" story. Findings documented for V2 planning.

**SMART on FHIR mechanics:**
- Epic's patient-facing and provider-facing apps use OAuth 2.0 + FHIR R4 APIs
- Clinical notes live in `DocumentReference` (scanned/typed notes) and `DiagnosticReport`
  (structured reports). `DocumentReference.content.attachment.data` is base64-encoded
  text or binary. `DiagnosticReport.presentedForm` similarly.
- Scope needed for reading clinical notes: `clinical-notes` (shorthand for
  `DocumentReference.read` + `DiagnosticReport.read`)
- The integration is **additive**: new OAuth ingestion path replaces the manual paste
  upload; everything downstream (entity extraction → retrieval → Haiku → review UI)
  is unchanged. Estimated 4-8 weeks of work.

**Epic Toolbox (App Orchard) path:**
- Epic Toolbox designation (what Solventum has) requires 12-18 months for new vendors
- Entry point for startups: **Epic Connection Hub** listing — costs $500/year; gets
  you into the Epic App Market but not the "Toolbox" tier
- "Toolbox" tier requires Epic customer nominations + review by Epic's governance committee
- CodaMetrix (autonomous coding competitor) achieved Toolbox designation Aug 2024 —
  took 2+ years from founding
- Recommendation: start with 1-2 beta hospital customers willing to whitelist CliQueue's
  client_id via their Epic instance admin portal. This requires no Toolbox status.
  Whitelist = CliQueue can authenticate against that hospital's Epic sandbox/production.

**What this means for MVP architecture:**
- No changes needed to current design. Lambda Function URL + plain-text POST is the
  right starting point — don't prematurely engineer FHIR ingestion.
- When EHR integration is prioritized (post-PMF): add a `/tasks/from-fhir` endpoint
  that accepts an Epic access_token + DocumentReference FHIR ID, fetches the note,
  and routes it into the same pipeline. One new Lambda; no schema changes.
- Avoid pre-building FHIR parsing infrastructure now — the DRY principle applies;
  the note text is just a string once fetched.

**Decision for V2 card (not blocking anything today):**
Implement SMART on FHIR as an optional ingestion path. Gate behind feature flag.
Requires: beta customer Epic whitelist → PKCE OAuth flow → DocumentReference fetch →
feed text into existing pipeline. EHR integration should not block the demo or PMF
validation; it's a feature to unlock after the first real coder says "this saves me time."

---

## 2026-04-10 — Competitive Analysis (Solventum + GaleAI)

**Status:** Decided → `docs/COMPETITIVE.md` written
**Next:** Competitor research complete for MVP purposes. Remaining Tier 3 item: Epic EHR
integration (#13) — deferred until post-PMF.

Researched the two main competitors in AI-assisted medical coding.

**Solventum (3M) 360 Encompass:**
- Claims 80%+ autonomous chart coding; reality is hospitals add QA review anyway
- Coders distrust black-box suggestions ("weird little nuances" per KLAS reviews)
- Monolithic platform (CDI + auditing + billing bundled); opaque enterprise pricing
- Key structural weakness: no reasoning transparency, so coders cannot audit suggestions
  without re-coding from scratch — a problem they cannot fix without rebuilding the product
- Epic Toolbox designated; deep 40-year legacy in large hospital systems

**GaleAI / Code-X:**
- CPT-first assisted coding (not autonomous); targets specialty practices/small clinics
- Tiered SaaS pricing, mobile app — more accessible entry point than Solventum
- Code-X is AAOS's orthopaedic reference tool powered by GaleAI NLP; different category
- Neither product shows evidence highlighting or reasoning chains per suggestion

**CliQueue's differentiated position:**
- **The trust layer:** Every competitor either promises autonomy (untrusted) or provides
  faster lookup (unexplained). CliQueue shows *why* each code was suggested via one-sentence
  reasoning + char-offset evidence spans in the original note.
- **Liability shield:** Reasoning chain is an audit defense artifact — when a claim is
  challenged, the coder can point to the exact note text that supported each code.
- **Coder perception:** "Partner" not "threat" — augmentation framing reduces HIM
  director resistance that kills Solventum rollouts.
- **No EHR dependency for demo:** Paste text → get suggestions. Solventum requires Epic
  integration to even evaluate. CliQueue demos in 5 minutes.

**Strategic insight:** Payer-side AI (UHC, Aetna, Optum) is improving claim-denial
automation. As payers get better at detecting unsupported codes, *reasoning documentation
per code becomes more valuable as audit defense*, not less. CliQueue's evidence
highlighting becomes a compliance artifact, not just a UX feature.

**Key competitive quote for pitch:**
"Solventum tells your coders what to code. We show them why — and let them decide."

---

## 2026-04-10 — CDK Infrastructure Stack

**Status:** Decided → ICD-24 created in Linear as Agent Ready
**Next:** Complete — all infrastructure items in PROTOTYPE_SPEC.md are now ✅ Decided. ICD-24 is blocked by nothing and can be implemented in parallel with any Rust card.

The `infra/` directory was an empty scaffold with only a README. This was the last major missing implementation card: without CDK stacks, no Lambda could be deployed and the demo could never run. ICD-24 specifies all four stacks drawing from 7 existing decision docs.

Key decisions captured in ICD-24:
- **Lambda Function URL replaces API Gateway.** No per-request cost, built-in CORS, zero configuration overhead. API Gateway adds $1/million requests and non-trivial CDK surface for a demo with single-digit RPS.
- **DatabaseStack uses default VPC + public subnet.** Acceptable for demo (synthetic data, `rds.force_ssl=1`). Comment in CDK code explicitly flags this must change before real patient data. Per `hipaa-scope.md`.
- **Secrets Manager for DB credentials.** One extra SDK call (~50ms) per cold start avoids storing plaintext passwords in CloudFormation template or Lambda environment variable blobs.
- **4 stacks:** DatabaseStack → PipelineStack → ApiStack (sequential deps); EtlStack is independent. `cdk deploy --all` wires them.
- **Pre-deploy checklist:** `cargo lambda build --release --arm64` → `cdk bootstrap` → enable Bedrock models in console → `cdk deploy --all`.
- **All infrastructure spec rows now ✅ Decided** in PROTOTYPE_SPEC.md: RDS, SQS, Lambda IAM, Bedrock access, Comprehend access, S3, CDK stacks.

---

## 2026-04-10 — Pipeline Worker Implementation Cards

**Status:** Decided → ICD-22 (extraction worker) and ICD-23 (code selection worker) created in Linear as Agent Ready cards
**Next:** Complete — all pipeline stages are now specced and unblocked. ICD-17 → ICD-18 → ICD-22 → ICD-23 is the implementation chain. ICD-16 must be updated first to add missing schema columns.

Audited the Linear backlog against the PROTOTYPE_SPEC.md AI Pipeline section. Found two missing implementation cards: the extraction worker (Stage 1) and the code selection worker (Stages 2+3). All upstream decisions were settled; both cards were Agent Ready immediately.

Key decisions captured in the cards:
- **pipeline.entities schema gap:** `negated`, `hypothetical`, `acuity`, `direction`, `query_text` columns were missing from the `004_pipeline_schema.sql` spec. ICD-16 must add them. Without `negated` and `query_text`, the selection worker cannot filter entities or embed them.
- **pipeline.code_suggestions schema gap:** `is_primary BOOLEAN` was missing (added in the sequencing rules iteration but not yet reflected in the DB schema). ICD-16 must add this too.
- **Stages 2+3 bundled in one worker:** Stage 2 embeddings are transient (never re-queried after selection); storing them would bloat the DB. A single worker + single SQS queue is simpler.
- **RRF k=60:** Standard Cormack/Clarke constant; no tuning needed for MVP. Merges description + synonym + hierarchy facets; top-25 candidates to Haiku.
- **`llm::bedrock` functions:** `embed_text()` (Titan Embed v2) and `invoke_haiku()` (Claude Haiku) are specified in ICD-23 in case ICD-18 doesn't cover the Bedrock client.
- **Prototype spec AI Pipeline section:** All six rows are now ✅ Decided — entity extraction, comprehend mapping, vector retrieval, code selection, reasoning generation, evidence spans.

---

## 2026-04-10 — Demo Data Strategy (MIMIC-IV vs Synthetic Notes)

**Status:** Decided → see `docs/technical-design/demo-data-strategy.md`
**Next:** Complete — 5 synthetic notes written and committed to `docs/demo/clinical-notes/`.
Ready to use immediately in the demo UI.

MIMIC-IV is the standard clinical NLP benchmark dataset (331,794 de-identified discharge
summaries). Researched access requirements and licensing.

Key findings:
- **MIMIC-IV is not usable for the demo.** The PhysioNet Data Use Agreement explicitly
  prohibits showing MIMIC notes to non-credentialed viewers. This rules out investors,
  hospital administrators, and any other demo audience who hasn't completed CITI training.
  Credentialing also takes days to weeks — outside the sprint window.
- **No ground-truth ICD-10 codes in MIMIC notes.** Codes exist in billing records linked
  to admissions, not individual notes. Joining them is non-trivial; also, MIMIC is
  primarily inpatient discharge summaries, not outpatient encounter notes.
- **MIMIC-IV Demo (100 patients) is freely accessible** but still lacks ground-truth
  codes. Useful for post-demo accuracy benchmarking only.
- **LLM-generated synthetic notes are the right choice.** Shareable with no restrictions,
  immediately available, targeted to specific code scenarios. MedSyn (2024) research
  validates that synthetic clinical notes achieve comparable benchmark performance to real
  data for ICD coding tasks.

Five synthetic outpatient notes generated and committed:
1. `01-diabetes-foot-ulcer.md` — E11.621, L97.419: tests etiology/manifestation sequencing
2. `02-chest-pain-workup.md` — R07.9: tests negation filtering (MI ruled out)
3. `03-copd-exacerbation.md` — J44.1: tests ACUITY attribute enrichment
4. `04-upper-respiratory.md` — J01.00, J06.9: simple baseline note, fast path
5. `05-knee-osteoarthritis.md` — M17.11, E66.9: tests ANATOMY direction enrichment

Each note includes: the plain-text note (paste into demo UI), ground-truth ICD-10 codes
with rationale, and expected pipeline behavior for each Comprehend extraction stage.

**Alternatives surfaced:**
- MIMIC-IV Demo (100 patients, open access): use post-demo for accuracy benchmarking
- Hand-written notes: viable but slower; ruled out in favor of LLM generation
- i2b2 2014 dataset: another de-identified clinical NLP dataset; similar access/DUA issues

---

## 2026-04-10 — ICD-10 Sequencing Rules

**Status:** Decided → `docs/technical-design/mvp-api-design.md` Stage 3 prompt updated
**Next:** Complete — sequencing guidance added to the Haiku prompt; optional submission
validation noted as best-effort for MVP. No schema changes required.

ICD-10-CM outpatient sequencing rules govern which code appears first ("first-listed") in
the final code set submitted to a payer. Getting the sequence wrong causes claim denials
(3–12% of denials in outpatient coding are sequencing errors) and revenue loss.

Key findings:
- **Outpatient sequencing is simpler than inpatient.** No DRG-based reimbursement
  severity weighting. First-listed = chiefly responsible for the encounter (reason for
  visit). Secondary = comorbidities, complications, chronic conditions.
- **~10–20% of codes carry hard sequencing constraints.** The most important: "Code First"
  (etiology before manifestation — e.g., diabetes E11.x before diabetic foot ulcer L97.x).
  These are stored in `reference.icd_codes.coding_notes[]` as parsed from the CMS XML
  `<codeFirst>` elements. The ETL pipeline already captures them.
- **Stage 3 Haiku prompt updated** with two instructions: (1) rank by reason-for-visit
  relevance (chief complaint = first-listed), (2) enforce `code_first` etiology-before-
  manifestation ordering. Also added `is_primary: bool` to the per-code output so the
  API can surface which code the LLM designated as the reason-for-visit code.
- **No new UI controls needed for MVP.** No "first-listed" dropdown or drag-reorder
  required for the demo. The numbered suggestion cards (rank 1 = first-listed) are
  sufficient. Drag-reorder is V2.
- **Optional submission validation** added to the API spec: server-side check for
  known `code_first` violations at `POST /tasks/:id/submit`. Returns `400` with a
  warning if manifestation precedes etiology; coder can override with `?override=true`.
  Best-effort string matching for MVP; structured rules engine is V2.
- **`pipeline.submissions.final_codes TEXT[]`** already captures ordered sequence — the
  array order IS the submission sequence. No schema change needed.

**Alternatives surfaced:**
- Mandatory sequencing validation (block submission entirely) — too aggressive for MVP;
  coders may have clinical reasons to override; flagging is the right UX
- Adding a `pipeline.submission_codes` junction table with `sequence_position` — more
  normalized but unnecessary given `final_codes TEXT[]` already captures this correctly

---

## 2026-04-10 — ICD-10 Hierarchy Traversal

**Status:** Decided → see `docs/technical-design/icd10-hierarchy.md`
**Next:** Complete — `reference.icd_codes` already has `parent_code` FK from the vector-
store decision. Added `billable BOOLEAN` column and two new indexes to formalize the
design. ICD-12 (reference schema migration) can incorporate these additions.

ICD-10-CM is a 6-level tree: chapter → block → 3-char category → 4/5/6/7-char codes
(~80,000 total nodes, ~72,000 billable). The traversal needs are: breadcrumb display for
the review UI, and descendant expansion for when vector retrieval returns a non-billable
header code.

Key decisions:
- **`parent_code TEXT REFERENCES reference.icd_codes(code)`** — already in schema.
  Populated during the CMS XML ETL traversal by propagating the parent code through the
  recursive `<diag>` element walk.
- **`billable BOOLEAN NOT NULL DEFAULT TRUE`** — non-billable header/grouping nodes
  (categories, blocks, chapters) are stored in the same table with `billable = FALSE`
  rather than a separate hierarchy table. Keeps JOINs simple; the descendant expansion
  CTE filters `WHERE billable = TRUE`.
- **`chapter TEXT` and `block TEXT`** denormalized columns — avoids the recursive CTE
  for the common case of filtering by chapter or block (O(1) scan, no recursion).
- **Recursive CTE** for ancestor chain (breadcrumb, max 6 iterations) and descendant
  expansion (bounded to ~150 children for the widest category, e.g. E11 Type 2 diabetes).
- **Apache AGE rejected** — graph extension adds an openCypher engine, custom storage,
  and a compiled extension. Overkill for a 6-level tree where recursive CTEs are standard
  Postgres and require no additional dependencies.
- **Two new indexes** added to formalize: `icd_codes_parent_idx` on `(parent_code)` for
  efficient child lookups; `icd_codes_desc_trgm_idx` GIN trigram index on `short_desc`
  and `long_desc` for the code search endpoint (ILIKE → `%` queries).
- **`pg_trgm`** is bundled with Postgres and available on RDS without extension install.

**Alternatives surfaced:**
- Apache AGE (openCypher) — full graph engine; rejected (tree too shallow)
- Separate `reference.icd_hierarchy` table for non-billable nodes — rejected (same table
  with `billable` flag is simpler; no cross-table JOINs for breadcrumbs)
- Materialized paths (`ltree` extension) — useful for deep trees or frequent subtree
  queries; ICD-10's 6-level depth doesn't justify the complexity

---

## 2026-04-10 — RDS Connection Pooling

**Status:** Decided → see `docs/technical-design/rds-connection-pooling.md`
**Next:** Complete — ICD-19 (`api` crate) and ICD-21 (`workers` crate) can now use the
correct pool initialization pattern. No RDS Proxy needed for demo scale.

Decided the Lambda DB connection pooling strategy: `max_connections(2)` per Lambda pool,
initialized once in `main()` before the runtime loop — not via `OnceLock` (which can't
`.await` inside a sync closure).

Key decisions:
- **No RDS Proxy for demo.** Connection math: ~20 total connections vs ~112 max on
  `db.t3.micro` (1 GB RAM). 73% headroom — proxy adds $22/month and complexity for
  nothing at this scale.
- **Pool initialized in `main()`** — Lambda execution model is one container = one
  process = one `main()`. Everything before `lambda_http::run()` persists across warm
  invocations. This is the standard cold-start optimization pattern.
- **`min_connections(0)`** prevents idle containers from holding open connections that
  count against the RDS limit when no requests are in flight.
- **`acquire_timeout(3s)`** fails fast if the pool is exhausted rather than queuing
  indefinitely.
- **Corrects the `OnceLock<PgPool>` anti-pattern** in `db-library.md` — `OnceLock::
  get_or_init` takes a sync closure; the async variant `tokio::sync::OnceCell` is
  correct but unnecessary here since `main()` already runs once per container.
- **RDS Proxy threshold:** add when `DatabaseConnections` CloudWatch metric exceeds 80%
  of `max_connections` or Lambda concurrency exceeds ~50 simultaneous invocations.

**Alternatives surfaced:**
- `tokio::sync::OnceCell` — correct for async lazy init; unnecessary since `main()` is
  already the single-initialization point per container
- RDS Proxy now — rejected: $0.03/hour minimum, extra network hop, IAM auth complexity,
  and the demo doesn't come close to saturating the RDS connection limit

---

## 2026-04-10 — Rust Error Handling Patterns

**Status:** Decided → see `docs/technical-design/rust-error-handling.md`
**Next:** Complete — finalises conventions for all implementation cards. `Cargo.toml`
workspace dependencies committed. All ICD-17 through ICD-21 can now be picked up.

Decided the error handling split across the codebase: `thiserror` for library crates
(`core`, `db`, `llm`, `knowledge-graph`), `anyhow` for Lambda/binary crates (`api`,
`workers`, `etl`). Added workspace-level `[workspace.dependencies]` and
`[workspace.lints.clippy]` to `Cargo.toml`.

Key decisions:
- **Library crates expose typed errors** (`thiserror` enums) so callers can match on
  `NotFound` vs `Database` vs `Conflict` at the handler boundary. A `db` function that
  returns `anyhow::Error` is unusable by `api` — the handler can't tell a missing row
  from a connection failure.
- **Binary crates use `anyhow`** for ergonomic `?`-propagation with `.context("...")`.
  CloudWatch logs read "load code suggestions: connection refused" rather than a raw
  sqlx error with no context.
- **No logging in library crates** — only binary crates log at error sites (outer boundary).
  Double-logging creates noise; the library's job is to return the error, not to log it.
- **`clippy::unwrap_used = "warn"`** workspace-wide catches errant `unwrap()` calls.
  Set to `warn` not `deny` initially to allow `expect("hardcoded UUID")` with comments.
- **`anyhow::Error` → `lambda_http::Error`** conversion is built-in (`Into` impl).
  `ApiError` (thiserror enum) implements `IntoResponse` at the Axum handler boundary.
- Workspace dependencies (`thiserror`, `anyhow`, `tracing`, `tokio`, `serde`, `uuid`,
  `chrono`) are pinned once in root `Cargo.toml` and referenced with `{ workspace = true }`.

**Alternatives surfaced:**
- `miette` for rich diagnostic errors — more ergonomic for CLI tools; overkill for API
  and Lambda contexts where the consumer is JSON
- Single error type across all crates (boxed `dyn Error`) — loses type information needed
  at the handler boundary

---

## 2026-04-10 — CI/CD Pipeline

**Status:** Decided → see `docs/technical-design/ci-cd-pipeline.md`
**Next:** Complete — `.github/workflows/ci.yml` committed; CI is live on next push.
Next research topic: Rust error handling patterns (Tier 4 #18) or ICD-10 hierarchy
recursive CTE (Tier 2 #8).

Three GitHub Actions jobs: `check` (cargo check + clippy + test on all pushes/PRs),
`frontend` (npm build on all pushes/PRs), `build-lambdas` (ARM64 Lambda build on push
to main only, after `check` passes).

Key decisions:
- **SQLX_OFFLINE=true** in CI with `.sqlx/` committed to the repo. No live Postgres
  needed in CI. Developers run `make sqlx-prepare` locally after any `query!` change
  and commit the updated `.sqlx/` files. CI fails with a clear compiler error if they
  forget — discipline is enforced by the compiler, not documentation.
- **No CDK deploy in CI for MVP** — manual `cdk deploy` from Thomas's machine. Automated
  CDK deploy via GitHub OIDC is V2.
- **Vercel auto-deploys** handled by the Vercel GitHub App, not by the CI workflow.
- **cargo-lambda via pip** on Ubuntu GitHub runner — cleanest install path; provides
  Zig-based cross-compilation for ARM64 Lambda from x86 runner.
- **ARM64 Lambda target** (`--arm64`) — 20% cheaper, faster cold starts than x86 on AWS.
- `package-lock.json` global gitignore was removed; replaced with `/package-lock.json`
  (root only) so `ui/package-lock.json` is tracked and `npm ci` works in CI.

**Alternatives surfaced:**
- Live Postgres in CI (`docker compose up postgres`) for real sqlx macro validation —
  adds complexity; SQLX_OFFLINE is sufficient for compile-time query checking
- GitHub OIDC + IAM role for AWS creds in CI — cleaner security; V2 alongside CDK deploy automation
- `cargo deny` for license/vulnerability audit — worth adding once dependency graph stabilises

---

## 2026-04-10 — Local Development Environment

**Status:** Decided → see `docs/technical-design/local-dev-environment.md`
**Next:** Complete — unblocks all `db` crate migration cards (ICD-12, 14, 15, 16) and
local API Lambda development (ICD-19)

The local dev environment decision was the next practical blocker: without a running
Postgres+pgvector instance, no one can implement or test the db crate migration cards,
run `cargo sqlx prepare` for offline mode, or test the API Lambda locally.

Key decisions:
- `pgvector/pgvector:pg16` Docker image is multi-arch (confirmed `linux/arm64` in the
  manifest) — works natively on Raspberry Pi 4/5 with 64-bit OS without any `platform:`
  override or QEMU emulation.
- No LocalStack — real AWS credentials for S3/SQS in dev. Cost < $0.01/day. LocalStack's
  emulation diverges from real AWS in ways that cause subtle bugs (presign URL formatting,
  queue attribute behaviour). A `USE_MOCK_AWS=true` env var short-circuits the API's S3/SQS
  calls for contributors without AWS credentials.
- Migrations live at `sql/migrations/` (workspace root); referenced in the `db` crate via
  `sqlx::migrate!("../../sql/migrations")` (resolved at compile time from `crates/db/`).
- Ollama optional compose profile for offline LLM testing; `BEDROCK_ENDPOINT_URL` env var
  routes the `llm` crate to Ollama instead of Bedrock.

Committed actual artifacts: `docker-compose.yml`, `.env.example`, `sql/migrations/`
directory, `sql/seed/001_demo_user.sql` (fixed UUID `00000000-0000-0000-0000-000000000001`
for demo user so it can be hardcoded in `.env` and Vite config).

**Alternatives surfaced:**
- LocalStack: rejected due to emulation divergence and maintenance surface
- Migrations inside `crates/db/migrations/`: valid sqlx convention but contradicts the
  workspace-level `sql/` directory specified in CLAUDE.md and earlier design docs
- `docker-compose exec postgres psql` for manual DB inspection during dev

---

## 2026-04-10 — MVP Feature Cut and API Design

**Status:** Decided → see `docs/technical-design/mvp-api-design.md`
**Next:** Complete — unblocks `crates/api` implementation, React frontend, CDK ApiStack. Next:
implement Stage 3 Bedrock worker (code selection) and the Axum API Lambda.

Decided the minimum feature surface required to make the demo compelling to a hospital
administrator or investor. The "aha" moment is the side-by-side review page with evidence
highlighting — that must be perfect. Everything else is in service of getting there.

Key decisions:
- **Cut "modify suggestion"** — requiring the coder to reject a suggestion and add the
  correct code via the lookup panel achieves identical control with far less UI complexity.
  A dedicated inline search widget inside each suggestion card is not worth the implementation
  time for the demo.
- **Combined upload + task list page** — a single page with the upload form at the top and
  a task table below. No separate "queue management" view. Client polls GET /tasks every 3
  seconds while any task is in a processing state.
- **7 endpoints**: POST /tasks (upload), GET /tasks (list), GET /tasks/:id (status),
  GET /tasks/:id/review (full review payload), POST /suggestions/:id/review (accept/reject),
  POST /tasks/:id/submit (finalize), GET /codes/search (code lookup ILIKE query).
- **Upload through Lambda** (not presigned S3 URL) for demo simplicity — avoids CORS and
  presign complexity. Direct S3 upload is V2.
- **X-User-Id header auth** — single seeded demo user, no JWT. Auth is a one-middleware
  change when V2 requires it.
- **Bedrock model: Claude Haiku** for Stage 3 code selection. Adequate reasoning quality
  on synthetic clinical notes; ~$0.001/note; upgrade to Sonnet is a one-line change if
  reasoning quality disappoints.

**Alternatives surfaced:**
- Direct S3 presigned upload URL — better for large files; revisit when PDF support lands
- WebSocket or SSE for task completion notification — avoids polling; revisit when coder
  experience polish matters (V1.1 or V2)
- Full-text search (`tsvector`) on reference.icd_codes — better search quality than ILIKE;
  trivially added to the `001_reference_schema.sql` migration as an index (V2)

---

## 2026-04-10 — Comprehend Medical → ClinicalEntity Mapping

**Status:** Decided → see `docs/technical-design/comprehend-entity-mapping.md`
**Next:** Complete — unblocks `core` crate `ClinicalEntity` type, `llm` crate Comprehend client, and the extraction worker Lambda

Decided the mapping from Comprehend Medical `DetectEntitiesV2` output categories to the
internal `ClinicalEntity` type in the `core` crate.

Key findings:
- Comprehend returns 5 categories. Only `MEDICAL_CONDITION` entities are primary ICD-10
  retrieval candidates for MVP. `TEST_TREATMENT_PROCEDURE` entities with a `TEST_VALUE`
  attribute (e.g. "troponin 2.4 ng/mL") are secondary candidates — a numeric lab value
  implies a diagnosis and maps well to ICD-10 inclusion terms.
- `MEDICATION` and `ANATOMY` entities are stored in `pipeline.entities` for context but
  do not trigger vector store retrieval for MVP. Medication → adverse-effect code mapping
  is complex and deferred to V2.
- `PROTECTED_HEALTH_INFORMATION` entities are dropped in-memory before any persistence.
  PHI must never appear in `pipeline.entities.entity_text` or CloudWatch logs.
- Comprehend's NEGATION and HYPOTHETICAL traits are hard filters: any entity with either
  trait score > 0.5 is skipped for retrieval. Generating a code for "no chest pain" is a
  compliance risk.
- Attribute enrichment (DIRECTION, ACUITY) is done in-process by concatenating the
  attribute text onto the entity span: "ST elevation" + DIRECTION="anterior" →
  `query_text = "anterior ST elevation"`. This improves vector retrieval recall with zero
  additional API calls.

Decided against Bedrock enrichment in Stage 1: adds latency and cost before baseline
recall is measured. The CMS inclusion terms already cover most clinical synonyms.

**Alternatives surfaced:**
- Bedrock enrichment call (rewrite entity to canonical clinical phrase) — revisit if
  recall@10 < 70% on test notes
- Lab-value normalizer (HbA1c > 6.5% → diabetes lookup) — V2; raw lab span used for now
- Entity deduplication strategy — overlapping spans from Comprehend need de-dup logic
  before bulk insert; handle by highest-confidence wins on `(char_start, char_end)` pairs

---

## 2026-04-10 — Database Schema Design (All 4 Schemas)

**Status:** Decided → see `docs/technical-design/db-schema-design.md`
**Next:** Complete — unblocks all `db` crate modules, `api` crate endpoints, `workers` crate,
and CDK RDS resource provisioning. Next blocking open decision: Comprehend Medical →
internal `ClinicalEntity` type mapping.

Designed all four Postgres schemas in a single RDS instance. Cross-schema FKs are allowed
(same instance — schemas partition by concern, not isolation).

Key decisions:
- `app.tasks` task_status enum models the pipeline state machine end-to-end
  (uploaded → extraction_queued → extracting → selection_queued → selecting → complete | failed).
  State transitions enforced by application layer, not Postgres CHECK constraints.
- `clinical.encounters` has a `char_count` generated column — used to estimate Comprehend
  Medical cost before invoking the API ($0.01 per 100 characters).
- `pipeline.code_suggestions.evidence_spans` is JSONB (not a normalized table) for MVP.
  Character offsets into `clinical.encounters.original_text` drive the frontend highlight overlay.
- `pipeline.manual_codes` is a high-quality training signal (AI missed these codes entirely);
  write-only for MVP — the correction ingestion loop is V2.
- Migration ordering (001 → 002 → 003 → 004) required due to cross-schema FKs. All migrations
  live in `sql/migrations/` and embed via `sqlx::migrate!`.

**Alternatives surfaced:**
- Normalized `pipeline.evidence_spans` table if individual span querying becomes common
- Optimistic locking (`SELECT … FOR UPDATE SKIP LOCKED`) for task queue claim — not needed
  for demo with one coder; revisit when concurrent workers are deployed

---

## 2026-04-10 — HIPAA Scope for MVP

**Status:** Decided → see `docs/technical-design/hipaa-scope.md`
**Next:** Complete — unblocks AWS deployment design (no special HIPAA controls required for
demo phase with synthetic data only)

Decided that the MVP prototype uses synthetic clinical notes only. No HIPAA BAA with AWS.
No PHI-specific controls in the AWS deployment for the demo phase.

The key insight: AWS services (RDS, S3, SQS, Lambda) encrypt data at rest and in transit
by default. The HIPAA-specific requirement is the BAA contractual agreement and audit/logging
controls, not encryption per se. Without real patient data, neither is legally required for
the demo.

Documented a full pre-production HIPAA checklist (BAA, SSE-KMS with CMK, VPC private
subnets, CloudTrail, GuardDuty, AWS Config, CloudWatch log retention, IAM least-privilege)
as a gate before any real patient data is introduced.

**Alternatives surfaced:**
- Full HIPAA-eligible deployment before onboarding a real hospital/clinic pilot — checklist
  is in the decision doc and ready to execute when needed

---

## 2026-04-10 — IaC Tooling (Terraform vs CDK)

**Status:** Decided → see `docs/technical-design/iac-tooling.md`
**Next:** Complete (unblocks AWS infrastructure provisioning)

Investigated Terraform (HCL) vs AWS CDK (TypeScript) for the CliQueue monorepo.
CDK was chosen: TypeScript is already in the repo for the UI, CDK gives strongly-typed
infrastructure that is more navigable by AI agents, and for an all-AWS stack the
multi-cloud portability of Terraform is irrelevant.

CDK L2 constructs exist for all primary services (RDS, SQS, Lambda, S3, API Gateway).
Bedrock and Comprehend Medical are L1-only for now — more verbose but fully functional.
The `@aws-cdk/aws-glue-alpha` package offers L2-like DX for Glue jobs.

Lambda Rust deployment via `cargo-lambda build` is a manual pre-synth step regardless of
IaC tool — CDK's asset bundling makes this slightly more ergonomic but the difference is
minor.

**Alternatives surfaced (future research tasks):**
- Pulumi (TypeScript) — similar DX to CDK but multi-cloud; worth a look if we ever need
  a non-AWS option
- If the team grows and ops engineers join, Terraform becomes more natural (HCL is more
  readable as a config format to non-developers)

---

## 2026-04-10 — CMS ICD-10 ETL Pipeline (file format + approach)

**Status:** Decided → see `docs/technical-design/cms-etl-pipeline.md`
**Next:** Complete — unblocks reference data seeding and the `etl` crate

CMS tabular XML chosen over fixed-width text: XML has hierarchy (chapter/section/code),
inclusion terms (synonyms!), and exclusion/coding notes. The flat text file loses all of
this. XML is ~15 MB, parsed in <1s by quick-xml streaming.

AWS Glue rejected: overkill for a 15 MB file parsed once per year. A Rust Lambda handles
the XML parse + Postgres upsert. Bedrock Batch Inference handles the 200K embedding
generation (S3 JSONL in → JSONL out, ~30-60 min wall-clock at AWS scale).

Key insight: CMS inclusion terms expand the initial key set from ~72K to ~200K embedding
rows before any coder contributes. These are official clinical synonyms curated by the
ICD-10 specification authors — a significant head start for retrieval quality.

For MVP/demo: skip Batch Inference, use 50 concurrent async Tokio tasks against
on-demand Titan Embed v2. Slower (~90 min for full corpus) but simpler to build first.

**Alternatives surfaced:**
- EventBridge scheduled rule on Oct 1 for annual refresh automation
- Blue/green `cms_version` swap for zero-downtime annual updates
- Quota increase request (Service Quotas console) for faster on-demand embedding

---

## 2026-04-10 — Embedding Model: Titan Embed v2 vs Cohere Embed v3

**Status:** Decided → see `docs/technical-design/embedding-model.md`
**Next:** Complete — schema column is now `vector(1024)`; unblocks reference migration

Titan Embed v2 at 1024 dimensions chosen over Cohere Embed v3 English. Both default to
1024-dim, so there is no schema difference. Decisive factor: Cohere v3's key advantage
(asymmetric `input_type` for document vs query embedding) is unreliable on Bedrock's API
wrapper — the feature that would justify 5× the cost is partially unavailable. Without it,
Titan and Cohere perform comparably on short clinical key texts (10–200 chars).

Cost is negligible at demo scale (~$0.07 to embed the full 72K code corpus). At query time
($0.02/1M tokens), embedding a clinical entity phrase costs ~$0.000003 per call.

MiniLM-L6-v2 (384-dim) from the prototype is not used in production — incompatible
dimension. Integration tests can mock or use real Bedrock at negligible cost.

**Alternatives surfaced:**
- Cohere Embed v3 via direct API (not Bedrock) — `input_type` works there; worth
  benchmarking if Titan retrieval recall disappoints
- Fine-tuned BioBERT / PubMedBERT — best quality for medical text but needs GPU/SageMaker;
  revisit post-MVP when labeled data accumulates

---

## 2026-04-10 — SQS Queue Design

**Status:** Decided → see `docs/technical-design/sqs-queue-design.md`
**Next:** Complete (unblocks `workers` crate and CDK pipeline stack)

Two SQS Standard queues (extraction, code-selection), each with its own DLQ and a
`maxReceiveCount` of 3. Visibility timeouts differ: 60s for extraction (Comprehend ~10s
median), 300s for code selection (Bedrock 30–60s median). Separate Lambda per stage for
independent scaling and clean error separation. Message payload is minimal — just
`{ task_id, attempt }` — all state lives in Postgres. Workers are idempotent by checking
task status before processing.

SNS rejected for MVP (pipeline is sequential, not fan-out). One-queue option rejected due
to head-of-line blocking when visibility timeouts differ between stages.

**Alternatives surfaced:**
- Step Functions for better visibility, retries, and timeout handling at higher complexity
- SNS in front of SQS when pipeline branches are added (OCR, PII scrub)
- WebSocket/SSE for task completion notification (deferred to UI design)

---

## 2026-04-10 — DB Library: SeaORM vs SQLx

**Status:** Decided → see `docs/technical-design/db-library.md`
**Next:** Complete (unblocks `db` crate and schema design)

SQLx 0.8.x chosen over SeaORM. Decisive factors: SeaORM's multi-schema FK generation is
broken (GitHub #2308); SQLx inline `query_as!` macros are more agent-navigable than SeaORM's
DSL query builder; pgvector works natively with both but SQLx is simpler (cosine distance
queries expressed as raw SQL). Compile-time SQL checking via `cargo sqlx prepare` + offline
mode gives schema drift protection without requiring a live DB in CI.

SeaORM 2.0 introduced breaking changes in Sept 2025, adding risk for an AI-agent-maintained
codebase that needs stable patterns. SQLx has 86M downloads vs SeaORM's 18M — larger
ecosystem for agent training data and Stack Overflow coverage.

**Alternatives surfaced (future research tasks):**
- SeaORM for the `app` schema only (users/tasks CRUD) — its active-record helpers reduce
  boilerplate for simple CRUD operations; could use both libs in the same workspace
- Diesel (sync, compile-time checked) — worth a note but async-incompatible without
  `spawn_blocking`; not viable for Lambda

---

## 2026-04-10 — Vector Store Schema (pgvector, one row per key)

**Status:** Decided → see `docs/technical-design/vector-store.md`
**Next:** Embedding model dimension choice (Tier 2 #7) — determines `vector(N)` in schema

The prototype's ChromaDB design was the key signal: it stores one document per `CodeKey`
(not one per code), because each key has its own embedding and keys grow over time via
coder feedback. The `code_embeddings` table mirrors this exactly: `(code_id, facet, source,
key_text, embedding, approved)` — one row per key.

Separate-columns-per-facet (Option A) was rejected because it structurally prevents the
evolving key model — you can't have multiple synonyms if each facet is just one column.

OpenSearch rejected for MVP: pgvector HNSW handles 360K vectors (~72K codes × 5 keys) well
within latency targets, and adding a second managed service adds operational complexity for
no gain at this scale.

Bedrock Knowledge Bases rejected permanently: loses direct control of the knowledge graph,
which is the core product IP.

RRF stays in the application layer (Rust), not SQL — simpler and easier to tune.

**Alternatives surfaced:**
- Benchmark HNSW params (`m`, `ef_construction`) after loading full code set
- Consider separate `knowledge` schema for coder-contributed keys vs `reference` for CMS data
- OpenSearch hybrid search if BM25+vector matters for the code-book search UX feature

---

## 2026-04-10 — Vector Search: pgvector vs OpenSearch vs alternatives

**Status:** Exploring
**Next:** Research pgvector multi-facet strategy; also investigate OpenSearch k-NN as
a managed alternative

The prototype uses ChromaDB for vector storage with 3 separate facet collections and
reciprocal rank fusion (RRF) at the application layer. The new stack needs to decide
how to do this in a production setting.

Three architectural paths exist:

**Path 1: pgvector (Postgres extension)**
Keep the database simple — one Postgres instance handles both relational data and vector
search. pgvector supports multiple index types (ivfflat, hnsw), cosine/L2/inner-product
similarity, and runs as an RDS extension (RDS now supports pgvector). The multi-facet
question is still open: separate columns per facet vs a dedicated `embeddings` table with
a `facet` enum. RRF would move to a SQL CTE or application layer.

Pros: one database to operate, pgvector on RDS is managed, no additional service.
Cons: Postgres query planner doesn't natively optimize for ANN at scale; at 72K codes × 3
facets = 216K vectors × 1536 dims that's ~1.3GB of vector data — fine for RDS, but queries
can slow at scale.

**Path 2: AWS OpenSearch Service (k-NN plugin)**
OpenSearch has a native k-NN plugin with HNSW and IVF support. AWS manages it as a
serverless or provisioned cluster. It supports multi-field vector search natively and can
combine BM25 text search with vector search (hybrid search). This is the approach used by
AWS Bedrock Knowledge Bases under the hood.

Pros: purpose-built for vector search at scale, hybrid search (BM25 + vector) is
first-class, managed by AWS, integrates naturally with Bedrock.
Cons: separate service to operate (not just an extension), higher cost than RDS + pgvector,
more complex query model, data duplication if relational data stays in Postgres.

**Path 3: Bedrock Knowledge Bases (fully managed RAG)**
AWS Bedrock Knowledge Bases manages the entire ingestion + embedding + retrieval pipeline.
You upload documents to S3 and get a managed vector store (backed by OpenSearch Serverless
or Aurora pgvector). Retrieval is via a single API call. This would replace our custom
pgvector + ETL design.

Pros: almost zero infrastructure to manage, integrated with Bedrock models.
Cons: loses fine-grained control over the knowledge graph (our core IP), limited support
for our evolving key-value model (adding new keys to existing codes), unclear how coder
feedback would integrate, cost at scale is higher.

**Current lean:** pgvector for MVP (simpler, one database, RDS managed). OpenSearch
becomes worth considering if retrieval quality or latency is insufficient at full 72K code
scale, or if hybrid BM25+vector search proves important for the coder code-lookup feature.

**Alternatives surfaced (future research tasks):**
- Benchmark pgvector hnsw vs OpenSearch k-NN on 72K medical codes (recall@20, latency)
- Investigate AWS Bedrock Knowledge Bases more deeply — does it support evolving key sets?
- Investigate Qdrant Cloud as a managed vector DB with strong multi-tenant and filtering support
- Research whether BM25 (keyword) + vector hybrid search improves code lookup for coders
  using the built-in code book search feature

---
## 2026-04-10 — Planning Phase Complete; Implementation Sprint Begins

**Status:** Decided
**Next:** Implement — delegate ICD-17 (core crate) + ICD-21 (workers scaffold) to Codex first;
then ICD-12, ICD-14 in the second wave.

All 15 implementation cards are specced, audited, and at Backlog/Agent Ready in Linear.
The full planning-to-implementation pipeline is:

**Implementation dependency order:**
```
ICD-17 (core crate)    ──────────────────────────────────────┐
ICD-21 (workers scaffold)  ──────────────────────────────────┤
ICD-12 (reference migration)  ────────────────────────────── ┤
ICD-14 (app migration)  ──────────────────────────────────── ┤
                ↓                                            ↓
ICD-15 (clinical migration) ← ICD-14                  ICD-13 (cms-parser) ← ICD-12
                ↓
ICD-16 (pipeline migration) ← ICD-15
                ↓
ICD-18 (llm crate / Comprehend) ← ICD-17
                ↓
ICD-22 (extraction worker) ← ICD-21 + ICD-18 + ICD-16
                ↓
ICD-23 (selection worker) ← ICD-22
ICD-19 (api crate) ← ICD-16 + ICD-17
ICD-20 (frontend) ← ICD-19
ICD-24 (CDK infra) ← all others
ICD-25 (embed-runner) ← ICD-12 + ICD-13
```

**Wave 1 (parallel, zero blockers):** ICD-17, ICD-21
**Wave 2 (parallel, after Wave 1):** ICD-12, ICD-14, ICD-13 (needs ICD-12 schema)
**Wave 3:** ICD-15, ICD-18, ICD-25
**Wave 4:** ICD-16, ICD-22
**Wave 5:** ICD-23, ICD-19, ICD-24
**Wave 6:** ICD-20

**Pre-implementation blocker (push):** 24 commits queued locally. Git push rejected due to
OAuth App missing `workflow` scope (`.github/workflows/ci.yml` triggers the check). Fix:
```bash
gh auth refresh -s workflow
git push CliQueue-ICD-10 master
```

**Demo data audit (spot check):** `docs/demo/clinical-notes/01-diabetes-foot-ulcer.md`
is medically accurate with correct ICD-10 sequencing, ground truth codes (E11.621 → L97.419
code-first pair), expected Comprehend extraction behavior, and DIRECTION/ACUITY attribute
enrichment documented. All 5 notes cover different specialties: diabetes/wound, cardiology,
respiratory, URI, orthopedic.

**Alternatives surfaced:**
- MIMIC-IV dataset (real de-identified discharge summaries) — useful for accuracy benchmarking
  post-MVP; access via PhysioNet requires DUA; not needed for synthetic demo
- Knowledge graph versioning V2 (see `docs/research/knowledge-graph-versioning.md`) —
  promotion pipeline, candidate/stable/retired status, conflict resolution — all deferred
  until real coder feedback data exists

---
## 2026-04-10 — SQLx Cross-Schema Prepare Gap in ICD-14

**Status:** Decided — ICD-14 and ICD-16 comments updated
**Next:** Complete — no further action needed before Wave 2 agents start

**Finding:** ICD-14 (`app` schema migration) specifies a `list_pending_review` function
that joins `app.tasks → clinical.encounters → pipeline.submissions`. SQLx's `query_as!`
macro validates SQL at **compile time** against a live Postgres snapshot captured by
`cargo sqlx prepare`. When only migration 002 is applied, `clinical.encounters` and
`pipeline.submissions` don't exist yet — `cargo sqlx prepare` would fail with
`relation "clinical.encounters" does not exist`, making the ICD-14 acceptance criterion
`cargo sqlx prepare succeeds` impossible to satisfy in isolation.

**Root cause:** ICD-14 was written before the SQLx offline-mode implications of the
multi-migration sequence were fully thought through. Cross-schema queries must be prepared
against a DB where all referenced schemas exist.

**Fix applied (via Linear comments):**
- ICD-14 comment: remove `list_pending_review` from ICD-14's scope; replace with
  `list_tasks_for_user(pool, user_id)` (single-schema, always valid after migration 002)
- ICD-16 comment: add `list_pending_review` here — after all 4 migrations run, the
  cross-schema join compiles cleanly; full SQL body provided in the comment

**Pattern for future cards:** Any `query_as!` macro that spans multiple schemas must live
in the card for the *latest* migration it depends on. The safe rule: if a query references
tables from migration N, it belongs in the card that implements migration N (or later).

**Other migrations checked — no similar issues:**
- ICD-12 (`reference` schema): standalone, no cross-schema FKs — fine
- ICD-15 (`clinical` schema): FKs `app.tasks`, but only queries its own schema — fine
- ICD-16 (`pipeline` schema): all schemas present by migration 004 — fine

**Alternatives surfaced:**
- Use `sqlx::query_as` (runtime, not compile-time) for cross-schema queries in earlier
  cards — technically works but loses compile-time SQL checking, which is SQLx's main value
- Split `.sqlx/` cache by migration wave — overly complex; moving the function is simpler

---
## 2026-04-10 — Implementation Wave Progress + ICD-15/ICD-25 Pre-flight Audit

**Status:** Decided — no issues found; implementation proceeding
**Next:** Complete. Wave 3 (ICD-15, ICD-25) can be launched immediately after Wave 2 merges.

### Wave state (as of this iteration)

| Wave | Cards | Status |
|------|-------|--------|
| 1 | ICD-17 (core), ICD-21 (workers scaffold) | ✅ Merged to master |
| 2 | ICD-12 (reference schema), ICD-14 (app schema), ICD-18 (llm/Comprehend) | 🔄 Codex agents running |
| 3 | ICD-15 (clinical schema), ICD-25 (embed-runner) | ⬜ Ready once Wave 2 merges |
| 4 | ICD-16 (pipeline schema) | ⬜ Blocked by ICD-15 |
| 5 | ICD-13 (cms-parser), ICD-19 (api), ICD-22 (extraction worker), ICD-23 (selection worker) | ⬜ |
| 6 | ICD-20 (frontend), ICD-24 (CDK infra) | ⬜ |

### ICD-15 pre-flight audit — CLEAN

All three functions (`create_encounter`, `get_encounter_by_task`, `get_encounter`) query only
`clinical.encounters`. No cross-schema joins in this card — the `sqlx prepare` conflict pattern
found in ICD-14 does NOT affect ICD-15.

Key implementation note for the agent: `char_count` is a Postgres `GENERATED ALWAYS AS` column.
It must be excluded from INSERT column lists. The card correctly specifies `RETURNING *` on the
INSERT to get back the computed value. Attempting to insert `char_count` will fail with
"cannot insert into column ... of relation ... because it is a generated column."

### ICD-25 (embed-runner) pre-flight audit — CLEAN

Spec matches `cms-etl-pipeline.md` exactly: 50-task `tokio::sync::Semaphore`, Titan Embed v2
at `dimensions=1024, normalize=true`, individual UPDATEs within 1,000-row chunks (MVP path —
a true bulk UNNEST UPDATE is V2). Idempotency is built-in: re-running only processes rows
where `embedding IS NULL`.

One note for the Wave 5 agent: the per-row UPDATE loop (~200K individual UPDATE statements)
is a known performance trade-off for the demo. The query is fast per row (indexed PK lookup)
but incurs round-trip overhead. At 2ms/UPDATE × 200K = ~400 seconds = ~7 minutes of DB time,
well within the 15-min Lambda timeout. Acceptable for the one-shot seed run.

### db crate Cargo.toml pre-committed

`crates/db/Cargo.toml` was pre-populated with all Wave 2–4 deps before launching parallel
agents, eliminating the merge-conflict-on-shared-file problem for all subsequent db crate cards.
ICD-15 and ICD-16 should specify "Cargo.toml already has all deps — do NOT modify it."

**Alternatives surfaced:**
- UNNEST bulk UPDATE for ICD-25 (`UPDATE ... FROM UNNEST($ids, $vecs) AS u(id, vec)`) —
  reduces 200K round trips to one SQL statement; ~10x faster; V2 optimization
- JoinSet → batch flush pattern (flush every 1K results rather than collect all 200K in memory
  first) — worth adding if 200K × 1024-dim float32 (~800MB RAM) exceeds Lambda memory limit

---

## 2026-05-17 research iteration — X12 275 TypeScript ecosystem and ClaimsAttachmentAdapter design

**Question investigated:** Does a maintained TypeScript/Node.js npm library exist for X12 275 claim attachment envelope generation — or must `@cliqueue/cda-attachments` hand-roll the X12 275 ISA/GS/BDS envelope?

**Key findings:**
- No maintained TS-native npm library for X12 275 generation. `node-x12` (aaronhuggins): maintenance-mode since 2021 (v1.6.1, Sept 2020). `node-x12-edi`: JavaScript-only, no X12 275 support. `x12-parser`: parse-only.
- BDS segment (Binary Data Structure) — not BIN — is the correct segment for base64 CDA payloads in X12 275 006020X314. BIN is for binary file metadata (PDF type annotation).
- X12 275 key structure: ISA/GS/ST → BHT → HL loop (provider HL*1, payer HL*2, patient HL*3) → NM1/REF*1K (CLM01 correlation) → BDS (base64 CDA) → SE/GE/IEA.
- `ClaimsAttachmentAdapter` requires two methods: `generateUnsolicited275()` and `parseSolicited277CA()`. CMS-0053-F covers both unsolicited and solicited flows.
- Payer adoption accelerating: BCBS Kansas (May 2025, both 5010+6020), NGS Medicare (June 2025, 6020). CMS-0053-F May 2028 deadline.
- This is the fourth confirmed `@cliqueue/*` ecosystem gap alongside `cds-hooks-client`, `pa-lifecycle`, and `cda-attachments`.

**Design implication:** `@cliqueue/cda-attachments` scope must expand to include an X12 275 envelope generator — or a separate `@cliqueue/x12-275` package — making the implementation substantially larger than initially scoped.

**Findings file:** [docs/research/agreement-layer/x12-275-typescript-npm-ecosystem-bds-envelope.md](agreement-layer/x12-275-typescript-npm-ecosystem-bds-envelope.md)

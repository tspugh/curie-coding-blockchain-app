# Off-Chain Pub-Sub / Messaging Patterns for PHI-Bearing Payloads Paired with Somnia Events

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — Off-chain pub-sub / messaging patterns for PHI-bearing payloads paired with Somnia on-chain events

**Question investigated:** What off-chain pub-sub / messaging patterns should cliqueue use to carry PHI-bearing clinical documents (C-CDA, FHIR) from hospital systems to the Corti Symphony coding engine — paired with Somnia `ClaimSubmitted` events — while satisfying HIPAA encryption requirements and achieving sub-5-second delivery to the coding engine?

### Finding 1: No canonical standard exists for EVM-event-triggered PHI delivery — the pattern is well-established but broker-agnostic

- There is no published HL7, ONC, or Somnia-specific standard defining an "on-chain event → off-chain PHI delivery" workflow for healthcare AI coding. The architecture is universally adopted in healthcare blockchain literature as the correct split, but the transport layer (broker choice) is an implementation decision.
- Academic consensus (hOCBS framework; PMC11082361 review of healthcare blockchain) is: on-chain stores only hash/pointer/audit event; off-chain delivers PHI payload via a separate pub-sub or messaging layer. ([hOCBS framework](http://www.ghpolicy.org/resources/Publications-2021/hOCBS--A-Privacy-Preserving-Blockchain-Framework-for-Healthcare-Data-Leveraging-an-On-chain-and-Off-chain-System-Design.pdf); [PMC11082361](https://pmc.ncbi.nlm.nih.gov/articles/PMC11082361/))
- HIPAA Vault's architecture summary confirms: "blockchain records transaction metadata and cryptographic hashes; PHI remains in encrypted off-chain storage." ([HIPAA Vault](https://www.hipaavault.com/resources/blockchain-integration-healthcare-records/))

### Finding 2: Three viable broker options — AWS SQS FIFO recommended for MVP, NATS JetStream for low-latency production

| Broker | Latency | Durability | HIPAA/BAA posture | Notes |
|---|---|---|---|---|
| **AWS SQS FIFO + KMS** | ~1–3 seconds | Managed, strong | AWS BAA covers SQS; simplest compliance path | Best minimal viable choice; carries only `claimIdHash` + S3 doc pointer, not the PHI payload itself |
| **NATS JetStream** | Sub-second to ~1 second | Good (operator-managed) | No vendor BAA; must run on BAA-covered infra (e.g., AWS EKS under AWS BAA); TLS + disk encryption + least-privilege required | Best latency; more ops burden; correct for $10M+ TVL production |
| **Apache Kafka** | Low | Excellent | Same as NATS — operator-managed, must be on BAA-covered infra | Overkill for MVP; best for high-throughput stream replay/analytics pipelines |

- NATS JetStream does NOT offer an AWS-style signed BAA. HIPAA compliance falls entirely on the operator: TLS 1.2+ (§164.312(e)(2)(ii)), filesystem/block-level encryption at rest (§164.312(a)(2)(iv)), subject-level least-privilege access controls (§164.312(a)(1)), and audit logging (§164.312(b)). ([HIPAA encryption overview](https://www.konfirmity.com/blog/hipaa-encryption-at-rest-and-in-transit-for-hipaa))
- AWS SQS FIFO messages should carry only the pointer (S3 URI or FHIR DocumentReference URL) and `claimIdHash`, NOT the clinical note bytes. The actual PHI payload lives in KMS-encrypted S3.

### Finding 3: Correct correlation pattern — `claimId` as `DocumentReference.identifier`, not as FHIR resource ID

- FHIR `DocumentReference.id` is a server-managed logical ID (auto-generated UUID). Ethereum `bytes32` hashes are not URL-safe and must NOT be used as `DocumentReference.id`.
- The correct pattern: store the on-chain `claimId` (hex-encoded `bytes32`) as a `DocumentReference.identifier` entry with a system URI such as `https://cliqueue.io/ethereum/claimId`. ([FHIR DocumentReference](https://hl7.org/fhir/documentreference.html))
- The CDA document's own `ClinicalDocument/id` (HL7 CDA R2 instance identifier) is stored as a second `DocumentReference.identifier`. ([PMC1380194 — HL7 CDA R2](https://pmc.ncbi.nlm.nih.gov/articles/PMC1380194/))
- Off-chain store key: the hospital-local PostgreSQL table maps `claimId (BYTEA) → documentReferenceId (UUID) → s3Uri (TEXT)`. The `claimId` is the join key between on-chain and off-chain.

### Finding 4: The "claim package" envelope pattern — not an HL7 standard, but de facto practice for AI coding engines

- No HL7/FHIR/ASC X12 standard defines an integrated envelope bundling 837 EDI + CDA attachment + AI coding metadata in a single unit. Vendors like Change Healthcare, Waystar, and Availity implement this internally as a "claim package ID" (GUID) that correlates all components.
- The closest FHIR-standard construct is a **FHIR Bundle** with:
  - `Bundle.identifier` = `{system: "https://cliqueue.io/claim-package", value: claimPackageId}` (a GUID, NOT the `bytes32` claimId)
  - Entry 1: `Binary` resource containing the 837 EDI text
  - Entry 2: `DocumentReference` pointing to the C-CDA document in S3, with `identifier` carrying the on-chain `claimId`
  - Entry 3: `Parameters` or custom `Task` resource for AI coding metadata (paStatus, heuristicVersion)
- This FHIR Bundle approach is consistent with HL7 integration-layer guidance and is what modern RCM AI platforms implement in practice. ([FHIR Bundle](https://hl7.org/fhir/bundle.html))
- The `claimPackageId` (GUID) and the on-chain `claimId` (`bytes32`) are distinct — the GUID is the off-chain operational key; the `bytes32` is the on-chain audit anchor. They are linked via the `DocumentReference.identifier` mapping.

### Finding 5: Recommended minimal viable off-chain architecture for cliqueue MVP

The complete event-driven flow for a claim with C-CDA attachment:

1. **Hospital EMR** pushes C-CDA document + 837 EDI to encrypted S3 (KMS); creates a `DocumentReference` in hospital FHIR server.
2. **Off-chain agent** generates `claimId = keccak256(CLIQUEUE_DOMAIN_SEPARATOR || hospitalId || CLM01)` and calls `ClaimsAdjudicator.submitClaim()` on Somnia — emitting `ClaimSubmitted(bytes32 indexed claimId, bytes32 indexed claimHash, uint8 indexed paStatus, bytes32 paAuthHash)`.
3. **Somnia event listener** (TypeScript, `viem` `watchContractEvent`) receives `ClaimSubmitted` event.
4. **Listener publishes** to **AWS SQS FIFO** queue: `{ claimId: "0x...", docPointer: "s3://...", correlationId: UUID, facilityId: hospitalId }`. No PHI in queue.
5. **Coding worker** (TypeScript) receives SQS message, fetches C-CDA from S3 via KMS-decrypted presigned URL, calls Corti Symphony MCP with the clinical note bytes.
6. **Corti returns** ICD-10 codes + `evidences` array. Worker applies `CodingConfidenceHeuristic`.
7. **Result**: if confidence sufficient, agent calls `ClaimsAdjudicator.adjudicateClaim()` on Somnia. Off-chain `claimId → documentReferenceId` mapping stored in hospital-local PostgreSQL.

Sub-5-second delivery is achievable with SQS FIFO (queue publish ~200ms, S3 fetch ~300ms, Corti call ~2–4s). Total: ~3–5s at P50.

### Finding 6: PHI-never-on-chain is fully satisfied by this architecture — no new PHI leakage vectors

- The SQS message body contains `claimIdHash` (non-PHI) and `s3Uri` (a pointer, non-PHI).
- The C-CDA bytes travel only: EMR → S3 (encrypted) → coding worker (TLS) → Corti Symphony (BAA-covered, Azure US).
- On-chain: only `claimId`, `claimHash`, `paStatus`, `paAuthHash` — none are PHI or PHI-derived under §164.514(b).
- The `DocumentReference.identifier` linking `claimId → documentReference` lives only in the hospital-local PostgreSQL store. If that store is compromised, PHI is not revealed (only the FHIR doc reference is accessible; PHI remains in KMS-encrypted S3 behind separate IAM).

**Design implication:** cliqueue's off-chain agent spec must define three infrastructure components — (A) KMS-encrypted S3 bucket (hospital-operated, BAA-covered AWS), (B) SQS FIFO queue (hospital-operated, BAA-covered AWS) for event relay, (C) hospital-local PostgreSQL for `claimId → documentReference` mapping — as normative deployment prerequisites listed in the hospital onboarding checklist. NATS JetStream is an acceptable alternative to SQS FIFO for hospitals running their own HIPAA-compliant Kubernetes infra.

**Open questions generated:**
1. Should the hospital BAA's "Off-Chain Messaging Exhibit" specify the minimum AWS SQS FIFO configuration (KMS key type, SQS message retention window, dead-letter queue settings) as a normative deployment prerequisite — so hospital IT vendors have a specific compliance checklist rather than relying on general HIPAA guidance?
2. Should cliqueue publish a reference `claimPackageId`-to-`claimId` mapping schema (PostgreSQL DDL) as part of the hospital onboarding package — standardizing the off-chain correlation store across all hospital deployments?
3. Should the FHIR Bundle "claim package" envelope pattern be published as a cliqueue TypeScript type in `@cliqueue/fhir-types` — giving hospital integration engineers a typed `ClaimPackageBundle` construct that assembles the 837 Binary + DocumentReference + Parameters entries in the correct FHIR-valid format?

---

**See also** — [[../topics/hipaa|HIPAA hub]] · [[../topics/corti|Corti hub]] · [[../topics/prior-auth|PA hub]] · [[../topics/somnia-substrate|Somnia substrate hub]]

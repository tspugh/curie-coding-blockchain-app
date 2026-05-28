# Corti Symphony BAA, HIPAA Compliance, and PHI Data Flow

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — What is the BAA process and data processing agreement structure for using Corti Symphony in a US hospital context? Does Corti's HIPAA-compliant sovereign cloud deployment allow the clinical note to stay on-premise, or does PHI have to leave the hospital environment?

### Finding 1: Corti is HIPAA-compliant and a Business Associate, but BAA is not self-serve

- Corti publicly states HIPAA compliance across its product line, including Symphony for Medical Coding: "HIPAA and GDPR compliant infrastructure, with guardrails, compliance, and clinical-grade reliability built into every layer of Symphony."
  — [Corti: Symphony page](https://www.corti.ai/symphony); [Corti: AI Medical Coding API](https://www.corti.ai/medical-coding)
- Corti holds SOC 2, ISO 27001, ISO 27017, ISO 27018, ISO 13485, ISO 42001, HIPAA, GDPR, FedRAMP, and NIS2 certifications — a comprehensive set that covers US federal healthcare compliance.
  — [Corti Safety page](https://www.corti.ai/safety)
- Corti has a US legal entity (Corti America Inc.) that certifies compliance with EU-U.S. DPF and Swiss-U.S. DPF frameworks, indicating HIPAA coverage for US data subjects.
  — [Corti Privacy Policy](https://www.corti.ai/legal/privacy-policy)
- **No publicly downloadable BAA template exists on Corti's website.** Unlike OpenAI (Azure API) or AWS (Bedrock), Corti does not offer a self-serve BAA click-through. A BAA must be negotiated as part of enterprise procurement, reachable via `privacy@corti.ai` or the enterprise sales team.
  — [Corti Safety page](https://www.corti.ai/safety); **Weakly sourced** — absence of public BAA template confirmed by site inspection; BAA availability via enterprise channel is inferred from standard industry practice for HIPAA-compliant vendors.

### Finding 2: Sovereign cloud and on-premise deployment options exist, but are enterprise-tier — PHI can stay within hospital or in-country infrastructure

- Corti offers **three deployment tiers**: (a) standard cloud API (Azure-hosted, multi-tenant), (b) sovereign cloud (dedicated in-country/in-region hosted deployment), and (c) on-premises (hospital or provider data center).
  — [Corti: Sovereign Cloud Hosting for Healthcare](https://www.corti.ai/sovereign-cloud); [Corti Pricing](https://www.corti.ai/pricing)
- The sovereign cloud capability was first demonstrated as "Europe's first sovereign healthcare AI infrastructure" in partnership with Voicepoint, deploying Corti into a Swiss data center where "every byte of PHI lives and dies on Swiss soil. No data detours."
  — [Corti: Pioneers Europe's First Sovereign Healthcare AI Infrastructure](https://www.corti.ai/news/corti-pioneers-europes-first-sovereign-healthcare-ai-infrastructure); [ICT&Health: Corti sovereign cloud](https://www.icthealth.org/news/corti-launches-first-european-sovereign-healthcare-ai-infrastructure)
- A **self-hosted / on-premise option** for hospital data centers entered **limited preview** as of Summer 2025: "deploy on secure hosted or sovereign cloud deployments" is listed as an enterprise tier feature. The platform is described as able to run "on any cloud or on-prem, with no vendor lock-in. Azure today, a local colo tomorrow, full on-prem next year."
  — [Corti: Getting beyond the firewall](https://www.corti.ai/stories/getting-beyond-the-firewall-by-building-clinical-ai-for-sovereign-systems); [Corti Pricing](https://www.corti.ai/pricing)
- **Standard API tier (pay-as-you-go / acceleration pack):** PHI leaves the hospital and is processed on Corti's Azure-hosted multi-tenant infrastructure. Data hosting options include "EU or US with no cross-border transfer." A BAA is still required, but clinical notes physically transit Corti's cloud infrastructure.
  — [Corti Safety page](https://www.corti.ai/safety)
- **Enterprise sovereign/on-premise tier:** PHI can stay within hospital perimeter or a hospital-designated data center. This eliminates cross-boundary PHI transit but requires enterprise contract negotiation.
  — [Corti Pricing](https://www.corti.ai/pricing)

### Finding 3: The standard API path for cliqueue (PHI to Corti cloud) is HIPAA-legal with a BAA — it does not uniquely require on-premise deployment

- Under HHS guidance, a covered entity or business associate **may** use a cloud service to store or process ePHI, provided a HIPAA-compliant BAA is in place. There is no HIPAA requirement that PHI must remain on-premise — only that the cloud vendor is a signed Business Associate with appropriate safeguards.
  — [HHS: HIPAA Cloud Computing Guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html); [HHS FAQ 2075](https://www.hhs.gov/hipaa/for-professionals/faq/2075/may-a-hipaa-covered-entity-or-business-associate-use-cloud-service-to-store-or-process-ephi/index.html)
- The critical requirement is that cliqueue's hospital customer must **execute a BAA with Corti before any PHI is transmitted to the Symphony API.** Without a signed BAA, every API call is a HIPAA violation.
  — [HHS: Business Associates](https://www.hhs.gov/hipaa/for-professionals/faq/business-associates/index.html)
- Corti holds HIPAA certification and has US data residency options (no cross-border transfer), satisfying the technical safeguard baseline for most hospital legal teams when combined with a BAA.
  — [Corti Safety page](https://www.corti.ai/safety)

### Finding 4: The 2026 HIPAA Security Rule NPRM adds annual BA verification requirements — design implication for cliqueue

- HHS published a Notice of Proposed Rulemaking on January 6, 2025 proposing the most significant HIPAA Security Rule changes since 2013. A final rule is expected Summer 2026.
  — [HIPAA Journal: HIPAA Updates 2026](https://www.hipaajournal.com/hipaa-updates-hipaa-changes/)
- Proposed changes include: mandatory annual verification that business associates (i.e., Corti) have deployed required technical safeguards, documented in writing by a subject-matter expert. This adds an ongoing audit obligation on top of the one-time BAA signature.
  — [Medcurity: HIPAA BAA 2026 update](https://medcurity.com/hipaa-business-associate-agreement-requirements/)
- For cliqueue, this means the hospital's compliance workflow must include annual Corti BAA review — this is an operational overhead that the on-chain attestation layer cannot replace but should record (e.g., emit a `BAAReviewCompleted` event annually).
  — **Design implication derived from regulatory analysis**

### Finding 5: Corti's standard API data flow architecture confirmed — PHI flows over TLS to Azure-hosted Corti infrastructure

- The standard integration path (as documented in the developer guide) is: hospital system → HTTPS POST with clinical note → Corti cloud API → structured ICD-10 codes response. Data is hosted on Azure with a choice of EU or US region.
  — [Corti: Developer's Guide to Integrating Medical Coding](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities); [Corti: Help — Security by Design](https://help.corti.app/en/articles/10032910-security-by-design)
- Azure infrastructure is certified to ISO/IEC 27001 and subject to regular independent audits. Corti specifies data is stored "within our specified geographical region" with replication within-region only.
  — [Corti: Help — Security by Design](https://help.corti.app/en/articles/10032910-security-by-design)
- Encryption: FIPS-compliant AES at rest, TLS 1.2+ in transit (confirmed on Safety page). This meets HIPAA Technical Safeguard requirements.
  — [Corti Safety page](https://www.corti.ai/safety)

### Summary: PHI data flow options for cliqueue

| Deployment tier | PHI leaves hospital? | BAA required? | Additional cost | Production-ready (May 2026)? |
|---|---|---|---|---|
| Standard cloud API (pay-as-you-go) | Yes — to Corti's Azure US region | Yes — via enterprise procurement | Pay-per-credit | Yes |
| Sovereign cloud (hosted) | Yes — to Corti's dedicated in-region cloud | Yes — via enterprise contract | Custom pricing | Yes (EU demonstrated; US: inferred from US data residency option) |
| On-premise / self-hosted | No — stays in hospital data center | BAA still recommended for integration | Custom/enterprise | Limited preview as of Summer 2025; production status unclear |

**Design implication:** For cliqueue's MVP and initial hospital deployments, the **standard cloud API path is legally viable under HIPAA** provided the hospital signs a BAA with Corti before any clinical notes are transmitted. On-premise deployment is available for hospitals with strict data-perimeter requirements but requires an enterprise contract negotiation and is not self-serve. The two-tier pipeline (Corti Symphony → HMAC hash → Somnia) remains architecturally sound: PHI is processed within Corti's HIPAA-compliant cloud, only the code hash and payment amount reach Somnia. The critical pre-launch task for cliqueue is establishing a standard BAA template with Corti (via `privacy@corti.ai`) that can be executed by hospital procurement teams as part of onboarding. This is a sales/legal process, not a technical blocker.

**Open questions generated:**
1. Does Corti's on-premise/self-hosted tier (limited preview as of Summer 2025) include the full Symphony medical coding model, or only the speech/real-time clinical capture capabilities? If coding is cloud-only, on-premise deployment cannot satisfy hospitals with a strict data-perimeter policy.
2. What is Corti's standard BAA turnaround time for enterprise procurement — days or weeks? For hospital systems with multi-vendor approval committees, BAA negotiation can take 3–6 months; cliqueue needs a standard form BAA pre-negotiated rather than negotiated per customer.
3. Under the proposed 2026 HIPAA Security Rule final rule, does the annual business associate verification requirement apply to API-based AI vendors like Corti the same as it does to data storage vendors? If so, cliqueue's hospital onboarding workflow needs an annual compliance checkpoint built into the contract lifecycle.

---

**See also** — [[../topics/corti|Corti hub]] · [[../topics/hipaa|HIPAA hub]]

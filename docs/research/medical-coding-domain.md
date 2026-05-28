# Medical Coding Domain Background

Reference document for anyone building on CliQueue who needs to understand how medical
coding actually works. This explains the full lifecycle from patient visit to payment,
why coding matters, and what makes it hard.

---

## The Coding Lifecycle

### 1. Patient Visit

A patient goes to a doctor, hospital, or clinic. The provider documents everything:
- Symptoms
- Diagnoses
- Procedures performed
- Medications or treatments

This documentation is the foundation of coding. If it's unclear or incomplete, coding gets
messy fast. This is a root cause of many coding errors — not the coder, but the note.

### 2. Codes Are Assigned

A medical coder reviews the documentation and assigns standardized codes from three
major coding systems:

**ICD-10-CM** — Diagnoses (what's wrong with the patient)
- ~72,000 codes, updated annually by CMS on October 1
- Example: `J18.9` = Pneumonia, unspecified; `I21.01` = ST elevation MI of LAD
- Hierarchical: Chapter → Block → Category → Code (up to 7 characters)
- Specificity is mandatory — laterality (left/right), encounter type (initial/subsequent),
  and 7th character extensions all affect which code is correct and how much is reimbursed

**CPT (Current Procedural Terminology)** — Procedures and services (what was done)
- ~10,000 codes, updated annually by AMA on January 1
- Example: `99213` = Office visit, established patient, moderate complexity
- Bundling/unbundling rules (Correct Coding Initiative edits) are complex — some procedure
  codes cannot be billed together; others must be

**HCPCS Level II** — Supplies, equipment, some services not in CPT
- ~7,000 codes, updated quarterly
- Example: codes for wheelchairs, ambulance transport, prosthetics, specific drug doses

**A single patient encounter typically requires 5–20 codes** across all three sets.
A coders's job is to match the documentation exactly — not too vague, not too specific
(which is called "upcoding" and constitutes fraud).

### 3. Codes Are Verified

Before billing, codes are reviewed to confirm:
- They are supported by the documentation (the "documentation supports the code" rule)
- They follow payer-specific rules and guidelines
- They are not duplicated or conflicting
- They are sequenced correctly (principal diagnosis must be listed first)

**Wrong sequencing changes reimbursement.** The order of ICD-10 codes is not arbitrary.

Mistakes at this step cause:
- Claim denials (the payer refuses to pay)
- Delayed reimbursement (revenue cycle impact)
- Audits (payers and CMS audit claims for patterns)
- Legal exposure (systematic upcoding = fraud)

### 4. Claim Is Created and Submitted

The coded data is formatted into a claim (EDI 837P for professional claims, 837I for
institutional claims) and sent to the payer (insurance company, Medicare, Medicaid).

The payer uses the codes to determine:
- Is this medically necessary?
- Is it covered under this patient's plan?
- How much should be reimbursed?

### 5. Payment or Denial

The payer responds:
- **Full payment** — codes accepted, reimbursement issued
- **Partial payment** — some codes accepted, others adjusted or denied
- **Denial** — claim rejected; coders/billers must investigate, correct, and resubmit

Denied claims are expensive. They require rework time, delay revenue, and may time out
(most payers have a timely filing limit — typically 90–365 days from the date of service).

The **3-month submission window** (approximately 90 days from patient visit) is a hard
operational constraint. Delays cost hospitals real revenue.

### 6. Data Beyond Billing

Coded data flows beyond billing into:
- Hospital analytics and quality reporting
- Public health surveillance (CDC, WHO use ICD codes)
- Clinical research and drug trials
- CMS quality programs (value-based care metrics)

This secondary use makes coding accuracy a public health issue, not just a billing one.

---

## Why Coding Is Hard

### Volume and Specificity

ICD-10-CM alone has ~72,000 codes. CPT adds ~10,000. HCPCS adds ~7,000. A coder must
navigate this space accurately, quickly, and under time pressure.

### Clinical Language Variation

Doctors write notes in varied, informal, and abbreviated language. "Widow maker" is not
a code. "STEMI" is not a code. A coder must map informal clinical language to the precise
official terminology that a code requires — often without asking the doctor for
clarification.

### Sequencing Rules

ICD-10 has mandatory sequencing rules: the principal diagnosis (the condition primarily
responsible for the admission) must be sequenced first, followed by secondary diagnoses,
complications, comorbidities, and status codes. Wrong order = wrong reimbursement.

### Annual Updates

CMS updates ICD-10-CM every October 1. CPT updates every January 1. HCPCS updates
quarterly. Coders must stay current with additions, deletions, and description changes.
Missing an update can mean using an invalid code, which triggers a denial.

### Overcoding vs Undercoding

- **Undercoding:** Using a less specific code than the documentation supports. Results in
  lower reimbursement — the hospital leaves money on the table.
- **Overcoding/Upcoding:** Using a higher-value code than the documentation supports.
  This is fraud. Penalties include fines, exclusion from Medicare/Medicaid, and criminal
  liability. Systems must never nudge coders toward higher codes.

### The Documentation Gap

Many coding errors originate in the physician's note, not the coder's judgment. If the
note says "infection" without specifying the site or organism, the coder cannot assign a
specific code — they must use an unspecified code, which reimburses less. Better tooling
could flag these gaps back to providers in real time.

---

## Key Terms for Developers

| Term | Meaning |
|------|---------|
| **Principal diagnosis** | The condition primarily responsible for the inpatient admission, sequenced first |
| **Secondary diagnosis** | Additional conditions that affect care or require monitoring |
| **CC / MCC** | Complication or Comorbidity / Major CC — affect DRG payment tier |
| **DRG** | Diagnosis Related Group — the bundled inpatient payment category determined by code set |
| **E/M code** | Evaluation and Management CPT code — office visits, consultations |
| **CCI edits** | Correct Coding Initiative — CMS rules about which CPT codes can/cannot be billed together |
| **Upcoding** | Assigning a higher-reimbursing code than the documentation supports — fraud |
| **Query** | A formal question from a coder to a physician asking for clarification on documentation |
| **837P / 837I** | EDI transaction format for professional (P) and institutional (I) claims |
| **EOB** | Explanation of Benefits — payer's response to a claim |
| **RAC** | Recovery Audit Contractor — CMS auditors who review claims for overpayments |

---

## Scale Reference

- ~10 million coded documents / insurance claims processed per day in the US
- ~72,000 ICD-10-CM codes, ~10,000 CPT codes, ~7,000 HCPCS codes
- Annual CMS ICD-10 update: October 1 each year
- Annual CPT update: January 1 each year
- Typical claim submission window: 90–365 days from date of service
- Inpatient DRG payments are driven primarily by the principal diagnosis and presence of CC/MCC codes

---

**See also** — [[topics/corti|Corti hub]] (AI coding agent) · [[topics/sbt|SBT hub]] (credentialed human attestor) · [[topics/x12|X12 hub]] (claim transactions) · [[topics/prior-auth|PA hub]] (prior authorization) · [[topics/README|topic-hub index]]

# Improbable / Somnia Chain Operator BAA Analysis

Research findings for cliqueue-coding-blockchain. Investigates whether Improbable (Somnia chain operator) is a HIPAA Business Associate, whether a BAA is required before hospitals anchor claim-derived hashes on Somnia mainnet, and what the correct legal architecture is.

---

## 2026-05-17 — Improbable/Somnia is not a HIPAA BA if PHI never enters the chain; conduit exception does NOT apply to blockchain validators; BAA obligation falls entirely on off-chain vendors

**Question investigated:** What BAA structure does a hospital's counsel require with Improbable (Somnia chain operator) before anchoring claim-derived hashes on Somnia mainnet — and is Improbable a HIPAA Business Associate under 45 CFR 160.103?

### Finding 1 — Improbable publishes no HIPAA BAA and is not positioned as a healthcare vendor

- Somnia's public website (`somnia.network`) includes generic Privacy Policy and Terms of Service links but no HIPAA compliance documentation, BAA offering, or healthcare-specific terms. No reference to Improbable or Somnia offering healthcare BAAs appears in any 2025–2026 publication. ([Somnia Network](https://www.somnia.network))
- This is structurally identical to the Ethereum Foundation, Polygon Labs, or Consensys — no public permissionless L1 operator has published a HIPAA BAA for chain-level use by hospitals. The decentralized validator set of any public chain has no identifiable contract counterparty capable of executing a BAA. ([HIPAA University 2026](https://hipaauniversity.com/blog/blockchain-in-healthcare/))

### Finding 2 — Business Associate test: functional, not structural

- Under 45 CFR 160.103, a "business associate" is a person/entity that creates, receives, maintains, or transmits PHI **on behalf of** a covered entity or another BA. The key question is not whether Improbable *runs* the chain, but whether it ever *handles PHI* in that role. ([HHS BA definition, 45 CFR 160.103](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160#p-160.103))
- If cliqueue's architecture ensures Somnia only receives HMAC claim hashes, `paStatus` bytes, settlement amounts, and state flags — with no PHI content or PHI-reversible data — then Improbable never creates, receives, maintains, or transmits PHI. BA status is therefore not triggered. ([HHS Business Associates guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html))

### Finding 3 — The HIPAA conduit exception does NOT cover blockchain validators

- The conduit exception (45 CFR 160.103) exempts entities that provide "transmission only" services with only "transient" storage incident to transmission (examples: USPS, UPS, ISPs). ([Holland & Hart: HIPAA Business Associates and the Conduit Exception](https://www.hollandhart.com/hipaa-business-associates-and-the-conduit-exception))
- HHS has stated explicitly: **"an entity that maintains protected health information on behalf of a covered entity is a business associate and not a conduit, even if the entity does not actually view the protected health information."** The test is **transient vs. persistent access**, not readability. ([HHS FAQ 2077 on CSPs and conduit status](https://www.hhs.gov/hipaa/for-professionals/faq/2077/can-a-csp-be-considered-to-be-a-conduit-like-the-postal-service-and-therefore-not-a-business%20associate-that-must-comply-with-the-hipaa-rules/index.html))
- Blockchain validators **persistently replicate and maintain ledger data** across the network — the opposite of transient transmission. Even if on-chain data is an unreadable HMAC hash, the persistent-maintenance criterion would preclude conduit status if PHI-derived data were on-chain. This is a second reason to ensure no PHI-derived data ever reaches the chain.
- No healthcare law firm has published analysis specifically applying the conduit exception to public blockchain validators. The absence of such analysis cuts toward the conservative position: assume conduit exception does not apply. ([Accountable HQ: Conduit Exception Explained](https://www.accountablehq.com/post/hipaa-conduit-exception-explained-what-counts-as-a-conduit-vs-a-business-associate))

### Finding 4 — Correct architecture: PHI-free chain, BAA scoped to off-chain vendors only

- Healthcare attorney consensus (Holland & Hart, HIPAA University, HIPAA Vault, Compliancy Group): use public chains only for non-PHI artifacts; anchor only cryptographic proofs (hashes, commitments) while keeping PHI off-chain in HIPAA-aligned systems. ([HIPAA University: Blockchain in Healthcare 2026](https://hipaauniversity.com/blog/blockchain-in-healthcare/); [Holland & Hart](https://www.hollandhart.com/hipaa-business-associates-and-the-conduit-exception))
- This is precisely cliqueue's architecture: Somnia receives only `claimHash` (HMAC-SHA256 of 837 claim with key held in hospital HSM), `paStatus` byte, `paAuthHash` (keccak256 of PA auth number, salted), and `adjudicatedCents` — no PHI. The HMAC key never appears on-chain. This was established in prior research: [docs/research/regulatory/hipaa-blockchain-hash-anchoring.md](hipaa-blockchain-hash-anchoring.md).
- The BAA obligation stack for cliqueue is:
  1. **Hospital ↔ cliqueue BAA** — required; cliqueue processes PHI as a BA (runs off-chain coding agent, maintains EDI adapter with claim content).
  2. **cliqueue ↔ Corti BAA** — required; Corti Symphony receives clinical notes (PHI) to generate ICD-10 codes. Investigated: [docs/research/regulatory/corti-baa-procurement-timeline-sub-baa-chain.md](corti-baa-procurement-timeline-sub-baa-chain.md).
  3. **Hospital ↔ Improbable/Somnia BAA** — **NOT REQUIRED** under this architecture, because Somnia never receives PHI. No identifiable contract counterparty exists anyway for a public permissionless chain.

### Finding 5 — Public chain "BAA impossibility" as a secondary argument

- Even if a hospital's counsel insisted on a Somnia BAA, none is available — the Somnia validator set is a decentralized network with no single legal entity capable of signing and performing a BAA. This is the "BAA impossibility" problem documented for all public permissionless chains. ([HIPAA University 2026](https://hipaauniversity.com/blog/blockchain-in-healthcare/))
- The practical solution is what cliqueue already does: architect the system so the chain is a *de facto* conduit-equivalent by ensuring it never receives PHI-carrying data, not by attempting to execute a BAA.

### Finding 6 — Hospital procurement defense document requirement

- Hospital privacy officers and procurement teams will ask about this. The answer must be documented proactively. No OCR enforcement action has targeted hash-anchoring on a public chain as a HIPAA violation when the hash is HMAC-keyed and PHI-free. No HHS guidance specifically addresses public blockchain validators as BAs. The legal consensus supports the non-BA determination for chain operators when PHI never enters the chain.

**Design implication:** No BAA with Improbable/Somnia is required — and none is possible — under cliqueue's architecture, because Somnia only receives HMAC-keyed claim hashes and non-PHI settlement data. The full BAA obligation falls on the hospital↔cliqueue and cliqueue↔Corti sub-BA chain. cliqueue should publish a "Somnia Non-BA Determination Memo" in the hospital onboarding package — a one-page document citing 45 CFR 160.103 (BA definition), the HHS conduit FAQ, and cliqueue's on-chain data model — so hospital privacy officers have a documented legal defense without relying solely on cliqueue's self-assessment.

**Open questions generated:**
1. Should cliqueue's hospital BAA explicitly list Improbable/Somnia as a "non-BA infrastructure provider" in a Subprocessor Exhibit — distinguishing it from Corti (a named BA subprocessor) — so hospital privacy officers can close the Somnia question without a separate legal review?
2. Should the "Somnia Non-BA Determination Memo" be reviewed by outside HIPAA counsel before distribution to hospitals — given that the memo's conclusions directly affect the hospital's HIPAA compliance posture and no OCR enforcement precedent exists for blockchain hash anchoring?
3. If Improbable later adds a "healthcare validator service" tier (permissioned node with contractual commitments), does that create BA status and require cliqueue to either execute a BAA with Improbable or switch to a non-Improbable validator set?

---

**See also** — [[../topics/hipaa|HIPAA hub]] · [[../topics/corti|Corti hub]]

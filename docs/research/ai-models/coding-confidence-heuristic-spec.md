# CodingConfidenceHeuristic Specification — Routing Architecture for cliqueue

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should cliqueue define a formal `CodingConfidenceHeuristic` specification — a weighted scoring function over `evidences.length`, `alternatives.length`, and `inCandidatesArray` — and publish it as a testable TypeScript module in the off-chain agent spec?

### Finding 1: No published threshold standard exists for structural-signal-based routing — this is an integration responsibility that vendors deliberately leave uncalibrated

- No vendor (Fathom, AKASA, CodaMetrix, Nym Health) publishes its specific routing threshold values or calibration methodology externally. Fathom's production deployment at Your Health achieved 95.5% automation rate at 98.3% accuracy (October 2025), but the threshold that produces those figures is disclosed only to the deploying health system after a high-volume proof-of-concept phase — not published in documentation.
  — [Your Health / Fathom press release](https://finance.yahoo.com/sectors/healthcare/articles/health-deploys-fathom-autonomous-medical-140000178.html); [Fathom RISE National 2025](https://fathomhealth.com/insights/rise-national-2025-fathom-panel-on-autonomous-risk-adjustment-coding)
  — Assessment: High confidence. Absence of public threshold documentation confirmed across vendor sites.

- AKASA's Coding Optimizer does expose a "confidence level" per suggestion in its dashboard, but this is a product-layer display feature, not a raw numeric field in the API. The underlying threshold that triggers human routing is not publicly documented.
  — [AKASA Coding Optimizer](https://akasa.com/solutions/coding-optimizer/)
  — Assessment: High confidence. AKASA API is not documented publicly; confidence is surfaced only in the SaaS UI per prior research.

- Academic AI ICD-10 coding systems (e.g., JMIR 2024 Taiwan hospital study) use a fixed 0.5 probability threshold derived from model precision-recall optimization — not a structural-signal heuristic. The 0.5 value was not calibrated to the hospital's payer mix; all cases went through human CCS review regardless.
  — [JMIR 2024: AI-Assisted ICD-10 / DRG in Hospital Environment (e58278)](https://www.jmir.org/2024/1/e58278)
  — Assessment: High confidence. Study explicitly states all cases required human review; no autonomous routing was implemented.

- Industry consensus (BillingParadise 2025, RapidClaims 2026) frames routing threshold calibration as a deployment-time activity: "adjust confidence cutoffs, specificity prompts, and routing logic based on early findings." This is phased rollout practice, not a pre-defined threshold from the AI vendor.
  — [BillingParadise: AI + Human Hybrid Medical Coding Q3 2025](https://www.billingparadise.com/blog/medical-ai-coding-hybrid-model-q3-2025/)
  — Assessment: High confidence.

### Finding 2: Regulatory frameworks require documented, versioned decision logic — but do not specify the form of the routing specification

- ONC's HTI-1 Final Rule (effective January 1, 2025) requires developers of predictive Decision Support Interventions (predictive DSIs) to publish 31 source attributes covering: quantitative performance measures, development inputs, fairness assessment process, ongoing maintenance schedule, and update/validation cadence. The rule is not prescriptive about the format ("ONC was also not prescriptive as to how this information should be included within certified health IT").
  — [Mintz: HTI-1 Final Rule analysis](https://www.mintz.com/insights-center/viewpoints/2146/2024-01-08-hhs-onc-hti-1-final-rule-introduces-new-transparency); [ONC HTI-1 Final Rule](https://healthit.gov/regulations/hti-rules/hti-1-final-rule/)
  — Assessment: High confidence. HTI-1 applies to certified health IT developers; cliqueue as an off-chain agent layer is likely not a certified EHR developer, but the principle of documented, versioned decision logic applies by analogy.

- OIG's updated General Compliance Program Guidance (2025) warns that "automation without human supervision can spread errors faster than people can correct them" and that "the AI did it" is not a valid legal defense when an auditor questions a code assignment. An audit trail must document who reviewed, what AI version was used, and what action was taken.
  — [OIG Compliance in 2025 (Doctors Management)](https://www.doctorsmanagement.com/blog/oig-compliance-in-2025-whats-changing-and-how-your-practice-should-review/); [AI in Medical Auditing 2026 (NAMAS)](https://namas.co/ai-compliance-risk-medical-auditing-2026/)
  — Assessment: High confidence. OIG guidance applies to all CMS reimbursement claims regardless of whether the coder is human or AI-assisted.

- CMS's FY 2026 IPPS proposed rule (expected June 2025) was expected to clarify human oversight expectations for autonomous coding systems specifically — indicating that inpatient DRG autonomous coding faces additional CMS scrutiny beyond the existing OIG framework.
  — [Coding Network: Why Human Oversight Remains Essential 2025](https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/)
  — Assessment: Medium confidence. Expected rule; not yet confirmed as finalized at research date.

### Finding 3: A published, versioned, testable TypeScript heuristic module directly satisfies the OIG audit-trail and ONC transparency expectations — and is the defensible architecture for cliqueue

- The OIG audit-trail requirement (document which AI version was used, what action was taken) maps directly to a versioned TypeScript module: the module's SemVer tag becomes the auditable "AI routing version" logged alongside each claim submission. A non-module approach (inline threshold constants) would not produce a versioned audit artifact.
  — Cross-reference: [OIG Compliance 2025](https://www.doctorsmanagement.com/blog/oig-compliance-in-2025-whats-changing-and-how-your-practice-prepare/)
  — Assessment: High confidence architectural inference.

- The ONC HTI-1 "quantitative measures of performance" source attribute requirement implies that cliqueue must be able to state its routing threshold and the F1/precision/recall performance associated with that threshold. A TypeScript module with documented threshold constants (e.g., `MIN_EVIDENCES = 2`, `MAX_ALTERNATIVES = 3`) and exported calibration functions makes these values inspectable and testable — satisfying the spirit of the HTI-1 transparency requirement without requiring ONC certification.
  — Assessment: Architectural inference from HTI-1 source attribute list; medium confidence.

- Systems that expose confidence-like signals without calibration are identified in the XAI-CDSS literature as a trust risk: "Studies combining high predictive performance with strong explanation fidelity (≥0.85) reported clinician trust scores 12–18 percentage points higher than those without quantitative explanation evaluation."
  — [PMC: Explainable AI in Clinical Decision Support Systems (PMC12427955)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12427955/)
  — Assessment: Medium confidence. Finding is from explainability meta-analysis, not coding-specific; applicable by analogy.

### Finding 4: A calibration-required architecture (thresholds set per hospital before go-live) is more defensible than shipping uncalibrated defaults — but uncalibrated defaults with a mandatory calibration covenant are a viable MVP position

- Industry practice (BillingParadise, Fathom, RapidClaims) universally calls for a phased rollout: "run a high-volume proof of concept to validate performance before full deployment." Shipping hardcoded thresholds that route claims at a hospital without local validation exposes cliqueue to OIG False Claims Act liability if the thresholds produce incorrect routing at a given hospital's case mix.
  — [BillingParadise: Hybrid Coding Model](https://www.billingparadise.com/blog/medical-ai-coding-hybrid-model-q3-2025/); [Fathom RISE National 2025](https://fathomhealth.com/insights/rise-national-2025-fathom-panel-on-autonomous-risk-adjustment-coding)
  — Assessment: High confidence.

- A viable MVP architecture: ship the `CodingConfidenceHeuristic` module with documented default thresholds (`MIN_EVIDENCES = 2`, `MAX_ALTERNATIVES = 3`) and a `CALIBRATION_REQUIRED = true` flag in the hospital onboarding checklist that blocks go-live until the hospital's privacy officer and compliance team have reviewed and signed off on the threshold values. This creates a documented covenant without requiring cliqueue to conduct the calibration itself.
  — Assessment: Architectural synthesis from research findings; no direct citation.

- The False Claims Act risk from uncalibrated thresholds is asymmetric: routing too many claims to human review wastes coder time (recoverable); routing too few (over-automating) produces incorrect code submissions (FCA exposure). Default thresholds should be set conservatively (lower `MIN_EVIDENCES`, lower `MAX_ALTERNATIVES`) and hospitals should calibrate upward.
  — Assessment: High confidence analytical inference from OIG guidance.

### Recommended `CodingConfidenceHeuristic` module structure (design synthesis)

Based on the research, the following structure satisfies regulatory documentation expectations and is implementable against Symphony's structural signals:

```typescript
// @cliqueue/coding-confidence-heuristic v1.0.0
// Versioned TypeScript module — version is logged in claim audit trail

export interface ConfidenceSignals {
  evidences: number;          // evidences.length from Symphony code object
  alternatives: number;       // alternatives.length from Symphony code object
  inCandidates: boolean;      // true if code appeared in candidates[] not codes[]
}

export interface HeuristicConfig {
  // Conservative defaults — hospitals MUST review and calibrate before go-live
  MIN_EVIDENCES: number;      // default: 2 — codes with < this many evidence spans flag for review
  MAX_ALTERNATIVES: number;   // default: 3 — codes with >= this many alternatives flag for review
}

export const DEFAULT_CONFIG: HeuristicConfig = {
  MIN_EVIDENCES: 2,
  MAX_ALTERNATIVES: 3,
};

// Returns true if the code should be routed to human review
export function requiresHumanReview(
  signals: ConfidenceSignals,
  config: HeuristicConfig = DEFAULT_CONFIG
): boolean {
  if (signals.inCandidates) return true;           // hard gate: candidates always need human
  if (signals.evidences < config.MIN_EVIDENCES) return true;
  if (signals.alternatives >= config.MAX_ALTERNATIVES) return true;
  return false;
}
```

Note: The `claimType == INPATIENT` rule (AHIMA DRG reconciliation requirement) is a hard regulatory override that sits above this heuristic — inpatient claims always require human attestation regardless of heuristic output. This module governs outpatient claim routing only.

**Design implication:** cliqueue must publish `CodingConfidenceHeuristic` as a versioned, testable TypeScript module in the off-chain agent specification (not as inline constants). The module version must be logged in the off-chain claim audit record at submission time to satisfy OIG documentation requirements. Default thresholds should be conservative and hospitals must sign a calibration covenant before go-live. The `claimType == INPATIENT` hard override must be enforced upstream of this module and should not be configurable by the hospital.

**Open questions generated:**
1. Should the `CodingConfidenceHeuristic` module version be anchored on-chain (e.g., as a `bytes32 heuristicVersion` field in the `ClaimSubmitted` event) — creating a permanent audit record of which routing version was used for each claim, inspectable by OIG auditors without accessing off-chain systems?
2. Is there a published calibration dataset (labeled confidence vs. human-override frequency) for Symphony codes that would let cliqueue validate whether `evidences < 2` or `alternatives >= 3` actually correlates with human coder disagreement rates — or must cliqueue conduct its own validation study with a pilot hospital before publishing default thresholds?
3. Should cliqueue's hospital BAA include a Calibration Attestation Exhibit — a signed document stating the hospital's chosen `MIN_EVIDENCES` and `MAX_ALTERNATIVES` values and the validation study it conducted before setting those values — to document that cliqueue is not the party that chose the routing threshold for that hospital's claim mix?

---

**See also** — [[../topics/corti|Corti hub]]

// ─── Curie sample data — spec-accurate necessity-arbiter model ─────────
// SPEC-0001..0004. The agent rules approve | deny | need_more_evidence and
// CITES a policy clause. The covered amount is deterministic:
//   covered = min(requested, CostPlusCap);  NADAC is the floor reference.
// Appeals submit MORE public evidence (never price haggling).

/* ── States (contract enum) ─────────────────────────────────────────── */
const STATES = {
  Open:              { label: "Open",                color: "var(--state-open)",      step: 0, desc: "Filed — awaiting the insurer's policy" },
  Ready:             { label: "Policy attached",      color: "var(--state-ready)",     step: 1, desc: "Policy attached — ready for AI arbitration" },
  UnderReview:       { label: "AI reviewing",         color: "var(--state-review)",    step: 2, desc: "The necessity arbiter is ruling on this round" },
  EvidenceRequested: { label: "More evidence needed", color: "var(--state-evidence)",  step: 2, desc: "Arbiter needs more public evidence to rule" },
  Approved:          { label: "Approved",             color: "var(--state-approved)",  step: 3, desc: "Ruled in favour — awaiting both-party accept" },
  Denied:            { label: "Denied",               color: "var(--state-denied)",    step: 3, desc: "Ruled not medically necessary — covered $0" },
  Settled:           { label: "Settled",              color: "var(--state-settled)",   step: 4, desc: "Both accepted — settlement marker on chain" },
  Deadlocked:        { label: "Deadlocked",           color: "var(--state-deadlock)",  step: 4, desc: "Round bound reached without agreement" },
  PolicyInvalidated: { label: "Policy voided",        color: "var(--state-policy)",    step: 3, desc: "Relied-on clause contradicts a public standard" },
  ProviderRefused:   { label: "Provider refused",     color: "var(--state-refused)",   step: 4, desc: "Provider rejected the insurer's terms" },
  Withdrawn:         { label: "Withdrawn",            color: "var(--state-withdrawn)", step: 4, desc: "Provider withdrew the request" },
};

/* progress stepper labels (the 5 milestones a request walks) */
const FLOW_STEPS = ["Filed", "Policy attached", "AI reviewing", "Decision", "Complete"];

/* ── AI decisions ───────────────────────────────────────────────────── */
const DECISIONS = {
  approve:            { label: "Approve",            color: "var(--state-approved)" },
  deny:               { label: "Deny",               color: "var(--state-denied)" },
  need_more_evidence: { label: "Need more evidence",  color: "var(--state-evidence)" },
  policy_invalid:     { label: "Policy invalidated",  color: "var(--state-policy)" },
};

/* ── Appeal ladder (SPEC-0004 §2.4 R15) — stage names per payer line ── */
const LADDERS = {
  PartD: [
    { name: "Initial Determination",     desc: "Plan coverage decision",            window: null,       threshold: null },
    { name: "Redetermination",            desc: "Plan-level reconsideration",        window: "60 days",  threshold: null },
    { name: "IRE Reconsideration",        desc: "Independent Review Entity",         window: "60 days",  threshold: null },
    { name: "ALJ / OMHA Hearing",         desc: "Administrative Law Judge",          window: "60 days",  threshold: "$200 in controversy" },
    { name: "Medicare Appeals Council",   desc: "Federal review · out of scope v0",  window: null,       threshold: null },
  ],
  Commercial: [
    { name: "Initial Determination",      desc: "Payer coverage decision",           window: null,       threshold: null },
    { name: "Internal Appeal",            desc: "Payer-level reconsideration",       window: "180 days", threshold: null },
    { name: "External Review",            desc: "Independent external reviewer",     window: "4 months", threshold: null },
  ],
  Medicaid: [
    { name: "Initial Determination",      desc: "MCO coverage decision",             window: null,       threshold: null },
    { name: "Plan Internal Appeal",       desc: "Managed-care plan appeal",          window: "60 days",  threshold: null },
    { name: "External Medical Review / State Fair Hearing", desc: "External + state path", window: "120 days", threshold: null },
  ],
};
function stageOf(payerLine, round) {
  const ladder = LADDERS[payerLine] || LADDERS.PartD;
  return ladder[Math.min(round, ladder.length - 1)] || ladder[0];
}

/* ── Wallets / profiles ─────────────────────────────────────────────── */
const PROFILES = {
  provider: { label: "Provider",  sub: "files coverage-exception requests",     party: 1,  org: "St. Mary's Health",     address: "0x5c2f6e3b…965D", balance: 2.9805 },
  insurer:  { label: "Insurer",   sub: "attaches policy & adjudicates",          party: 2,  org: "Meridian Health Plan",  address: "0x8c1f3a91…7e2A", balance: 4.1620 },
  observer: { label: "Observer",  sub: "read-only — every action disabled",      party: 99, org: "Auditor (read-only)",   address: "0x3aD1c0e7…0b4C", balance: 0.0000 },
};

const AGENT_FEE = 0.33;     // STT escrowed to the arbiter agent per adjudication
const GAS_TYPICAL = 0.00041; // STT typical gas burn

/* ── Requests ───────────────────────────────────────────────────────── */
// covered === null until ruled. covered = min(requested, costPlusCap) on approve.
const REQUESTS = [
  {
    id: 8,
    drug: "Adalimumab", brand: "Humira", rxnorm: "RxNorm 1366724", ndc: "NDC 00074-3799-02",
    quantity: 2, daysSupply: 28,
    drugRef: "0x38ae9b7c…d8de", justificationHash: "0x16f04a92…6b55",
    payerLine: "Commercial", appealRound: 0,
    requested: 5200, costPlusCap: 4400, nadacFloor: 4180,
    covered: null, state: "UnderReview", round: 1, maxRounds: 3,
    policy: { attached: true, name: "Specialty Biologics 2026", id: "MHP-SPC-2026-014", hash: "0x7c14a0…aa01", clause: "§4.2 — biologic after documented inadequate response to a conventional DMARD", compliant: true },
    decision: null,
    provider: { party: 1, address: "0x5c2f6e3b…965D", label: "St. Mary's Health" },
    insurer:  { party: 2, address: "0x8c1f3a91…7e2A", label: "Meridian Health Plan" },
    fileTs: Date.now() - 1000 * 60 * 18,
    evidence: [
      { idx: 0, source: "FDA label", label: "openFDA · HUMIRA indications", url: "api.fda.gov/drug/label.json?search=HUMIRA", hash: "0x9a11…2f0c", slice: "Indicated for moderate-to-severe chronic plaque psoriasis in adults who are candidates for systemic therapy." },
      { idx: 1, source: "Part D formulary 2026-03", label: "Formulary tier · PA / ST flags", url: "cms.gov/formulary/2026-03", hash: "0x4b77…1d9e", slice: "Tier 5 specialty · prior-authorization + step-therapy required." },
      { idx: 2, source: "AAD guideline", label: "Plaque psoriasis · biologics", url: "aad.org/guidelines/psoriasis-biologics", hash: "0xc2d8…77a3", slice: "Biologic therapy recommended after inadequate response or intolerance to methotrexate." },
      { idx: 3, source: "NADAC 2026-05-14", label: "Acquisition-cost floor", url: "data.medicaid.gov/nadac", hash: "0x71ac…5e02", slice: "$2,090.00 / unit (floor reference)." },
    ],
    events: [
      { kind: "Filed",                actor: "provider", note: "Filed — provider 1 → insurer 2, requested $5,200", ts: -18, tx: "0x38ae…d8de", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "ContentCommitted",     actor: "provider", note: "justificationHash 0x16f0…6b55 committed (body off-chain)", ts: -18, tx: "0x16f0…6b55", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "InsurerEngaged",       actor: "insurer",  note: "Attached 'Specialty Biologics 2026' policy", ts: -12, tx: "0x7c14…aa01", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "AdjudicationRequested",actor: "provider", note: "Fired arbiter agent-7B · packet root 0x2c…", ts: -2, tx: "0x91be…3a02", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
    ],
  },
  {
    id: 7,
    drug: "Etanercept", brand: "Enbrel", rxnorm: "RxNorm 253014", ndc: "NDC 58406-435-04",
    quantity: 4, daysSupply: 28,
    drugRef: "0x55c2f1a8…91b0", justificationHash: "0x2ad9c4…8e71",
    payerLine: "Commercial", appealRound: 0,
    requested: 4200, costPlusCap: 3800, nadacFloor: 3610,
    covered: 3800, state: "Approved", round: 1, maxRounds: 3,
    policy: { attached: true, name: "Specialty Biologics 2026", id: "MHP-SPC-2026-014", hash: "0x7c14a0…aa01", clause: "§4.2 — biologic after documented inadequate response to a conventional DMARD", compliant: true },
    decision: "approve",
    rationale: "Approved at $3,800 — the FDA label cites moderate-to-severe RA as an indication and the cited AAD/ACR guideline supports a biologic after MTX failure. Covered is capped at the Mark Cuban Cost Plus retail benchmark ($3,800); the requested $4,200 exceeds it.",
    citedClause: "§4.2", citedRefs: [0, 2], receiptId: "rcpt-7B-0c41", reasoningHash: "0x9b2c…cf01",
    provider: { party: 1, address: "0x5c2f6e3b…965D", label: "St. Mary's Health" },
    insurer:  { party: 2, address: "0x8c1f3a91…7e2A", label: "Meridian Health Plan" },
    fileTs: Date.now() - 1000 * 60 * 60 * 3,
    evidence: [
      { idx: 0, source: "FDA label", label: "openFDA · ENBREL indications", url: "api.fda.gov/drug/label.json?search=ENBREL", hash: "0x3f9a…b201", slice: "Indicated for reducing signs and symptoms of moderately to severely active rheumatoid arthritis." },
      { idx: 1, source: "Part D formulary 2026-03", label: "Formulary tier", url: "cms.gov/formulary/2026-03", hash: "0x4b77…1d9e", slice: "Tier 5 specialty · prior-authorization required." },
      { idx: 2, source: "ACR guideline", label: "RA · DMARD sequencing", url: "rheumatology.org/ra-guideline", hash: "0x8c0e…44aa", slice: "TNF inhibitor recommended after inadequate response to methotrexate." },
      { idx: 3, source: "NADAC 2026-05-14", label: "Acquisition-cost floor", url: "data.medicaid.gov/nadac", hash: "0x71ac…5e02", slice: "$902.50 / unit (floor reference)." },
    ],
    events: [
      { kind: "Filed",                actor: "provider", note: "Filed — requested $4,200", ts: -180, tx: "0x55c2…91b0", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "InsurerEngaged",       actor: "insurer",  note: "Attached 'Specialty Biologics 2026' policy", ts: -172, tx: "0x7c14…aa01", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "AdjudicationRequested",actor: "provider", note: "Fired arbiter agent-7B", ts: -160, tx: "0x4d10…7c33", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
      { kind: "Ruled",                actor: "arbiter",  note: "Approve · covered $3,800 (capped at Cost Plus) · cites §4.2", ts: -159, tx: "0x9b2c…cf01", cost: null, value: null, attr: "On-chain ruling" },
    ],
  },
  {
    id: 6,
    drug: "Atorvastatin", brand: "(generic)", rxnorm: "RxNorm 617312", ndc: "NDC 00093-7310-98",
    quantity: 90, daysSupply: 90,
    drugRef: "0x9c1be4d2…42a1", justificationHash: "0xa8b1d0…fe22",
    payerLine: "PartD", appealRound: 0,
    requested: 320, costPlusCap: 22, nadacFloor: 18,
    covered: 22, state: "Settled", round: 1, maxRounds: 3,
    policy: { attached: true, name: "Generic Outpatient Base 2026", id: "MHP-GEN-2026-002", hash: "0x2b90…cc18", clause: "§1.1 — Tier-1 generic, no exception required", compliant: true },
    decision: "approve",
    rationale: "Approved at $22 — atorvastatin is a Tier-1 generic with a standard indication. Covered is capped at the Cost Plus retail benchmark ($22); the requested $320 is far above it. NADAC floor $18 confirms the benchmark is reasonable.",
    citedClause: "§1.1", citedRefs: [0, 2], receiptId: "rcpt-7B-09ab", reasoningHash: "0x55fa…1029",
    provider: { party: 1, address: "0x5c2f6e3b…965D", label: "St. Mary's Health" },
    insurer:  { party: 2, address: "0x8c1f3a91…7e2A", label: "Meridian Health Plan" },
    fileTs: Date.now() - 1000 * 60 * 60 * 5,
    evidence: [
      { idx: 0, source: "FDA label", label: "openFDA · atorvastatin", url: "api.fda.gov/drug/label.json?search=atorvastatin", hash: "0x10ab…7c2d", slice: "Indicated to reduce the risk of cardiovascular events and as adjunct for hyperlipidemia." },
      { idx: 1, source: "Part D formulary 2026-03", label: "Tier 1 generic", url: "cms.gov/formulary/2026-03", hash: "0x4b77…1d9e", slice: "Tier 1 · no prior-authorization." },
      { idx: 2, source: "Cost Plus 2026-05", label: "Retail benchmark cap", url: "costplusdrugs.com/atorvastatin", hash: "0x6f01…b9c4", slice: "$0.24 / tablet retail → $22 / 90-day cap." },
    ],
    events: [
      { kind: "Filed",                actor: "provider", note: "Maintenance refill — requested $320", ts: -300, tx: "0x9c1b…42a1", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "InsurerEngaged",       actor: "insurer",  note: "Attached 'Generic Outpatient Base 2026'", ts: -298, tx: "0x2b90…cc18", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "AdjudicationRequested",actor: "provider", note: "Fired arbiter agent-7B", ts: -295, tx: "0x8801…2a7f", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
      { kind: "Ruled",                actor: "arbiter",  note: "Approve · covered $22 (capped) · cites §1.1", ts: -294, tx: "0x55fa…1029", cost: null, value: null, attr: "On-chain ruling" },
      { kind: "Accepted",             actor: "provider", note: "Provider accepted the ruling", ts: -293, tx: "0x4410…77c1", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "Accepted",             actor: "insurer",  note: "Insurer accepted the ruling", ts: -293, tx: "0x4419…88d2", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "Settled",              actor: "system",   note: "Settled · covered $22 · fee split 50/50 (marker)", ts: -293, tx: "0x90aa…ee31", cost: GAS_TYPICAL, value: null, attr: "Inbound (settlement marker)" },
    ],
  },
  {
    id: 5,
    drug: "Tirzepatide", brand: "Mounjaro", rxnorm: "RxNorm 2601723", ndc: "NDC 00002-1506-80",
    quantity: 4, daysSupply: 28,
    drugRef: "0x71d8a3c4…9911", justificationHash: "0x431f88…0aa9",
    payerLine: "PartD", appealRound: 1,
    requested: 1480, costPlusCap: 1240, nadacFloor: 980,
    covered: null, state: "EvidenceRequested", round: 2, maxRounds: 3,
    policy: { attached: true, name: "Step-Therapy — Metabolic 2026", id: "MHP-MET-2026-007", hash: "0x3c41…90af", clause: "§3.4 — requires documented metformin trial or contraindication before incretin therapy", compliant: true },
    decision: "need_more_evidence",
    rationale: "Need more evidence — the cited policy clause §3.4 requires a documented metformin trial or contraindication. The current packet establishes a T2DM diagnosis but does not include the metformin-intolerance documentation referenced in the justification. Submit the labs / chart note as a public-hash reference to proceed.",
    citedClause: "§3.4", citedRefs: [1], receiptId: "rcpt-7B-1144", reasoningHash: "0xab90…7d31",
    provider: { party: 1, address: "0x5c2f6e3b…965D", label: "St. Mary's Health" },
    insurer:  { party: 2, address: "0x8c1f3a91…7e2A", label: "Meridian Health Plan" },
    fileTs: Date.now() - 1000 * 60 * 60 * 26,
    evidence: [
      { idx: 0, source: "FDA label", label: "openFDA · MOUNJARO", url: "api.fda.gov/drug/label.json?search=MOUNJARO", hash: "0x77c0…aa12", slice: "Indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes." },
      { idx: 1, source: "Part D formulary 2026-03", label: "Step-therapy flag", url: "cms.gov/formulary/2026-03", hash: "0x4b77…1d9e", slice: "Step-therapy: metformin required first unless contraindicated." },
    ],
    events: [
      { kind: "Filed",                actor: "provider", note: "T2DM step-therapy exception — requested $1,480", ts: -1560, tx: "0x71d8…9911", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "InsurerEngaged",       actor: "insurer",  note: "Attached 'Step-Therapy — Metabolic 2026'", ts: -1555, tx: "0x3c41…90af", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "AdjudicationRequested",actor: "provider", note: "Fired arbiter agent-7B", ts: -1540, tx: "0x6620…11ce", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
      { kind: "EvidenceRequested",    actor: "arbiter",  note: "Need more evidence · cites §3.4 (metformin trial)", ts: -1539, tx: "0xab90…7d31", cost: null, value: null, attr: "On-chain ruling" },
      { kind: "EvidenceSubmitted",    actor: "provider", note: "Submitted appeal note — round 2 (Redetermination)", ts: -130, tx: "0x2d77…0b41", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
      { kind: "EvidenceRequested",    actor: "arbiter",  note: "Still insufficient · metformin-intolerance ref missing", ts: -120, tx: "0x9f12…6cd0", cost: null, value: null, attr: "On-chain ruling" },
    ],
  },
  {
    id: 4,
    drug: "Lecanemab", brand: "Leqembi", rxnorm: "RxNorm 2627150", ndc: "NDC 62856-105-01",
    quantity: 2, daysSupply: 28,
    drugRef: "0x0fae21b7…77c5", justificationHash: "0xd1c8b0…44ef",
    payerLine: "Commercial", appealRound: 0,
    requested: 6800, costPlusCap: 6500, nadacFloor: 6100,
    covered: null, state: "PolicyInvalidated", round: 1, maxRounds: 3,
    policy: { attached: true, name: "Neurology Exclusions 2026", id: "MHP-NEU-2026-031", hash: "0x88da…41b9", clause: "§6.9 — excludes all experimental anti-amyloid Alzheimer's therapies", compliant: false },
    decision: "policy_invalid",
    rationale: "Policy voided — clause §6.9 excludes anti-amyloid Alzheimer's therapies as 'experimental.' This contradicts the cited public standard: the FDA granted lecanemab traditional approval on 2023-07-06. A clause that contradicts the FDA-approved indication is non-compliant; the contract is voided (PolicyInvalidated) rather than the clause being silently applied.",
    citedClause: "§6.9", citedRefs: [0], receiptId: "rcpt-7B-2210", reasoningHash: "0x44ce…9b02",
    fdaStandard: { label: "FDA · traditional approval 2023-07-06", url: "fda.gov/drugs/leqembi-approval", quote: "Lecanemab-irmb granted traditional approval for the treatment of Alzheimer's disease." },
    provider: { party: 1, address: "0x5c2f6e3b…965D", label: "St. Mary's Health" },
    insurer:  { party: 2, address: "0x8c1f3a91…7e2A", label: "Meridian Health Plan" },
    fileTs: Date.now() - 1000 * 60 * 60 * 30,
    evidence: [
      { idx: 0, source: "FDA approval", label: "FDA · LEQEMBI traditional approval", url: "fda.gov/drugs/leqembi-approval", hash: "0xe0a1…7711", slice: "Granted traditional approval 2023-07-06 for treatment of Alzheimer's disease." },
      { idx: 1, source: "AAN guideline", label: "Anti-amyloid therapy", url: "aan.com/guidelines/anti-amyloid", hash: "0x3300…9c7d", slice: "Recommended for early Alzheimer's disease with confirmed amyloid pathology." },
    ],
    events: [
      { kind: "Filed",                actor: "provider", note: "Early Alzheimer's — requested $6,800", ts: -1800, tx: "0x0fae…77c5", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "InsurerEngaged",       actor: "insurer",  note: "Attached 'Neurology Exclusions 2026'", ts: -1790, tx: "0x88da…41b9", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "AdjudicationRequested",actor: "provider", note: "Fired arbiter agent-7B", ts: -1780, tx: "0x71fa…22b0", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
      { kind: "PolicyInvalidated",    actor: "arbiter",  note: "Clause §6.9 contradicts FDA approval — contract voided", ts: -1779, tx: "0x44ce…9b02", cost: null, value: null, attr: "On-chain ruling" },
    ],
  },
  {
    id: 3,
    drug: "Insulin Glargine", brand: "Lantus", rxnorm: "RxNorm 274783", ndc: "NDC 00088-2220-33",
    quantity: 5, daysSupply: 30,
    drugRef: "0x4a2d0f7e…81bf", justificationHash: "0xc7e322…7d14",
    payerLine: "PartD", appealRound: 3,
    requested: 380, costPlusCap: 88, nadacFloor: 80,
    covered: null, state: "Deadlocked", round: 3, maxRounds: 3,
    policy: { attached: true, name: "Insulin Formulary 2026", id: "MHP-INS-2026-005", hash: "0x6611…30da", clause: "§2.7 — preferred long-acting insulin: insulin glargine biosimilar", compliant: true },
    decision: "approve",
    rationale: "Ruled approve at the Cost Plus cap ($88) across all three rounds. The provider appealed to the ALJ stage seeking the full $380; no new public evidence shifted the deterministic cap. The round bound (3) was reached without mutual acceptance — Deadlocked.",
    citedClause: "§2.7", citedRefs: [0], receiptId: "rcpt-7B-3091", reasoningHash: "0x77b0…aa45",
    provider: { party: 1, address: "0x5c2f6e3b…965D", label: "St. Mary's Health" },
    insurer:  { party: 2, address: "0x8c1f3a91…7e2A", label: "Meridian Health Plan" },
    fileTs: Date.now() - 1000 * 60 * 60 * 50,
    evidence: [
      { idx: 0, source: "FDA label", label: "openFDA · insulin glargine", url: "api.fda.gov/drug/label.json?search=insulin+glargine", hash: "0x2c10…ff04", slice: "Indicated to improve glycemic control in adults with diabetes mellitus." },
    ],
    events: [
      { kind: "Filed",                actor: "provider", note: "Requested $380", ts: -3000, tx: "0x4a2d…81bf", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "InsurerEngaged",       actor: "insurer",  note: "Attached 'Insulin Formulary 2026'", ts: -2990, tx: "0x6611…30da", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "Ruled",                actor: "arbiter",  note: "Approve · covered $88 (capped) — round 1", ts: -2980, tx: "0x77b0…aa45", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
      { kind: "Appealed",             actor: "provider", note: "Appealed to Redetermination — round 2", ts: -2400, tx: "0x1d20…7a90", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
      { kind: "Ruled",                actor: "arbiter",  note: "Approve · covered $88 — cap unchanged", ts: -2399, tx: "0x88c1…0d3a", cost: null, value: null, attr: "On-chain ruling" },
      { kind: "Appealed",             actor: "provider", note: "Appealed to ALJ — round 3", ts: -200, tx: "0x9a01…b7c2", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
      { kind: "Deadlocked",           actor: "system",   note: "Round bound (3) reached without agreement", ts: -198, tx: "0xccd0…1e88", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
    ],
  },
  {
    id: 2,
    drug: "Semaglutide", brand: "Ozempic", rxnorm: "RxNorm 1991302", ndc: "NDC 00169-4181-12",
    quantity: 1, daysSupply: 28,
    drugRef: "0x2a91efb1…cb02", justificationHash: "0xb992f0…1d4f",
    payerLine: "Commercial", appealRound: 0,
    requested: 1100, costPlusCap: 940, nadacFloor: 820,
    covered: 0, state: "Denied", round: 1, maxRounds: 3,
    policy: { attached: true, name: "Metabolic Coverage 2026", id: "MHP-MET-2026-007", hash: "0x3c41…90af", clause: "§5.1 — covered only for type-2 diabetes; weight management excluded", compliant: true },
    decision: "deny",
    rationale: "Denied — the justification cites weight management in a patient without a T2DM diagnosis. The FDA label for this product (Ozempic) lists type-2 diabetes, not chronic weight management. Policy clause §5.1 excludes weight-management use, and that clause is consistent with the FDA-approved indication. Covered $0.",
    citedClause: "§5.1", citedRefs: [0], receiptId: "rcpt-7B-2007", reasoningHash: "0x33aa…77b1",
    provider: { party: 1, address: "0x5c2f6e3b…965D", label: "St. Mary's Health" },
    insurer:  { party: 2, address: "0x8c1f3a91…7e2A", label: "Meridian Health Plan" },
    fileTs: Date.now() - 1000 * 60 * 60 * 72,
    evidence: [
      { idx: 0, source: "FDA label", label: "openFDA · OZEMPIC", url: "api.fda.gov/drug/label.json?search=OZEMPIC", hash: "0x9001…3bc2", slice: "Indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes." },
    ],
    events: [
      { kind: "Filed",                actor: "provider", note: "Requested $1,100", ts: -4320, tx: "0x2a91…cb02", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "InsurerEngaged",       actor: "insurer",  note: "Attached 'Metabolic Coverage 2026'", ts: -4310, tx: "0x3c41…90af", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "AdjudicationRequested",actor: "provider", note: "Fired arbiter agent-7B", ts: -4300, tx: "0x5510…99a2", cost: 0.33041, value: AGENT_FEE, attr: "Outbound to agent (fee escrow)" },
      { kind: "Ruled",                actor: "arbiter",  note: "Deny · covered $0 · cites §5.1", ts: -4299, tx: "0x33aa…77b1", cost: null, value: null, attr: "On-chain ruling" },
    ],
  },
  {
    id: 1,
    drug: "Sertraline", brand: "(generic)", rxnorm: "RxNorm 312940", ndc: "NDC 00093-7194-01",
    quantity: 30, daysSupply: 30,
    drugRef: "0x83bc1f0e…aa42", justificationHash: "0x7311ab…992e",
    payerLine: "PartD", appealRound: 0,
    requested: 180, costPlusCap: 10, nadacFloor: 8,
    covered: null, state: "Withdrawn", round: 0, maxRounds: 3,
    policy: { attached: false, name: null, id: null, hash: null, clause: null, compliant: null },
    decision: null,
    provider: { party: 1, address: "0x5c2f6e3b…965D", label: "St. Mary's Health" },
    insurer:  { party: 2, address: "0x8c1f3a91…7e2A", label: "Meridian Health Plan" },
    fileTs: Date.now() - 1000 * 60 * 60 * 96,
    evidence: [],
    events: [
      { kind: "Filed",     actor: "provider", note: "Requested $180", ts: -5760, tx: "0x83bc…aa42", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
      { kind: "Withdrawn", actor: "provider", note: "Provider withdrew before policy attach", ts: -5740, tx: "0x6a01…ddc4", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
    ],
  },
  {
    id: 9,
    drug: "Dupilumab", brand: "Dupixent", rxnorm: "RxNorm 1876366", ndc: "NDC 00024-5915-02",
    quantity: 2, daysSupply: 28,
    drugRef: "0xb7c10a44…2f9d", justificationHash: "0x09ad71…b3c0",
    payerLine: "Commercial", appealRound: 0,
    requested: 3600, costPlusCap: 3300, nadacFloor: 3100,
    covered: null, state: "Open", round: 0, maxRounds: 3,
    policy: { attached: false, name: null, id: null, hash: null, clause: null, compliant: null },
    decision: null,
    provider: { party: 1, address: "0x5c2f6e3b…965D", label: "St. Mary's Health" },
    insurer:  { party: 2, address: "0x8c1f3a91…7e2A", label: "Meridian Health Plan" },
    fileTs: Date.now() - 1000 * 60 * 42,
    evidence: [
      { idx: 0, source: "FDA label", label: "openFDA · DUPIXENT", url: "api.fda.gov/drug/label.json?search=DUPIXENT", hash: "0x5a90…12cd", slice: "Indicated for moderate-to-severe atopic dermatitis inadequately controlled with topical therapies." },
    ],
    events: [
      { kind: "Filed", actor: "provider", note: "Moderate-to-severe atopic dermatitis — requested $3,600", ts: -42, tx: "0xb7c1…2f9d", cost: GAS_TYPICAL, value: null, attr: "Burned (gas)" },
    ],
  },
];

/* ── Event-kind display ─────────────────────────────────────────────── */
const EVENT_META = {
  Filed:                 { label: "Filed",                color: "var(--purple-500)" },
  ContentCommitted:      { label: "Content committed",    color: "var(--purple-400)" },
  InsurerEngaged:        { label: "Policy attached",      color: "var(--purple-600)" },
  AdjudicationRequested: { label: "AI requested",         color: "var(--purple-700)" },
  Ruled:                 { label: "Ruled",                color: "var(--state-review)" },
  EvidenceRequested:     { label: "Evidence requested",   color: "var(--state-evidence)" },
  EvidenceSubmitted:     { label: "Evidence submitted",   color: "var(--purple-500)" },
  Appealed:              { label: "Appealed",             color: "var(--purple-600)" },
  Accepted:              { label: "Accepted",             color: "var(--state-approved)" },
  Settled:               { label: "Settled",              color: "var(--state-settled)" },
  PolicyInvalidated:     { label: "Policy voided",        color: "var(--state-policy)" },
  Deadlocked:            { label: "Deadlocked",           color: "var(--state-deadlock)" },
  ProviderRefused:       { label: "Provider refused",     color: "var(--state-refused)" },
  Withdrawn:             { label: "Withdrawn",            color: "var(--state-withdrawn)" },
};

/* ── live tx stream seed (network monitor) ──────────────────────────── */
const TX_EVENTS_SEED = [
  { kind: "AdjudicationRequested", reqId: 8, msg: "fired arbiter · 0.33 STT escrowed", t: -2 },
  { kind: "InsurerEngaged",        reqId: 8, msg: "policy 0x7c14…aa01 attached", t: -12 },
  { kind: "EvidenceRequested",     reqId: 5, msg: "arbiter: metformin-trial ref missing", t: -120 },
  { kind: "Filed",                 reqId: 9, msg: "provider 1 → insurer 2 · $3,600", t: -42 },
  { kind: "PolicyInvalidated",     reqId: 4, msg: "§6.9 contradicts FDA approval — voided", t: -1779 },
  { kind: "Settled",               reqId: 6, msg: "covered $22 · fee split 50/50", t: -293 },
  { kind: "Ruled",                 reqId: 7, msg: "approve · covered $3,800 · cites §4.2", t: -159 },
];

/* ── helpers ─────────────────────────────────────────────────────────── */
function relTime(mins) {
  const m = Math.abs(mins);
  if (m < 1) return "just now";
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
function money(n) { return n == null ? "—" : `$${Number(n).toLocaleString()}`; }
function stt(n, dp = 4) { return `${Number(n).toFixed(dp)} STT`; }

Object.assign(window, {
  STATES, FLOW_STEPS, DECISIONS, LADDERS, stageOf, PROFILES, AGENT_FEE, GAS_TYPICAL,
  REQUESTS, EVENT_META, TX_EVENTS_SEED, relTime, money, stt,
});

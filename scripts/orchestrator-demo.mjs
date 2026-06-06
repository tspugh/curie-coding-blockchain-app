/**
 * Headless orchestrator demo + check (SPEC-0001 §4 / R11/R13, revised 2026-05-27
 * — AI necessity-arbiter model) — wallet-free.
 *
 * Drives the full provider↔insurer loop via the orchestrator + party agents over
 * a SIMULATED client (no chain, no funds): provider files the request, insurer
 * engages (attaches policy → Ready), provider requests adjudication (fires the
 * mocked arbiter), the ruling lands, and the configured post-ruling action runs.
 * Asserts the transcript for the approve→Settled, deny→Denied,
 * need_more_evidence→EvidenceRequested→submitEvidence→approve→Settled,
 * policy_invalid→PolicyInvalidated, and appeal→Deadlocked paths.
 *
 * Run: npm run demo:orchestrator   (or: node scripts/orchestrator-demo.mjs)
 */
import assert from "node:assert/strict";

import {
  createClient,
  createProviderAgent,
  createInsurerAgent,
  runNegotiation,
  Decision,
  State,
  SimulatedBackend,
} from "../dist/index.js";

// The mocked arbiter decision is reconfigured per scenario via this closure.
let nextDecision = Decision.Approve;
// Optional: vary the decision by round (for the need_more_evidence path).
let decisionFn = null;

const client = createClient({
  wallet: { mode: "simulated" },
  contract: {
    simulated: {
      autoResolveMs: 5,
      // No costPlusUnitPrice override: the default per-unit (ceil(requested/quantity))
      // makes the cap non-binding, so covered == requested.
      decision: (n, reqId) => (decisionFn ? decisionFn(n, reqId) : nextDecision),
    },
  },
});
const provider = createProviderAgent(client);
// SPEC-0004 R2b: providerAddr != insurerAddr per request. The simulated backend's
// ANY_CALLER mode lets us reuse one client + one negotiation backend while binding
// the insurer agent to a distinct synthetic address.
const INSURER_DEMO_ADDR = "0x" + "00".repeat(19) + "02";
const insurer = createInsurerAgent(client, { addressOverride: INSURER_DEMO_ADDR });

let passed = 0;
const check = (desc, cond) => {
  assert.ok(cond, desc);
  console.log(`  ✓ ${desc}`);
  passed += 1;
};

const baseScript = {
  drug: "Adalimumab",
  justification: "Synthetic coverage-exception justification — off-chain only.",
  policyText: "Insurer specialty-drug step-therapy policy — off-chain body.",
  evidenceRef: "Peer-reviewed evidence of medical necessity.",
  requestedAmount: 4200n,
  quantity: 6n, // 6 dispensed units; drives the deterministic cap (R2/R6a)
  daysSupply: 28n, // clinical context only — never enters the price math (R2)
  payerLine: 0, // PayerLine.PartD — SPEC-0004 R13
  agentEvidenceUrl: "https://www.fda.gov/media/119435/download",
  agentPromptHint: "Is this drug medically necessary for the patient's condition?",
};

async function main() {
  console.log("Orchestrator demo (simulated, wallet-free)\n");

  // --- approve -> both accept -> Settled ---
  nextDecision = Decision.Approve;
  decisionFn = null;
  let t = await runNegotiation(client.negotiation, provider, insurer, baseScript);
  const names = t.events.map((e) => e.name);
  check(`approve path runs to Settled [${t.finalStateName}]`, t.finalState === State.Settled);
  check("approve path: decision recorded", t.decision === Decision.Approve);
  check("approve path: covered == requested (deterministic min, R6a)", t.coveredAmount === 4200n);
  check(
    "approve path: price basis exposes the deterministic breakdown (R6a/R10)",
    t.priceBasis.requestedAmount === 4200n &&
      t.priceBasis.quantity === 6n &&
      t.priceBasis.coveredAmount === 4200n &&
      // default per-unit = ceil(4200/6) = 700 -> cap total 4200 (non-binding)
      t.priceBasis.costPlusTotal >= 4200n,
  );
  check(
    "approve path: full timeline emitted",
    ["ContractCreated", "InsurerEngaged", "ContractReady", "AdjudicationRequested", "RulingRequested", "Ruled", "Accepted", "Settled"].every(
      (n) => names.includes(n),
    ),
  );
  check("provider files; insurer is counterparty (R13)", provider.partyId !== insurer.partyId);

  // --- deny -> stays Denied (stop) ---
  nextDecision = Decision.Deny;
  t = await runNegotiation(client.negotiation, provider, insurer, { ...baseScript, onRuling: "stop" });
  check(
    `deny path ends Denied [${t.finalStateName}]`,
    t.finalState === State.Denied && t.decision === Decision.Deny && t.coveredAmount === 0n,
  );

  // --- need_more_evidence -> EvidenceRequested -> submitEvidence -> approve -> Settled ---
  // First ruling asks for evidence; the re-fired ruling approves. A per-run fire
  // counter flips the decision after the first ruling.
  let fires = 0;
  decisionFn = () => (++fires === 1 ? Decision.NeedMoreEvidence : Decision.Approve);
  t = await runNegotiation(client.negotiation, provider, insurer, baseScript);
  const nmeNames = t.events.map((e) => e.name);
  check(
    `need_more_evidence path: EvidenceRequested then approve -> Settled [${t.finalStateName}]`,
    t.finalState === State.Settled && t.decision === Decision.Approve,
  );
  check(
    "need_more_evidence path: EvidenceRequested + EvidenceSubmitted emitted",
    nmeNames.includes("EvidenceRequested") && nmeNames.includes("EvidenceSubmitted"),
  );
  check("need_more_evidence path: round advanced to 2 (R6c)", t.round === 2n);

  // --- policy_invalid -> PolicyInvalidated ---
  decisionFn = null;
  nextDecision = Decision.PolicyInvalid;
  t = await runNegotiation(client.negotiation, provider, insurer, baseScript);
  const piNames = t.events.map((e) => e.name);
  check(
    `policy_invalid path ends PolicyInvalidated [${t.finalStateName}]`,
    t.finalState === State.PolicyInvalidated && t.decision === Decision.PolicyInvalid,
  );
  check("policy_invalid path: PolicyFlagged + PolicyInvalidated emitted", piNames.includes("PolicyFlagged") && piNames.includes("PolicyInvalidated"));

  // --- appeal -> Deadlocked (round cap exhausted) ---
  // maxRounds defaults to 3. requestAdjudication sets round=1; each appeal that
  // re-fires increments. Keep denying and keep appealing until the cap deadlocks.
  decisionFn = null;
  nextDecision = Decision.Deny;
  t = await runNegotiation(client.negotiation, provider, insurer, {
    ...baseScript,
    onRuling: "appeal", // appeal round 1 (->2, re-fires deny)
    afterEvidence: "appeal",
  });
  // After one appeal we're at round 2 + Denied; drive remaining appeals to the cap.
  let st = t.finalState;
  let guard = 0;
  while (st === State.Denied && guard++ < 5) {
    await provider.appeal(t.reqId);
    // wait for any re-fired ruling to land
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && (await client.negotiation.stateOf(t.reqId)) === State.UnderReview) {
      await new Promise((r) => setTimeout(r, 10));
    }
    st = await client.negotiation.stateOf(t.reqId);
  }
  check(`appeal path eventually Deadlocked at the round cap (R6c) [${State[st]}]`, st === State.Deadlocked);

  await client.close();

  // --- cap-binding approve: covered == min(requested, costPlusUnitPrice*quantity) ---
  // requested is high; costPlusUnitPrice*quantity is LOWER, so the cap binds and
  // covered == the cap total, NOT the requested amount (R6a). NADAC is a floor ref.
  {
    const REQUESTED = 10000n;
    const QTY = 4n;
    const UNIT = 1500n; // Cost Plus per-unit -> cap total 6000 < requested 10000
    const NADAC = 900n; // floor reference only; must not enter the cap math
    const capClient = createClient({
      wallet: { mode: "simulated" },
      contract: {
        simulated: {
          autoResolveMs: 5,
          decision: Decision.Approve,
          costPlusUnitPrice: UNIT,
          nadacUnitPrice: NADAC,
        },
      },
    });
    const capProvider = createProviderAgent(capClient);
    const capInsurer = createInsurerAgent(capClient, { addressOverride: INSURER_DEMO_ADDR });
    const capScript = { ...baseScript, requestedAmount: REQUESTED, quantity: QTY, daysSupply: 30n };
    const ct = await runNegotiation(capClient.negotiation, capProvider, capInsurer, capScript);
    const expectedCap = UNIT * QTY; // 6000
    const expectedCovered = REQUESTED < expectedCap ? REQUESTED : expectedCap; // 6000

    check(
      `cap-binding approve runs to Settled [${ct.finalStateName}]`,
      ct.finalState === State.Settled && ct.decision === Decision.Approve,
    );
    check(
      "cap-binding: covered == min(requested, costPlusUnitPrice*quantity), the CAP (R6a)",
      ct.coveredAmount === expectedCovered && ct.coveredAmount === expectedCap && ct.coveredAmount < REQUESTED,
    );
    check(
      "cap-binding: priceBasis totals reflect the per-unit prices x quantity (R6a/R10)",
      ct.priceBasis.costPlusTotal === expectedCap &&
        ct.priceBasis.nadacFloorTotal === NADAC * QTY &&
        ct.priceBasis.coveredAmount === expectedCovered,
    );
    check(
      "cap-binding: NADAC floor is a reference only — it does NOT drive the cap",
      ct.priceBasis.nadacFloorTotal !== ct.coveredAmount,
    );

    // daysSupply must NOT change the price: same inputs, different daysSupply -> same covered.
    const dt = await runNegotiation(capClient.negotiation, capProvider, capInsurer, {
      ...capScript,
      daysSupply: 90n,
    });
    check(
      "daysSupply does not change the deterministic price (R2)",
      dt.coveredAmount === ct.coveredAmount && dt.priceBasis.costPlusTotal === ct.priceBasis.costPlusTotal,
    );

    await capClient.close();
  }
  console.log(`\norchestrator demo: ${passed} checks passed`);
}

main().catch((err) => {
  console.error("\n✗ orchestrator demo FAILED:", err.message ?? err);
  process.exit(1);
});

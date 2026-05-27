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
      // requestedAmount drives the default benchmarkCap, so covered == requested.
      decision: (n, reqId) => (decisionFn ? decisionFn(n, reqId) : nextDecision),
    },
  },
});
const provider = createProviderAgent(client);
const insurer = createInsurerAgent(client);

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
  console.log(`\norchestrator demo: ${passed} checks passed`);
}

main().catch((err) => {
  console.error("\n✗ orchestrator demo FAILED:", err.message ?? err);
  process.exit(1);
});

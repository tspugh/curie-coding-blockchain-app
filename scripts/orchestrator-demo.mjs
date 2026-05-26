/**
 * Headless orchestrator demo + check (SPEC-0001 §4 / R11/R13) — wallet-free.
 *
 * Drives the full provider↔payer loop via the orchestrator + party agents over a
 * SIMULATED client (no chain, no funds): provider opens + proposes, payer
 * proposes (→ Ready), a party disputes (fires the mocked agent), the ruling
 * lands, and on approve the provider settles. Asserts the transcript for the
 * approve→settle, deny, and need_more_evidence paths.
 *
 * Run: npm run demo:orchestrator   (or: node scripts/orchestrator-demo.mjs)
 */
import assert from "node:assert/strict";

import {
  createClient,
  createProviderAgent,
  createPayerAgent,
  runNegotiation,
  State,
  STATE_NAMES,
} from "../dist/index.js";

let nextVerdict = "approve";

const client = createClient({
  wallet: { mode: "simulated" },
  contract: { simulated: { autoResolveMs: 20, verdict: () => nextVerdict } },
});
const provider = createProviderAgent(client);
const payer = createPayerAgent(client);

let passed = 0;
const check = (desc, cond) => {
  assert.ok(cond, desc);
  console.log(`  ✓ ${desc}`);
  passed += 1;
};

const baseScript = {
  drug: "Adalimumab",
  note: "Synthetic coverage-exception note — off-chain only.",
  priceFloor: 1000n,
  priceCeil: 5000n,
  providerAmount: 4200n,
  payerAmount: 2600n,
};

async function main() {
  console.log("Orchestrator demo (simulated, wallet-free)\n");

  // --- approve -> settle ---
  nextVerdict = "approve";
  let t = await runNegotiation(client.negotiation, provider, payer, { ...baseScript, settleAmount: 3400n });
  const names = t.events.map((e) => e.name);
  check(`approve path runs to Settled [${t.finalStateName}]`, t.finalState === State.Settled);
  check("approve path: verdict recorded", t.verdict === "approve");
  check(
    "approve path: full timeline emitted",
    ["ContractCreated", "PositionSubmitted", "ContractReady", "DisputeSubmitted", "RulingRequested", "Ruled", "Settled"].every((n) => names.includes(n)),
  );
  check("provider opened as initiator; payer is counterparty (R13)", provider.partyId !== payer.partyId);

  // --- deny -> stays Denied (provider can appeal) ---
  nextVerdict = "deny";
  t = await runNegotiation(client.negotiation, provider, payer, { ...baseScript, settleAmount: 3400n });
  check(`deny path ends Denied (no settle) [${t.finalStateName}]`, t.finalState === State.Denied && t.verdict === "deny");

  // --- need_more_evidence -> EvidenceRequested ---
  nextVerdict = "need_more_evidence";
  t = await runNegotiation(client.negotiation, provider, payer, baseScript);
  check(
    `need_more_evidence path ends EvidenceRequested [${t.finalStateName}]`,
    t.finalState === State.EvidenceRequested && t.verdict === "need_more_evidence",
  );

  // --- payer-initiated dispute also works (R12/R13) ---
  nextVerdict = "approve";
  t = await runNegotiation(client.negotiation, provider, payer, { ...baseScript, disputeBy: "payer", settleAmount: 3000n });
  check(`payer-initiated dispute runs to Settled [${t.finalStateName}]`, t.finalState === State.Settled);

  await client.close();
  console.log(`\norchestrator demo: ${passed} checks passed`);
}

main().catch((err) => {
  console.error("\n✗ orchestrator demo FAILED:", err.message ?? err);
  process.exit(1);
});

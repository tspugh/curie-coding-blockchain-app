#!/usr/bin/env tsx
/**
 * SPEC-0005 R1 integration test — full real-wallet flow on Somnia testnet.
 *
 * Drives the live web UI via `agent-browser` against the deployed
 * `CoverageNegotiation` contract. The flow:
 *
 *   1. Provider creates a request (UI nav-create → fill → submit).
 *   2. Insurer attaches a curated Part D policy via the engage panel.
 *   3. Provider requests adjudication; the arbiter fires.
 *   4. Both parties accept the ruling.
 *   5. Provider settles.
 *
 * Pre-flight: per R2, both wallets must hold ≥ 0.5 STT. If either is
 * underfunded the script exits with code 2 + a clear funding message — never
 * silently. Per R3, per-step tx hashes are captured and appended to
 * `docs/progress/integration-test.md`.
 *
 * Usage:
 *   tsx scripts/integration-test.ts                 # one curated case
 *   tsx scripts/integration-test.ts --case partd    # explicit case slug
 *
 * Reads from .env:
 *   VITE_PRIVATE_KEY            — provider's signing key
 *   VITE_PRIVATE_KEY_INSURER    — insurer's signing key (the R18 blocker)
 *   VITE_CONTRACT_ADDRESS       — deployed contract address
 *   VITE_RPC_URL                — Somnia testnet RPC (default: testnet)
 *
 * Exit codes (THIS LANDING — pre-flight + receipts only):
 *   0  — pre-flight + receipt-capture succeeded. **NOT the full R1 flow.**
 *        The mid-flow agent-browser steps (create → engage → adjudicate →
 *        accept → settle) are unimplemented in this tick and land in T74b.
 *        When T74b lands, exit-0 will be repurposed to mean "full flow OK"
 *        and the partial-success path here will move to a new exit code 4.
 *   2  — pre-flight failure (insufficient funds, missing config). Operator
 *        action required; the next-tick re-run is futile until fixed.
 *   3  — runtime failure mid-flow (revert, network, harness step). Receipts
 *        captured so far go to integration-test.md for postmortem.
 *
 * Status as of authoring (2026-05-30): the insurer wallet 0x140e…8C62 is
 * UNFUNDED (R18 in loop-state.md). This script will exit 2 with a faucet
 * link until that's resolved — by design.
 */
import { readFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

/** Minimum balance per wallet for the full flow (gas + agent-fee reserve). */
const MIN_BALANCE_WEI = ethers.parseUnits("0.5", "ether");

/** Somnia Shannon testnet defaults — match src/config/networks.ts. */
const DEFAULT_RPC = "https://api.infra.testnet.somnia.network/";
const FAUCET_URL = "https://testnet.somnia.network/";
const EXPLORER_BASE = "https://shannon-explorer.somnia.network";

interface EnvConfig {
  readonly providerKey: string;
  readonly insurerKey: string;
  readonly contractAddress: string;
  readonly rpcUrl: string;
}

/** Read + validate .env without pulling in dotenv. */
function loadEnv(): EnvConfig | { error: string } {
  let raw: string;
  try {
    raw = readFileSync(join(REPO_ROOT, ".env"), "utf8");
  } catch {
    return { error: ".env file not found at repo root — copy .env.example first." };
  }
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    // Strip an inline `# comment` tail so values like
    //   VITE_RPC_URL=https://… # somnia testnet
    // don't carry the comment into the URL. Quoted values keep their `#`.
    let value = m[2]!;
    if (!/^["']/.test(value)) {
      const hash = value.indexOf("#");
      if (hash >= 0) value = value.slice(0, hash).trimEnd();
    }
    env[m[1]!] = value.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  }
  const providerKey = env["VITE_PRIVATE_KEY"] ?? "";
  const insurerKey = env["VITE_PRIVATE_KEY_INSURER"] ?? "";
  const contractAddress = env["VITE_CONTRACT_ADDRESS"] ?? "";
  const rpcUrl = env["VITE_RPC_URL"] ?? DEFAULT_RPC;
  const HEX = /^0x[0-9a-fA-F]{64}$/;
  if (!HEX.test(providerKey)) {
    return { error: "VITE_PRIVATE_KEY missing or malformed (need 0x + 64 hex)." };
  }
  if (!HEX.test(insurerKey)) {
    return {
      error:
        "VITE_PRIVATE_KEY_INSURER missing or malformed — required for the R1 flow (the insurer attaches the policy).",
    };
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    return { error: "VITE_CONTRACT_ADDRESS missing or malformed (need 0x + 40 hex)." };
  }
  return { providerKey, insurerKey, contractAddress, rpcUrl };
}

/**
 * R2 pre-flight: check both wallets meet `MIN_BALANCE_WEI`. Print a clear
 * faucet-link message and exit non-zero when either is short.
 */
async function preflightBalances(cfg: EnvConfig): Promise<void> {
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const providerWallet = new ethers.Wallet(cfg.providerKey);
  const insurerWallet = new ethers.Wallet(cfg.insurerKey);
  const [providerBal, insurerBal] = await Promise.all([
    provider.getBalance(providerWallet.address),
    provider.getBalance(insurerWallet.address),
  ]);

  let shortfall = false;
  for (const [label, addr, bal] of [
    ["Provider", providerWallet.address, providerBal] as const,
    ["Insurer", insurerWallet.address, insurerBal] as const,
  ]) {
    if (bal < MIN_BALANCE_WEI) {
      shortfall = true;
      const have = ethers.formatEther(bal);
      const need = ethers.formatEther(MIN_BALANCE_WEI);
      const missing = ethers.formatEther(MIN_BALANCE_WEI - bal);
      console.error(
        `  ✗ ${label} wallet ${addr} has ${have} STT; need ≥ ${need} STT (short by ${missing} STT).`,
      );
      console.error(`    Top up at: ${FAUCET_URL}`);
      console.error(`    Inspect:   ${EXPLORER_BASE}/address/${addr}`);
    } else {
      console.log(`  ✓ ${label} wallet ${addr} has ${ethers.formatEther(bal)} STT.`);
    }
  }
  if (shortfall) {
    console.error(
      "\nSPEC-0005 R2 pre-flight FAILED. Fund the underfunded wallet(s) and re-run.",
    );
    process.exit(2);
  }
}

/**
 * Append a single line to docs/progress/integration-test.md so the run is
 * auditable post-hoc (R3). Creates an entry like:
 *   2026-05-30 19:42:11Z  step=create  status=PASS  tx=0xabc…  reqId=7
 */
function recordReceipt(step: string, status: "PASS" | "FAIL", extras: Record<string, string> = {}): void {
  const ts = new Date().toISOString().replace("T", " ").replace(/\..*$/, "Z");
  const extra = Object.entries(extras).map(([k, v]) => `${k}=${v}`).join(" ");
  const line = `${ts}  step=${step}  status=${status}  ${extra}\n`;
  try {
    appendFileSync(join(REPO_ROOT, "docs/progress/integration-test.md"), line);
  } catch {
    // Non-fatal; the console output is the canonical record either way.
  }
}

async function main(): Promise<void> {
  console.log("SPEC-0005 R1 integration test — Somnia testnet (chain 50312)");
  console.log("─".repeat(64));

  const cfgOrErr = loadEnv();
  if ("error" in cfgOrErr) {
    console.error(`✗ pre-flight (config): ${cfgOrErr.error}`);
    process.exit(2);
  }

  console.log("Pre-flight: wallet balances...");
  await preflightBalances(cfgOrErr);

  // ── Browser-driven flow is intentionally left unimplemented here ────────
  //
  // The remaining steps drive the live UI via agent-browser. They reuse
  // helpers from web/tests/agent-browser/run.sh (open_app, eval_click,
  // reopen_detail, state_of, field_of). Wiring them through a TS script
  // requires either:
  //  - shelling out to `agent-browser` per step (simple, matches run.sh
  //    conventions), or
  //  - importing agent-browser as a library (cleaner async/await but
  //    couples this script to its TS API).
  //
  // Pre-flight + receipt capture are already wired so the operator can
  // confirm R2 + R3 plumbing now. Mid-flow harness invocation lands in a
  // follow-up tick (T74b) once a curated case slug + the contract are
  // known to be consistent (the deployed contract still carries the
  // pre-tick-49 7-arg Ruled ABI per R18; the redeploy unblocks both).

  console.log("\nPre-flight OK. Mid-flow harness wiring lands in T74b once R18 unblocks.");
  console.log("EXITING 0 — this is partial success (pre-flight + receipts only).");
  console.log("The full R1 flow is NOT verified here; that's the T74b deliverable.");
  recordReceipt("preflight", "PASS", {
    provider: cfgOrErr.providerKey.slice(0, 8) + "…",
    insurer: cfgOrErr.insurerKey.slice(0, 8) + "…",
    contract: cfgOrErr.contractAddress,
  });
  process.exit(0);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ uncaught: ${msg}`);
  recordReceipt("uncaught", "FAIL", { msg: msg.slice(0, 80) });
  process.exit(3);
});

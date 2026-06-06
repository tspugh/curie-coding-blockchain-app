# Amendment 0009 — Real evidence resubmission

**Status:** Accepted (2026-06-05)
**Affects:** SPEC-0001 R9 (evidence rounds), SPEC-0006 §3.6 (two-agent flow),
Amendment 0007 (scrape→decide pipeline)
**Supersedes:** the evidence-handling half of the Amendment-0007 flow.

## Context

The two-agent pipeline (Amendment 0007) fires **LLM Parse Website** to scrape a
URL, then **LLM Inference** to decide from the extracted text. `submitEvidence`
and `appeal` accepted a `bytes32 evidenceUri` and called `_fireScrape` — but
`_fireScrape` always re-scrapes `n.agentEvidenceUrl`, the URL set at
`createContract`. The submitted `evidenceUri` was stored and emitted but **never
fed to either agent**.

Two observable consequences:

1. **`needs_more_info` loops are deterministic.** Re-submitting evidence re-runs
   the identical scrape→decide over the same page, so the decision cannot change;
   the negotiation walks to the `maxRounds` cap and `Deadlocked`.
2. **The evidence box is a no-op.** The UI hashed free text (`hashContent`) into
   the `bytes32` — structurally un-scrapeable — implying a causality the contract
   never had.

## Decision

Evidence resubmission supplies a **new public evidence URL**, and the re-scrape
targets it.

- `submitEvidence(uint256 reqId, string calldata newEvidenceUrl)`
  (was `bytes32 evidenceUri`).
- `appeal(uint256 reqId, uint256 partyId, string calldata newEvidenceUrl, bytes32 reasonHash)`
  (the evidence arg was `bytes32 evidenceUri`; `reasonHash` is unchanged).
- Validation mirrors `createContract`'s R14 bound:
  `1 <= bytes(newEvidenceUrl).length <= 512`, reverting `evidence: url required`.
- Effects on a non-cap submit:
  - `n.agentEvidenceUrl = newEvidenceUrl;` — the re-scrape now reads the new URL.
  - `n.evidenceUri = keccak256(bytes(newEvidenceUrl));` — an audit hash kept so
    the `EvidenceSubmitted(reqId, bytes32)` / `Appealed(reqId, …, bytes32, …)`
    event signatures stay stable and PHI-free.
- The deadlock-cap short-circuit (`round >= maxRounds`) is unchanged.

## Consequences

- **Resubmitting evidence changes the decide input** — a different (scraper-
  friendly) URL produces different extracted text, so the ruling can change. The
  loop is no longer a deterministic no-op.
- **No-PHI invariant preserved.** A public URL is not PHI; URLs contain no
  whitespace, so the `agentPromptHint` patient-name guard (`[A-Z][a-z]+ [A-Z]`,
  two space-separated Title-Case words) cannot match a URL — only the length
  bound applies. Only the `keccak256` hash, never raw free text, lands in events.
- **Off-chain lockstep:** `abi.ts`, `real.ts`, `simulated.ts`, and the client
  interface change the evidence arg from `bytes32` to `string`. The UI
  (`Detail.tsx`) passes the raw URL the provider types — `hashContent` is dropped
  from the evidence/appeal submit paths.
- **Still curated for the demo.** Scrape success still depends on the URL being
  static HTML (Wikipedia-class). Arbitrary URLs may fail the scrape and route to
  `EvidenceRequested`; that is now an honest outcome, not a hidden no-op.

## Test impact

Hardhat: `submitEvidence`/`appeal` tests pass a URL string; add cases asserting
`n.agentEvidenceUrl` is updated and the new URL is scraped on the next fire.
Node/sim: mirror the string signature. E2E: the evidence-resubmit / appeal
scenarios paste a URL instead of free text.

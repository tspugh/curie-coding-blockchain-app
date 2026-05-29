# Security findings — 2026-05-29 tick 8 (UNIT-3 partd-approvable fixtures)

**Verdict:** PASS (0 findings)

## Diff scope

Six new files in the worktree:

1. `demo-data/scenarios/partd-approvable/note.md` — synthetic clinical narrative.
2. `demo-data/scenarios/partd-approvable/packet.json` — EvidenceReference packet
   with three references (DailyMed, CMS formulary, costplusdrugs).
3. `demo-data/scenarios/partd-approvable/payer-profile.json` — PartD profile +
   `formularyRelease` discriminant.
4. `demo-data/scenarios/partd-approvable/requested-drug.json` — NDC/RxNorm/dose
   record for adalimumab.
5. `demo-data/scenarios/partd-approvable/expected-outcome.md` — expected ruling
   narrative ("Approve", round 0).
6. `src/protocol/scenarios.partd-approvable.test.ts` — `node:test` + `node:assert`
   schema tests over the five fixture files.

## Per-concern verdict

### 1. PHI leakage (SPEC-0004 R1 — synthetic-only) — PASS

`note.md` is clearly synthetic. No real names — the patient is referred to as
"Patient A" (line 10, 41) under an explicitly-labelled "Synthetic patient
identifier: P-0001 / MRN 000-PARTD-001" header (line 3). The MRN is a
synthetic-shaped token (`000-PARTD-001`) that telegraphs its fabrication
(leading zeros, payer-line tag, sequence). No DOB appears — only "Year of
birth: 1956" (line 4), which is an HIPAA Safe-Harbor-permissible year-only
value, not a full MM/DD/YYYY date. No SSN, no SSN-shaped digit string
(`\d{3}-\d{2}-\d{4}` not present), no full address (city = "Anytown, USA",
line 5 — a synthetic placeholder), no driver's-license-shaped identifiers
(`[A-Z]{2}\d{6,}` not present), no phone numbers. The plan ID `S5810-001`
(SilverScript) is a publicly-published CMS Part D contract ID, not a
patient identifier. The narrative is generic clinical phrasing
("70-year-old", "14-year history of seropositive RA") — categorical, not
PHI. R1 satisfied.

The test at lines 30–48 codifies these same PHI-marker checks (SSN pattern,
SSN-format digits, MM/DD/YYYY DOB, driver-license shape, plus a
positive-marker assertion that the file contains "synthetic" / "fictional" /
"Patient A"). The note's text passes all of them.

### 2. Path traversal in the test — PASS (no risk)

`src/protocol/scenarios.partd-approvable.test.ts` builds filesystem paths via
`path.resolve(path.dirname(__filename), "..", "..")` (line 18) and then
`path.join(PROJECT_ROOT, "demo-data", "scenarios", "partd-approvable")`
(line 19). The only variable input is the hard-coded array of five filenames
at line 24 (`["note.md", "packet.json", "payer-profile.json",
"requested-drug.json", "expected-outcome.md"]`) and the literal-string
arguments to `scenarioFile(...)` throughout. **No user-supplied string flows
into any `fs.readFileSync` or `fs.existsSync` call.** The `__filename` /
`__dirname` anchor is derived from `import.meta.url` via `fileURLToPath`,
which is a trusted ESM-runtime value, not external input. No traversal
surface.

### 3. Real-key / credential leakage in fixtures — PASS

Full sweep for `0x[0-9a-fA-F]{64}` across the diff returns exactly four
matches, all identical:
`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`
(packet.json lines 5, 17, 29; payer-profile.json line 10). This is the
**well-known keccak256 of the empty byte string** — a deterministic public
constant, not a private key. It is explicitly labelled as a placeholder in
`payer-profile.json` (line 9: "v0 placeholder — contentHash is keccak256 of
zero bytes (well-known empty-bytes hash); replace with keccak256 of the
actual CMS formulary ZIP at pin time via scripts/pin-formulary.ts"). Using
the empty-bytes keccak as a placeholder rather than zeroing the field is
deliberate: it satisfies the `^0x[0-9a-fA-F]{64}$` regex (test line 77, 137)
without collapsing to a sentinel value (`0x000...0`) that might be treated
as "unset" elsewhere.

The only other `0x` hex string is the synthetic `submittedBy` address
`0x0000000000000000000000000000000000000001` (packet.json line 40) — a
20-byte all-zero+1 EOA placeholder, not a real wallet. No
`-----BEGIN ... PRIVATE KEY-----` blocks, no `AKIA...` (AWS), no `sk-...`
(OpenAI / Stripe / etc.), no `xoxb-` / `xoxp-` (Slack), no `ghp_` /
`github_pat_` (GitHub) — `grep -Eni 'BEGIN|PRIVATE KEY|AKIA|sk-|xoxb-|xoxp-|ghp_|github_pat|secret|password|api[_-]?key'`
across the diff returns zero matches.

### 4. JSON parsing safety — PASS (noted)

`JSON.parse(fs.readFileSync(..., "utf-8"))` (test lines 55, 85, 105, 146) is
applied only to **local, repo-tracked, trusted** fixture files under
`demo-data/scenarios/partd-approvable/`. No network input, no user input,
no `eval`, no `Function(...)` constructor. A malformed fixture would throw
a `SyntaxError` and fail the test loudly, which is the correct failure
mode. No prototype-pollution surface — the test reads properties with
bracket notation against a `Record<string, unknown>` cast and never spreads
the parsed object into another object. Safe by inspection.

### 5. Test data integrity / supply-chain (URLs) — PASS

All four URLs in the fixtures resolve to expected public reference sources:

- `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=...` — NIH
  DailyMed FDA label entry. Expected (FDA-label-indication reference).
- `https://www.cms.gov/medicare/prescription-drug-coverage/formulary/downloads/S5810-001_formulary.zip`
  (appears twice — packet.json line 16, payer-profile.json line 8) — CMS
  Part D formulary download. Expected (formulary-entry + formularyRelease
  sourceUrl).
- `https://www.costplusdrugs.com/medications/adalimumab-40mg-08ml/` — Mark
  Cuban Cost Plus public retail price page. Expected (price-benchmark
  reference for the R24 cost-band rule, called out in expected-outcome.md).

No bit.ly / t.co / IP-literal / file:// / unexpected-domain URLs. No URLs
pointing at attacker-controllable infrastructure. Each URL is paired with a
`contentHash` field that — once swapped from the empty-bytes placeholder to
the real keccak via `scripts/pin-formulary.ts` — will provide
content-integrity binding against cache poisoning at pin time. The v0
placeholder leaves the supply-chain binding **unenforced today**; this is
acknowledged in the inline `_note` field and is out-of-scope for tick 8
(no findings at this scope).

## Overall verdict

**PASS — zero findings.** The six-file diff is fixtures + a schema test; no
new code paths, no new dependencies, no new network/IO surfaces beyond local
trusted-fixture reads, no private keys, no credentials, no PHI. The
synthetic note is clearly fabricated and contains zero HIPAA-identifier
patterns; the test enforces those same patterns as regression guards. The
keccak256 placeholders are the documented well-known empty-bytes hash, with
a real-pinning plan called out in-file. All four URLs are expected public
reference sources (DailyMed, CMS, costplusdrugs). UNIT-3 ships clean.

---

# Security findings — tick 4 (UNIT-2)

**Verdict:** PASS (0 findings)

## Findings

None.

## Notes

Reviewed the uncommitted UNIT-2 diff against
`contracts/contracts/CoverageNegotiation.sol`,
`contracts/test/CoverageNegotiation.test.ts`, `src/contract/simulated.ts`, and
`src/contract/simulated.auth.test.ts`. All six focused security checks pass.

1. **R14a tightening — no DoS surface.** `appeal()` now requires
   `n.state == State.Denied` (line 436). The only writer of `State.Denied` is
   `handleResponse` (line 655), and that function is gated by
   `require(msg.sender == address(platform), "callback: not platform")` at
   line 571. No party-controlled path can flip the state to Denied or away
   from Denied to grief an appellant — the predicate is set exclusively by
   the trusted Somnia agent platform via its consensus-encoded ruling. There
   is no alternate entry point: `_get(reqId)` is a read-only fetch and
   `_onlyParty(n)` runs after the state check, so the state gate is the sole
   entry-state predicate on `appeal()`. The cap-deadlock short-circuit
   (`n.round >= maxRounds`, line 445) still runs AFTER the state check, so an
   Approved state cannot be deadlocked via `appeal()` — the R14a revert fires
   first. No new revert paths consume caller ETH: the revert is a
   pre-state-effects `require`, so `msg.value` rolls back with the tx. The
   T10 wrong-state test was updated to expect the new error string.

2. **R2b rejection — no DoS or bypass surface.**
   `require(providerAddr != insurerAddr, "create: self-contract")` at line 323
   sits after parameter validation (`addr: zero`, `auth: not provider`,
   `qty: zero`) and BEFORE `_nextId++` (line 325) and any struct writes — no
   state effects to roll back, CEI-clean. A frontrunner submitting
   `createContract(provider, provider)` would revert their own tx without
   affecting any other party's create flow (each call atomically creates a
   fresh `reqId`). The check is an address-equality predicate, not a
   shared-key predicate; a party controlling two distinct wallets can still
   create a contract between them, but R2b is explicitly scoped to address
   equality (a coverage-policy-design choice, not a key-control one) and that
   limitation is acknowledged in the spec. The T9 multi-tenant test that
   exercised the now-removed single-shared-wallet path was updated to assert
   the revert instead.

3. **PacketSubmitted event — no PHI leakage.** The new event signature
   (lines 199-204) carries `uint256 indexed reqId`, `uint256 indexed round`,
   `bytes32 packetRoot`, `bytes32 packetUrl`. At emit time both `packetRoot`
   and `packetUrl` are set to `n.evidenceUri` (line 776), which is a
   `bytes32` opaque ref (line 107). The contract's PHI invariant (line 52:
   "Only keccak256 hashes, opaque refs (bytes32), amounts, and settlement"
   on-chain) is preserved — `evidenceUri` is already emitted in
   `ContentCommitted`, `EvidenceSubmitted`, and `Appealed` events, so this
   adds no new disclosure surface. SPEC-0004 R3/R4 invariant intact.

4. **Event ordering / CEI.** `PacketSubmitted` is emitted at line 776, AFTER
   all state effects (`n.totalFees`, `n.rulingDeadline`, `n.state =
   UnderReview` at lines 764-768) and BEFORE the external
   `platform.createRequest` call at line 785. If `platform.createRequest`
   reverts, the entire tx reverts including the event — observers cannot see
   a PacketSubmitted that does not correspond to a successful fire. The
   `nonReentrant` guard on all three callers (`requestAdjudication`,
   `submitEvidence`, `appeal`) blocks a reentrant double-emit during the
   external call. CEI preserved.

5. **`n.round` correctness at emit.** Each of the three `_fireAgent` call
   sites sets `n.round` to the round being requested BEFORE invoking
   `_fireAgent`: `requestAdjudication` sets `n.round = 1` at line 378 and
   fires at line 380; `submitEvidence` does `n.round += 1` at line 412 and
   fires at line 414; `appeal` does `n.round += 1` at line 458 and fires at
   line 461. The new test (line 244) asserts emit with `round` 1/2/3 across
   the three paths — confirms the invariant under exercise.

6. **simulated.ts parity — error strings match exactly.** The simulated
   backend mirrors both R14a and R2b. Grep for the new error strings
   confirms exact match between Solidity and TS: `"create: self-contract"`
   (Sol line 323 ↔ sim line 217 ↔ sim test line 137) and
   `"appeal: prior ruling not Deny"` (Sol line 436 ↔ sim line 322).
   `simulated.ts` lowercases both addresses before comparison
   (`.toLowerCase()` on each side at line 216), which correctly handles
   checksummed-vs-unchecksummed address inputs at the TS boundary while
   preserving the Solidity contract's bytewise-equality semantics (Solidity
   `address` equality is canonical-form-agnostic). The T10 wrong-state
   expectation in the contract test (line 758) was updated to the new error
   string; no stale `"appeal: not ruled"` references remain in either test
   file (the simulated.auth.test.ts removed the single-shared-wallet
   happy-path entirely and replaced it with a revert assertion).

Out-of-scope confirmations: no new external calls beyond the existing
`platform.createRequest` (PacketSubmitted is event-only); no new storage
slots; no new modifiers; no new external entry points; no ABI changes
(PacketSubmitted is additive — does not alter existing event signatures).
The diff is minimally invasive, exactly UNIT-2 scope.

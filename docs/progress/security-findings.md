# Security findings — 2026-05-29 tick 12 (revertReasonMap + useAction hook + PacketSubmitted UI label)

**Verdict:** PASS (0 findings)

## Diff scope

1. **NEW** `src/protocol/revertReasonMap.ts` (286 lines) — pure-data
   mapping of contract revert strings to user-facing copy. Exports the
   `RevertReason` string union, the frozen `REVERT_REASON_MAP` record,
   and the lookup function `mapRevertReason(reasonRaw)`. No I/O, no
   network, no dynamic code, no dependencies beyond the type-only
   alias re-export.
2. **NEW** `src/protocol/revertReasonMap.test.ts` (143 lines) —
   `node:test` + `node:assert/strict` asserting 9 invariants over the 5
   baseline revert strings called out by the loop-state.md SPEC-0003
   R16 acceptance criterion (`engage: not Open`, `adjudicate: not
   Ready`, `fee: underfunded`, `auth: not a party`, `appeal: needs
   evidence`): presence, non-empty headline/details, lookup correctness,
   undefined-input fallback, unknown-input fallback embeds raw, map is
   frozen, headline ≤ 80 chars, details ≥ 30 chars, headline ≠ raw key.
3. **NEW** `web/src/hooks/useAction.ts` (90 lines) — React hook
   wrapping an async write `fn` with `pending` (boolean), `error`
   (`RevertReasonEntry | null`), and `run` (re-invokes `fn`). Uses
   `useState` for the two render-visible fields and a `useRef`
   (`inFlightRef`) for the in-flight guard. Hard-rejects concurrent
   `run()` while pending with `throw new Error("in-flight")`. Calls
   `mapRevertReason` on the extracted raw revert string from caught
   errors. The local `extractRevertReason` helper probes ethers v6
   `.reason`, generic `.message`, and viem/wagmi `.shortMessage` in
   order.
4. **MODIFIED** `web/src/shared.ts` — single-line addition (line 31)
   of the missing `PacketSubmitted` case to `describeEvent`'s switch.
   Renders `round`, `shortHex(packetRoot)`, and `packetUrl` as plain
   template-string text. Fix for the tick-4 oversight where the event
   union member was added without wiring the UI label (the TS compiler
   already required exhaustive coverage of the union, so this case was
   the missing arm).

## Per-concern verdict

### 1. Information disclosure via revertReasonMap fallback — PASS

The fallback at `revertReasonMap.ts:279-284` embeds the raw revert
string into the user-facing `details` field:

```ts
details: `The contract rejected the transaction. The technical reason
  is shown below.${reasonRaw !== undefined ? ` Raw reason: ${reasonRaw}` : ""}`,
```

A full sweep of every revert string in `contracts/contracts/*.sol` via
`grep -nE 'revert "[^"]*"|require\([^,]+,\s*"[^"]*"'` returns 38
matches. **Every match is a static fixed string literal.** None embed
user input via string concatenation, `string.concat(...)`, `abi.encode`,
`Strings.toString(uint)`, `Strings.toHexString(address)`, or any
other dynamic-string call. The complete revert vocabulary (matched 1:1
against `RevertReason` in `revertReasonMap.ts:4-50`):

`maxRounds: < 1`, `funds: zero addr`, `funds: insufficient`, `funds:
transfer failed`, `addr: zero`, `auth: not provider`, `qty: zero`,
`create: self-contract`, `engage: not Open`, `auth: not insurer`,
`policy: empty`, `adjudicate: not Ready`, `evidence: wrong state`,
`evidence: empty`, `fee: refund failed`, `appeal: prior ruling not
Deny`, `appeal: unknown party`, `appeal: needs evidence`, `accept: not
ruled`, `settle: not ruled`, `settle: not both accepted`, `auth: not
provider`, `refuse: not refusable`, `withdraw: terminal`, `timeout: not
UnderReview`, `timeout: too early`, `feedback: terminal`, `callback:
not platform`, `callback: unknown request`, `callback: not UnderReview`,
`fee: underfunded`, `unknown contract`, `auth: not a party`.

No revert string contains an address, an amount, a `bytes32` value, a
clinical identifier, a salt, a hash, or any sender-controlled
parameter. Worst case: a future contract change introduces a
dynamic-string revert that surfaces an address — and the fallback
would render it, but addresses are public on-chain data and not
sensitive. **No PHI surface, no key surface, no private-state surface
in the current revert vocabulary.**

The fallback path is also strictly opt-in to *unknown* revert strings;
all 33 known strings have curated copy that doesn't embed the raw
input. Defense-in-depth: the React rendering side (concern 2) does not
treat the string as HTML, so even if a future revert *did* contain
attacker-controlled characters (`<`, `>`, `"`), they would be
text-escaped at the DOM boundary, not parsed.

### 2. DOM injection in useAction error path — PASS

`useAction` stores the error as a `RevertReasonEntry` object with two
string fields (`headline`, `details`) in `useState`. The hook itself
does **not** render anything — it returns the state to the caller. A
repo-wide grep for `dangerouslySetInnerHTML` across
`web/src/**` returns **zero matches**. The error object will be
rendered by whatever consumer the hook is wired into (no consumer is
added in this tick); React's default `{entry.headline}` and
`{entry.details}` JSX interpolation text-escapes both strings, so a
revert string containing `<script>...</script>` would render as the
literal characters, not parse as HTML. Safe by React's default
escaping; no `dangerouslySetInnerHTML` reachable from this surface.

### 3. Concurrent-run race conditions — PASS

The in-flight guard uses **`useRef`**, not state:

```ts
const inFlightRef = useRef(false);
const run = async (): Promise<T> => {
  if (inFlightRef.current) {
    throw new Error("in-flight");
  }
  inFlightRef.current = true;
  setPending(true);
  setError(null);
  try { return await fn(); }
  ...
  finally {
    inFlightRef.current = false;
    setPending(false);
  }
};
```

JavaScript is single-threaded; the `if (inFlightRef.current)` check
and the immediately-following `inFlightRef.current = true` assignment
run in the **same synchronous turn** of the event loop, before any
`await` is reached. There is no microtask, no `setTimeout`, no DOM
event boundary, and crucially no `await` between the check and the
set. Two synchronous `run()` calls — even from the same
`onClick`-handler chain or from React batched re-renders that fire
multiple effects — cannot both pass the guard: the first call sets
`inFlightRef.current = true` before yielding to the awaited `fn()`,
and the second call sees the ref already set and throws synchronously.

The fact that `inFlightRef` is a ref rather than `useState` is
load-bearing: `useState`'s `setPending(true)` is asynchronous (the
state update is queued for the next render), so a `useState`-only
guard would have a window where two synchronous calls in the same
turn both observe `pending === false` and proceed. The ref's
synchronous mutation closes that window. The `setPending(true)` /
`setPending(false)` calls are purely for **render-visible** state so
the consuming component re-renders to show the disabled-button /
spinner UI; correctness of the guard itself does not depend on them.

The `finally` block correctly clears both the ref and the state
regardless of success or failure, so even an `fn()` that throws
synchronously before yielding still releases the guard. There is no
re-entrant `fn()` path that could call `run()` again synchronously
before the first call returns (`fn` is an arbitrary user-supplied
async function, but the ref is set before `fn()` is invoked, so any
synchronous `run()` call from inside `fn` would still hit the
guard). No race window present.

### 4. PacketSubmitted UI label — text-only rendering of on-chain data — PASS

The new switch arm at `web/src/shared.ts:31` renders three fields
from the event: `e.round`, `shortHex(e.packetRoot)`, and
`e.packetUrl`. Per SPEC-0004 §3.5 and the typed declaration at
`src/types/coverage.types.ts:260-265`, `packetUrl` is currently a
`bytes32` ABI-encoded value carrying the same `evidenceUri` as
`packetRoot` until UNIT-9 lands the Merkle-root + body-store URL —
i.e., it is a 0x-prefixed 66-char hex string, not a free-form URL
today. Even after UNIT-9, the documented intent is a CDN URL.
**Critically, `describeEvent` returns a plain string** that is then
rendered into JSX as `{describeEvent(e)}` (text content), never as
`href={...}`, `src={...}`, `window.open(...)`, or
`dangerouslySetInnerHTML`. A repo-wide grep for `href.*packetUrl`,
`window.open`, and `location.*packetUrl` across `web/src/` returns
zero matches.

`shortHex(packetRoot)` truncates `packetRoot` for compact display.
`packetUrl` is rendered **without** `shortHex`, which means a UNIT-9
URL like `https://packets.example.com/0xabc...` would display in full
inside the parentheses. The task brief explicitly considered
`shortHex(e.packetUrl)` to limit display length and concluded it is
"safe" because the text path doesn't permit HTML injection. Confirmed
by inspection: text-only, no href, no innerHTML, no
attacker-controlled execution surface. **The only "data quality" gap
is cosmetic — a long URL could overflow a narrow timeline cell. Not a
security finding; if the design-handoff branch wants compact display
the call site can adopt `shortHex(e.packetUrl)` later. Out of scope
for tick 12.**

The fields `round`, `packetRoot`, and `packetUrl` are all on-chain
data (validated by the `PacketSubmitted` event signature
`event PacketSubmitted(uint256 indexed reqId, uint256 indexed round,
bytes32 packetRoot, bytes32 packetUrl)` at `src/contract/abi.ts:42`)
— nothing PHI-bearing leaks through this label. SPEC-0004 R1
preserved.

### 5. No new secrets / credentials in the diff — PASS

Across all four touched files:
- `src/protocol/revertReasonMap.ts` — only static English-language
  user copy strings; no `0x` hex literals, no API keys, no tokens,
  no environment-variable reads.
- `src/protocol/revertReasonMap.test.ts` — only the 5 baseline revert
  strings as test inputs plus assertion messages; no secrets.
- `web/src/hooks/useAction.ts` — only the literal `"in-flight"`
  Error message and the field-name probes `"reason"`, `"message"`,
  `"shortMessage"`. No credentials, no URLs, no `process.env`, no
  network calls.
- `web/src/shared.ts` — single line added; no secret material.

Sweep across the diff for `BEGIN|PRIVATE KEY|AKIA|sk-[A-Za-z0-9]|
xoxb-|xoxp-|ghp_|github_pat|secret|password|api[_-]?key|mnemonic|
seed phrase` returns zero matches. No `.env` reads, no `process.env`
accesses, no `localStorage` / `sessionStorage` writes. Clean.

## Notes

- The hook adds a new client-side surface but no new external calls.
  The wrapped `fn` is supplied by the caller; the hook itself never
  reaches the network or chain.
- The `mapRevertReason` fallback is currently the **only** path that
  reflects an externally-influenced string back to the UI. Because
  every contract revert string is a static literal, the
  attacker-controlled surface is empty today.
- Recommended (advisory, not blocking): if a future contract revision
  introduces a `string.concat`-style revert string carrying an
  address or amount, audit the fallback's `details` template at
  pre-merge time to confirm no sensitive context is being surfaced.
  Until then, the fallback is the correct UX choice (transparency
  over silence).
- The `useAction` hook fixes the missing in-flight guard called out by
  SPEC-0003 R13/R14. The hard-reject semantics (vs. coalesce-to-existing-promise)
  is the safer choice given that the caller may pass a different
  `fn` closure on each render: coalescing would silently substitute
  a stale closure's result for the new caller's expectations.

## Overall verdict

**PASS — zero findings.** The four-file diff adds two pure-data
modules (revertReasonMap + its test), one client-side hook with a
correctly-implemented synchronous in-flight guard, and a one-line
exhaustive-switch fix in the timeline labeller. Every contract revert
string is a static literal, so the `mapRevertReason` fallback cannot
disclose dynamic sensitive data; React's default JSX escaping
neutralises the DOM-injection concern; the `useRef`-backed in-flight
guard has no async window between check-and-set; and the
PacketSubmitted UI label renders on-chain data as plain text (no
href, no innerHTML, no XSS surface). No new dependencies, no new
external calls, no new credentials, no PHI exposure. Tick 12 ships
clean.

---

# Security findings — 2026-05-29 tick 11 (scenarioFixtures.test-helpers extraction + R6b prose narrowing)

**Verdict:** PASS (0 findings)

## Diff scope

1. **NEW** `src/protocol/scenarioFixtures.test-helpers.ts` (123 lines) —
   four named exports (`assertNoPHI`, `loadScenarioFile`, `assertPacketShape`,
   `assertRequestedDrugShape`) consolidating the per-test inline checks from
   the three UNIT-3 scenario test files.
2. Refactor of `src/protocol/scenarios.partd-approvable.test.ts`,
   `scenarios.commercial-policy-void.test.ts`, and
   `scenarios.medicaid-denied-then-appealed.test.ts` to import the four
   helpers in lieu of duplicated inline regex / shape assertions. Test
   semantics, fixture inputs, and assertion failure modes unchanged.
3. `docs/specs/0001-mvp0-coverage-negotiation.md` — R6b prose narrowed to
   reflect amendment 0005 (R6b now defers to SPEC-0004 §2.6 R23 for the
   on-label policy-void rule). `Ruled` event signature gains
   `policyVoidedClauseIndices` field, and the §3.4 state-transition table
   row for `PolicyInvalidated` narrows the entry condition. No executable
   change to contract or simulated backend.

## Per-concern verdict

### 1. Path traversal in `loadScenarioFile(slug, filename)` — PASS

The helper resolves the fixture path with
`path.resolve(REPO_ROOT, "demo-data", "scenarios", slug, filename)` (line
59). Because `path.resolve` accepts and follows `..` segments,
`slug = "../.."` or `filename = "../../package.json"` would let a caller
escape the `demo-data/scenarios/` subtree and read any file under
`REPO_ROOT` (or above, since `REPO_ROOT` is computed by walking two parents
up from the source file at line 6 and resolves into the project root).

**Why this is acceptable in tick 11:** the helper is a `.test-helpers.ts`
file imported only by the three UNIT-3 `*.test.ts` files in
`src/protocol/`. Every call site in this tick passes a hardcoded literal
slug (`"partd-approvable"`, `"commercial-policy-void"`,
`"medicaid-denied-then-appealed"`) and a hardcoded literal filename
(`"note.md"`, `"packet.json"`, etc.) — no test-runtime, network, or
filesystem-derived value reaches the helper. Verified by grepping the
three refactored files: the `SLUG` constant in each is a string literal,
and the second arg to every `loadScenarioFile(...)` call is a string
literal. The helper is wired into Node's test runner only
(`node --import tsx --test "src/**/*.test.ts"`) — there is no HTTP
endpoint, RPC handler, on-chain interface, or build-time consumer that
funnels untrusted input into the helper. Severity is therefore **low (no
exploitable vector in the shipped surface)**.

**Recommended hardening (tracked but NOT a tick-11 blocker):** before
this helper grows a non-test consumer (or before any future scenario
ingestion path accepts user-controlled slugs), add a slug allowlist
(reject `slug` if it does not match `/^[a-z0-9-]+$/` or if `filename`
contains `..`) and assert
`resolvedPath.startsWith(path.resolve(REPO_ROOT, "demo-data", "scenarios"))`.
For tick 11 the missing guard is a contract-level documentation gap, not
a security finding. Recording as advisory only.

### 2. `assertNoPHI` regex-set parity with the inlined originals — PASS

Diffed the helper's seven assertions (lines 14-51) against the inline
regex blocks removed from each of the three refactored test files. All
seven patterns match exactly, character-for-character, in the same order
and with the same flags:

| # | Pattern | Helper line | Original inline location |
|---|---------|-------------|--------------------------|
| 1 | `/\bSSN\b\s*[:#]?\s*\d{3}/i` | 17 | partd line 38 / void line 38 / medicaid line 38 |
| 2 | `/\d{3}-\d{2}-\d{4}/` | 22 | partd line 39 / void line 39 / medicaid line 39 |
| 3 | `/\b\d{2}\/\d{2}\/\d{4}\b/` | 27 | partd line 40 / void line 40 / medicaid line 40 |
| 4 | `/[A-Z]{2}\d{6,}/` | 32 | partd line 41 / void line 41 / medicaid line 41 |
| 5 | `/\b(?:\(\d{3}\)\s?\|\d{3}[-.])\d{3}[-.\s]?\d{4}\b/` | 37 | partd lines 43-47 / void / medicaid |
| 6 | `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/` | 42 | partd lines 48-52 / void / medicaid |
| 7 | `/\bMRN\s*[:#]?\s*\d{7,}\b/i` | 47 | partd lines 53-58 / void / medicaid |

The HTML-comment stripping (`content.replace(/<!--[\s\S]*?-->/g, "")`,
line 15) also matches the original inline `stripped =
content.replace(/<!--[\s\S]*?-->/g, "")` pattern in every test. No regex
drift; no semantic drift. The original per-test `fileLabel` strings
(`"note.md"`, `"expected-outcome.md"`) are now passed in by the caller
rather than inlined into the failure-message templates, but the resulting
assertion messages are equivalent. R1 coverage is preserved.

### 3. Hardcoded secrets / sensitive constants in helper — PASS

Grep across `scenarioFixtures.test-helpers.ts`:
- Zero matches for `0x[0-9a-fA-F]{40,}` literal strings (the `0x + 64
  hex` and `0x + 40 hex` patterns appear only inside regex character
  classes at lines 87 and 99, used for **validating** packet
  `contentHash` and `submittedBy` shape — neither is a hardcoded value).
- Zero matches (case-insensitive) for `api_key`, `apikey`, `secret`,
  `token`, `password`, `bearer`, `private`, `mnemonic`, or `seed`.
- No `.env` reads, no `process.env` accesses, no network calls, no
  dynamic `require`/`import`.

The helper's only filesystem entry point is the `readFileSync` at line
60 (covered under concern 1); the only I/O is reading the named scenario
fixture file as UTF-8. Nothing in the helper writes to disk, opens
sockets, spawns child processes, or evaluates dynamic code.

### 4. R6b prose change — security claim audit — PASS

The R6b narrowing in `docs/specs/0001-mvp0-coverage-negotiation.md` is a
prose-only documentation edit. It cross-references amendment
`docs/amendments/0005-policy-void-r23-supersedes-r6b.md` (which was
landed in tick 9) and aligns the §2 requirement text with the §3.4
state-transition row and the `Ruled` event signature. The edit:
- Adds a `policyVoidedClauseIndices: number[]` field to the documented
  `Ruled(reqId, requestId, decision, coveredAmount, rationaleHash,
  clauseRef, receiptId, policyVoidedClauseIndices)` event signature
  (line 116 of the spec). No matching change in
  `contracts/contracts/CoverageNegotiation.sol` is made in this tick —
  the contract still emits the pre-amendment `Ruled` event signature.
  This is a **known spec/code drift recorded by amendment 0005**, not a
  security claim about runtime behaviour, and the spec's amendment
  callout flags it explicitly ("Narrowed by amendment …; SPEC-0004 §2.6
  R23 is now the canonical on-label policy-void rule"). The drift is
  scheduled to be closed in a later UNIT once the contract is regenerated
  to emit the extended event.
- Narrows the state-transition row for `PolicyInvalidated` from "any
  relied-on clause non-compliant" to "every policy clause consulted is
  non-compliant; meta-policy failure" (line 130). This is a tightening
  of when the terminal state fires; it cannot expand attacker surface,
  only contract it.
- Does NOT assert any new contract-enforced security property. There is
  no "the contract enforces X" claim in the new prose that lacks contract
  backing — the prose explicitly states the narrowed `PolicyInvalidated`
  is **retained but rare in v0** and **may be removed in v1**, and that
  the canonical on-label rule lives in SPEC-0004 §2.6 R23. No
  security-relevant integrity claim hangs on the edit.

R1 (no clinical data on-chain) is untouched. R6a (deterministic covered
amount = `min(requested, benchmarkCap)`) is untouched. R6c (bounded N
rounds appeal) is untouched. R11 (party-action gating) is untouched.
The amendment-aware narrowing leaves every security invariant in the
spec intact.

## Notes

- No new dependencies, no new external calls, no new ABI changes, no
  new on-chain disclosure surface.
- `src/contract/` is unmodified in tick 11 — the spec narrowing is a
  prose-only forward reference to amendment 0005, with the implementation
  change deferred per the existing amendment plan.
- The three refactored test files retain their pre-refactor `scenarioFile()`
  local helper for `fs.existsSync` probes; this preserves the
  test-failure messages that quote the full filesystem path on missing
  fixtures. No regression in error reporting.
- Recommended (advisory, not blocking): when this helper is reused
  outside the test surface, add the slug-allowlist + prefix-startsWith
  guard described under concern 1.

---

# Security findings — 2026-05-29 tick 10 (UNIT-3c medicaid-denied-then-appealed fixtures)

**Verdict:** PASS (0 findings)

## Diff scope

Six new files in the worktree (mirror of tick 9, parameterised to the §3.2
Medicaid discriminant + the §2.4 R14a / §2.5 R17 round-0 Deny → round-1
Approve appeal arc):

1. `demo-data/scenarios/medicaid-denied-then-appealed/note.md` — synthetic
   Medicaid PA clinical narrative (Patient C / P-0003 / MRN 000-MED-003 /
   year-only 1978; California Centene Medi-Cal MCO; dulaglutide / T2DM).
2. `demo-data/scenarios/medicaid-denied-then-appealed/packet.json` —
   EvidenceReference packet with three references (DailyMed FDA label for
   Trulicity, DHCS Medi-Cal GLP-1 PA criteria, NADAC price benchmark);
   `submittedBy: 0x0000000000000000000000000000000000000003`.
3. `demo-data/scenarios/medicaid-denied-then-appealed/payer-profile.json` —
   Medicaid profile + §3.2 Medicaid `formularyRelease` discriminant (`line`,
   `state`, `mco`, `revision`, `sourceUrl`, `contentHash`).
4. `demo-data/scenarios/medicaid-denied-then-appealed/requested-drug.json` —
   NDC/RxNorm/dose record for dulaglutide 0.75 mg (Trulicity).
5. `demo-data/scenarios/medicaid-denied-then-appealed/expected-outcome.md` —
   round-0 Deny (missing SGLT2-i trial evidence) → round-1 Approve
   (empagliflozin intolerance documented) narrative.
6. `src/protocol/scenarios.medicaid-denied-then-appealed.test.ts` —
   `node:test` + `node:assert` schema tests over the five fixture files (8
   sub-tests, mirrors `scenarios.commercial-policy-void.test.ts` with the
   §3.2 Medicaid discriminant + a positive R6c/R14a Deny-then-Approve
   header-line invariant).

## Per-concern verdict

### 1. PHI leakage in note.md and expected-outcome.md (SPEC-0004 R1) — PASS

`note.md` is clearly synthetic. The patient is referred to as "Patient C"
(line 10) under an explicitly-labelled "Synthetic patient identifier: P-0003
/ MRN 000-MED-003" header (line 3). The MRN `000-MED-003` is a
synthetic-shaped token (leading zeros, payer-line tag "MED", sequence "003")
and contains no run of 7+ contiguous digits — it cannot be confused for a
real MRN. The only date marker is "Year of birth: 1978" (line 4), which is
an HIPAA Safe-Harbor-permissible year-only value, not a full MM/DD/YYYY
date. City is "Anytown, USA" (line 5 — synthetic placeholder). The
"47-year-old" phrasing (line 10) is a categorical age statement, not an
identifier. Quantitative clinical markers (A1c 7.6%, BMI 34.2, BID dosing,
fill-history months, "10-year ASCVD risk 14%", 90-day SGLT2-i trial window
in expected-outcome.md, 60-day appeal window) are categorical / time-window
references, not patient identifiers. NDC `00002-1433-80` (5-4-2 grouping —
not the 3-3-4 phone shape) and RxNorm CUI `1551291` are publicly-published
drug codes. The DHCS PA criteria slice in packet.json embeds drug names
(empagliflozin, dapagliflozin, canagliflozin, semaglutide, liraglutide,
dulaglutide) and the "96-day" / "two office visits" mentions in
expected-outcome.md are part of the synthetic clinical narrative, not real
encounter records. A direct regex sweep across both `note.md` and
`expected-outcome.md` returns **zero** matches for SSN markers
(`\bSSN\b\s*[:#]?\s*\d{3}`), SSN-format digit strings
(`\d{3}-\d{2}-\d{4}`), MM/DD/YYYY DOBs (`\b\d{2}/\d{2}/\d{4}\b`),
driver-license shapes (`[A-Z]{2}\d{6,}`), phone shapes
(`\b(?:\(\d{3}\)\s?|\d{3}[-.])\d{3}[-.\s]?\d{4}\b`), email shapes, and
real-shaped MRNs (`\bMRN\s*[:#]?\s*\d{7,}\b`).

The test at lines 26–63 codifies these same PHI-marker checks and is
applied to **both** `note.md` (lines 72–86) **and** `expected-outcome.md`
(lines 88–94) — closing the tick-9 scope expansion where expected-outcome
narrative was authored alongside the note and shares the same exposure.
The note's text passes all of them; the regex sweep at the shell confirms
the same. R1 satisfied.

### 2. Path traversal in the test — PASS (no risk)

`src/protocol/scenarios.medicaid-denied-then-appealed.test.ts` builds
filesystem paths via
`path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")`
(line 19) and then
`path.join(PROJECT_ROOT, "demo-data", "scenarios", "medicaid-denied-then-appealed")`
(line 20). The only variable input is the hard-coded array of five
filenames at line 66 (`["note.md", "packet.json", "payer-profile.json",
"requested-drug.json", "expected-outcome.md"]`) and the literal-string
arguments to `scenarioFile(...)` throughout. **No user-supplied string
flows into any `fs.readFileSync` or `fs.existsSync` call.** The anchor is
derived from `import.meta.url` via `fileURLToPath` (line 19) — a trusted
ESM-runtime value, not external input. No traversal surface.

### 3. Real-key / credential leakage in fixtures — PASS

Full sweep for `0x[0-9a-fA-F]{64}` across the diff returns exactly four
matches, all identical:
`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`
(packet.json lines 5, 17, 29; payer-profile.json line 9). This is the
**well-known keccak256 of the empty byte string** — a deterministic public
constant, not a private key — and is the same v0 placeholder used in the
tick-8 and tick-9 fixtures. It satisfies the `^0x[0-9a-fA-F]{64}$` regex
(test lines 123, 164) without collapsing to a sentinel `0x000...0` that
might be misread as "unset".

The only other `0x` hex string is the synthetic `submittedBy` address
`0x0000000000000000000000000000000000000003` (packet.json line 40) — a
20-byte all-zero+3 EOA placeholder (deliberately distinct from
partd-approvable `...0001` and commercial-policy-void `...0002`,
acknowledged in the task brief as the per-scenario sentinel). Not a real
wallet; explicitly pinned by the test at lines 180–184.

Shell sweep with
`grep -EniIr 'BEGIN|PRIVATE KEY|AKIA|sk-[A-Za-z0-9]|xoxb-|xoxp-|ghp_|github_pat|secret|password|api[_-]?key'`
across all six new files returns **zero** matches. No
`BEGIN ... PRIVATE KEY` blocks, no AWS / OpenAI / Stripe / Slack / GitHub
token prefixes, no `secret` / `password` / `api_key` markers.

### 4. URL allowlist (legitimate public sources) — PASS

All three distinct URLs across the fixtures resolve to expected public
reference sources matching the task brief:

- `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a4c47592-1234-4abc-9def-0123456789ab`
  (packet.json line 4) — NIH DailyMed FDA label entry for dulaglutide.
  Expected (fda-label-indication reference; brief explicitly names
  DailyMed). The setid is a synthetic placeholder GUID shape
  (`...1234-4abc-9def-0123456789ab`) and will be replaced with the real
  DailyMed setid at pin time; using a synthetic GUID rather than a real
  one is the conservative choice for fixture content.
- `https://www.dhcs.ca.gov/provgovpart/pharmacy/Documents/Medi-Cal-GLP1-PA-Criteria-2026-Q2.pdf`
  (packet.json line 16, payer-profile.json line 8) — California
  Department of Health Care Services (the state Medicaid agency that
  oversees the Medi-Cal managed-care line that the Centene MCO operates
  under) on the publicly-served `dhcs.ca.gov` domain. Expected (the brief
  explicitly names `dhcs.ca.gov` or the MCO's published page as
  acceptable for Medicaid formulary; DHCS is the upstream issuer the MCO
  follows). The same URL appears twice (one in the packet slice as the
  citation, one in the payer-profile as the `formularyRelease.sourceUrl`)
  — consistent.
- `https://www.nadac.cms.gov/app/nad-pricing-report.aspx` (packet.json
  line 28) — CMS NADAC (National Average Drug Acquisition Cost) public
  pricing report on the CMS-served `cms.gov` domain. Expected (the brief
  explicitly names `costplusdrugs.com or NADAC` as acceptable price
  references for the §3.4 price-benchmark slice).

No bit.ly / t.co / IP-literal / `file://` / unexpected-domain URLs. No
URLs pointing at attacker-controllable infrastructure. All three URLs are
pinned by the empty-bytes-keccak placeholder `contentHash`, which
`scripts/pin-formulary.ts` is expected to replace with real keccak256
hashes at production-pin time. The v0 placeholder leaves the supply-chain
binding **unenforced today** — inherited risk from tick 8, not introduced
by tick 10.

### 5. JSON parsing safety (test data integrity) — PASS

`JSON.parse(fs.readFileSync(..., "utf-8"))` (test lines 101, 131, 151,
188) is applied only to **local, repo-tracked, trusted** fixture files
under `demo-data/scenarios/medicaid-denied-then-appealed/`. No network
input, no user input, no `eval`, no `Function(...)` constructor. A
malformed fixture would throw a `SyntaxError` and fail the test loudly —
the correct failure mode. No prototype-pollution surface — the test reads
properties with bracket notation against `Record<string, unknown>` casts
and never spreads or `Object.assign`s the parsed object into another.
Safe by inspection.

## Overall verdict

**PASS — zero findings.** Tick 10's six-file diff is fixtures + a schema
test that mirrors tick 9's shape (the synthetic patient identifier is
"Patient C" rather than "B", the MRN tag is MED rather than COMM, the
discriminant is §3.2 Medicaid `{ line, state, mco, revision, sourceUrl,
contentHash }` rather than §3.2 Commercial, the load-bearing scenario is
the §2.4 R14a / §2.5 R17 round-0 Deny → round-1 Approve appeal arc rather
than §2.6 R23 PolicyInvalidated, and the test grows from 6 to 8 sub-tests
to cover both the new PHI-on-expected-outcome.md check and the
Deny-then-Approve header-line invariant — all expected parameterisation).
No new code paths, no new dependencies, no new network/IO surfaces beyond
local trusted-fixture reads. Both synthetic narrative files
(`note.md` and `expected-outcome.md`) are clearly fabricated and contain
zero HIPAA-identifier patterns under direct regex sweep; the test
enforces those same patterns as regression guards across both files. The
keccak256 placeholder is the documented well-known empty-bytes hash,
identical to ticks 8 and 9. All three URLs (DailyMed, dhcs.ca.gov,
nadac.cms.gov) are the legitimate public sources called out in the task
brief. UNIT-3c ships clean.

---

# Security findings — 2026-05-29 tick 9 (UNIT-3b commercial-policy-void fixtures)

**Verdict:** PASS (0 findings)

## Diff scope

Six new files in the worktree (mirror of tick 8, parameterised to the §3.2
Commercial discriminant + the §2.6 R23 PolicyInvalidated scenario):

1. `demo-data/scenarios/commercial-policy-void/note.md` — synthetic Commercial
   PA clinical narrative (Patient B / P-0002 / MRN 000-COMM-002 / year-only 1971).
2. `demo-data/scenarios/commercial-policy-void/packet.json` — EvidenceReference
   packet with three references (DailyMed FDA label, Aetna CPB 0792 policy
   clause, costplusdrugs price benchmark); `submittedBy:
   0x0000000000000000000000000000000000000002`.
3. `demo-data/scenarios/commercial-policy-void/payer-profile.json` — Commercial
   profile + §3.2 Commercial `formularyRelease` discriminant (`line`, `carrier`,
   `product`, `revision`, `sourceUrl`, `contentHash`).
4. `demo-data/scenarios/commercial-policy-void/requested-drug.json` —
   NDC/RxNorm/dose record for etanercept (Enbrel).
5. `demo-data/scenarios/commercial-policy-void/expected-outcome.md` — expected
   PolicyInvalidated ruling narrative (round 0, voided clause index 1).
6. `src/protocol/scenarios.commercial-policy-void.test.ts` — `node:test` +
   `node:assert` schema tests over the five fixture files (6 sub-tests,
   mirrors `scenarios.partd-approvable.test.ts` with the §3.2 Commercial
   discriminant + a positive `slice.kind === "policy-clause"` invariant).

## Per-concern verdict

### 1. PHI leakage (SPEC-0004 R1 — synthetic-only) — PASS

`note.md` is clearly synthetic. The patient is referred to as "Patient B"
(line 10, 41) under an explicitly-labelled "Synthetic patient identifier:
P-0002 / MRN 000-COMM-002" header (line 3). The MRN `000-COMM-002` is a
synthetic-shaped token (leading zeros, payer-line tag "COMM", sequence "002")
and contains no run of 7+ contiguous digits — it could not be confused for a
real MRN. The only date marker is "Year of birth: 1971" (line 4), which is an
HIPAA Safe-Harbor-permissible year-only value, not a full MM/DD/YYYY date.
City is "Anytown, USA" (line 5 — synthetic placeholder). The "55-year-old"
phrasing (line 10) is a categorical age statement, not an identifier. No SSN,
no SSN-shaped digit string (`\d{3}-\d{2}-\d{4}` not present), no
driver's-license-shape (`[A-Z]{2}\d{6,}` not present), no phone numbers, no
email addresses — verified by a regex sweep of the file against each of
those patterns (all empty). NDC `58406-025-34` and RxNorm CUI `214555` are
publicly-published drug codes, not patient identifiers. R1 satisfied.

The test at lines 32–67 codifies these same PHI-marker checks (SSN marker
keyword, SSN-format digits, MM/DD/YYYY DOB, driver-license shape, phone
shapes, email shape, 7+-digit MRN, plus a positive-marker assertion that the
file contains "synthetic" / "fictional" / "Patient B"). The note's text
passes all of them.

### 2. Path traversal in the test — PASS (no risk)

`src/protocol/scenarios.commercial-policy-void.test.ts` builds filesystem
paths via `path.resolve(path.dirname(__filename), "..", "..")` (line 20) and
then `path.join(PROJECT_ROOT, "demo-data", "scenarios",
"commercial-policy-void")` (line 21). The only variable input is the
hard-coded array of five filenames at line 26 (`["note.md", "packet.json",
"payer-profile.json", "requested-drug.json", "expected-outcome.md"]`) and
the literal-string arguments to `scenarioFile(...)` throughout. **No
user-supplied string flows into any `fs.readFileSync` or `fs.existsSync`
call.** `__filename` is derived from `import.meta.url` via `fileURLToPath`
(line 19) — a trusted ESM-runtime value, not external input. No traversal
surface.

### 3. Real-key / credential leakage in fixtures — PASS

Full sweep for `0x[0-9a-fA-F]{64}` across the diff returns exactly four
matches, all identical:
`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`
(packet.json lines 5, 17, 29; payer-profile.json line 9). This is the
**well-known keccak256 of the empty byte string** — a deterministic public
constant, not a private key — and is the same v0 placeholder used in the
tick-8 partd-approvable fixtures. It satisfies the
`^0x[0-9a-fA-F]{64}$` regex (test lines 96, 138) without collapsing to a
sentinel `0x000...0` that might be misread as "unset".

The only other `0x` hex string is the synthetic `submittedBy` address
`0x0000000000000000000000000000000000000002` (packet.json line 40) — a
20-byte all-zero+2 EOA placeholder (deliberately distinct from the
partd-approvable `...0001` so the two scenarios don't collide). Not a real
wallet.

No `BEGIN ... PRIVATE KEY` blocks, no `AKIA...` (AWS), no `sk-...`
(OpenAI / Stripe), no `xoxb-` / `xoxp-` (Slack), no `ghp_` / `github_pat_`
(GitHub), no `secret` / `password` / `api_key` / `api-key` / `apikey`
markers — `grep -EniI 'BEGIN|PRIVATE KEY|AKIA|sk-[A-Za-z0-9]|xoxb-|xoxp-|ghp_|github_pat|secret|password|api[_-]?key'`
across the new files returns zero matches.

### 4. URL allowlist (legitimate public sources) — PASS

All four URLs in the fixtures resolve to expected public reference sources
matching the task brief:

- `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=df6ad4a1-1852-4cf2-93a1-0d78e18a5ebc`
  (packet.json line 4) — NIH DailyMed FDA label entry for etanercept.
  Expected (fda-label-indication reference).
- `https://www.aetna.com/cpb/medical/data/700_799/0792.html`
  (packet.json line 16) — Aetna Clinical Policy Bulletin 0792 on the
  publicly-served aetna.com domain. Expected (policy-clause reference —
  the load-bearing evidence for the PolicyInvalidated ruling per R23).
- `https://www.costplusdrugs.com/medications/etanercept-50mg-ml/`
  (packet.json line 28) — Mark Cuban Cost Plus public retail price page.
  Expected (price-benchmark reference; brief explicitly names
  costplusdrugs.com or NADAC).
- `https://www.aetna.com/individuals-families/find-a-medication/specialty-drugs.html`
  (payer-profile.json line 8) — Aetna specialty-drug list landing page on
  the publicly-served aetna.com domain. Expected (formularyRelease
  `sourceUrl`).

No bit.ly / t.co / IP-literal / `file://` / unexpected-domain URLs. No URLs
pointing at attacker-controllable infrastructure. The two aetna.com URLs
share a top-level domain only and resolve to distinct legitimate document
paths (CPB vs. specialty-drug list); both are pinned by the
empty-bytes-keccak placeholder `contentHash`, which `scripts/pin-formulary.ts`
is expected to replace with real keccak256 hashes at production-pin time.
The v0 placeholder leaves the supply-chain binding **unenforced today** —
inherited risk from tick 8, not introduced by tick 9.

### 5. JSON parsing safety (test data integrity) — PASS

`JSON.parse(fs.readFileSync(..., "utf-8"))` (test lines 74, 104, 124) is
applied only to **local, repo-tracked, trusted** fixture files under
`demo-data/scenarios/commercial-policy-void/`. No network input, no user
input, no `eval`, no `Function(...)` constructor. A malformed fixture would
throw a `SyntaxError` and fail the test loudly — the correct failure mode.
No prototype-pollution surface — the test reads properties with bracket
notation against `Record<string, unknown>` casts and never spreads or
`Object.assign`s the parsed object into another. Safe by inspection.

## Overall verdict

**PASS — zero findings.** Tick 9's six-file diff is fixtures + a schema test
that mirrors tick 8's shape (the synthetic patient identifier is "Patient B"
rather than "A", the MRN tag is COMM rather than PARTD, the discriminant is
§3.2 Commercial rather than §3.2 PartD, and the load-bearing reference is a
`policy-clause` slice rather than a `formulary-entry` slice — all expected
parameterisation). No new code paths, no new dependencies, no new
network/IO surfaces beyond local trusted-fixture reads. The synthetic note
is clearly fabricated and contains zero HIPAA-identifier patterns; the test
enforces those same patterns as regression guards. The keccak256 placeholder
is the documented well-known empty-bytes hash, identical to tick 8. All four
URLs (DailyMed, two aetna.com paths, costplusdrugs.com) are the legitimate
public sources called out in the task brief. UNIT-3b ships clean.

---

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

#!/usr/bin/env bash
#
# Coarse-grained, AAA end-to-end browser tests for the Curie Negotiation Protocol
# MVP0 web app (SPEC-0001 focus #3), driven by agent-browser
# (https://github.com/vercel-labs/agent-browser).
#
# Each scenario drives the REAL UI (clicks/fills/selects via data-testid) and
# asserts on BOTH the rendered DOM and the authoritative on-chain mirror state
# exposed at `window.__curie` (simulated backend). Scenarios are coarse and
# high-coverage rather than many tiny unit checks.
#
# Coverage (AI necessity-arbiter model, SPEC-0001 revised 2026-05-27):
# R4/T1 (no PHI on-chain), R5/T3 (adjudication gated until policy attached),
# R6/R6a (contract-native ruling + deterministic min() covered amount),
# R6b/T5 (non-compliant policy voids → PolicyInvalidated), R7/T7 (provider
# refusal), R8 (settle marker + 50/50 fee), R12/R13/T9 (profile switching /
# shared wallet), R15/R16 (three views + lifecycle + live status), R3 (note
# verification). T10 (eth_getLogs reconstruction) is real-RPC only and is out of
# scope for the simulated run.
#
# Prerequisites (see README.md):
#   - `agent-browser` on PATH (npm i -g agent-browser)
#   - a Chromium/Chrome binary; on Linux ARM64 use Playwright's:
#       npx playwright install chromium  ->  set CHROME_PATH to chrome-linux/chrome
#   - the web app served at $URL (run.sh starts `npm run web:preview` unless
#     SKIP_SERVE=1, in which case it assumes something already serves $URL).
#
# Env knobs:
#   URL          (default http://localhost:4173/)
#   CHROME_PATH  (passed to agent-browser --executable-path when set)
#   AGENT_BROWSER(default "agent-browser")
#   SKIP_SERVE=1 (don't build/serve; test an already-running URL)
#   SKIP_BUILD=1 (serve without rebuilding lib+web first)
#
set -uo pipefail

URL="${URL:-http://localhost:4173/}"
AB="${AGENT_BROWSER:-agent-browser}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

PASS=0
FAIL=0
SERVER_PID=""

# --- agent-browser wrappers -------------------------------------------------

open_args=(--args "--no-sandbox")
[ -n "${CHROME_PATH:-}" ] && open_args=(--executable-path "$CHROME_PATH" "${open_args[@]}")

# Fresh page load -> fresh JS state -> new simulated client (reqId resets).
open_app() { "$AB" "${open_args[@]}" open "$URL" >/dev/null 2>&1; "$AB" wait 250 >/dev/null 2>&1; }
ab()       { "$AB" "$@" 2>/dev/null; }

# Run JS in the page (base64 to dodge shell escaping); strip agent-browser's
# surrounding quotes so primitive results compare cleanly in bash.
ev() {
  local b64 out
  b64="$(printf '%s' "$1" | base64 | tr -d '\n')"
  out="$("$AB" eval -b "$b64" 2>/dev/null | tail -1)"
  out="${out#\"}"; out="${out%\"}"
  printf '%s' "$out"
}

# Robust click via DOM .click() to bypass agent-browser's click semantics
# (which fail to fire React's synthetic onClick for some nested-content
# buttons — verified empirically tick 42 on the policy-card buttons inside
# the engage panel). Eval-based .click() always bubbles, so React handlers
# fire deterministically.
eval_click() {
  ev "(()=>{const e=document.querySelector('[data-testid=$1]');if(!e)return 'not-found';e.click();return 'clicked'})()" >/dev/null
}

# SPEC-0005 R8: switching role returns to Overview. Many scenarios switch
# profile mid-Detail and expect to stay on Detail — mirror the real user
# journey by re-opening the request row after the switch. Argument is the
# request id (e.g. 1) of the row to re-open.
reopen_detail() {
  ev "(()=>{const r=document.querySelector('[data-testid=contract-row][data-reqid=\"$1\"]');if(!r)return 'no-row';r.click();return 'clicked'})()" >/dev/null
  "$AB" wait 150 >/dev/null 2>&1
}

# --- assertions -------------------------------------------------------------

assert_eq() { # desc expected actual
  if [ "$2" = "$3" ]; then echo "  ✓ $1"; PASS=$((PASS + 1));
  else echo "  ✗ $1 — expected [$2] got [$3]"; FAIL=$((FAIL + 1)); fi
}
assert_hidden() { # desc selector
  local out; out="$(ab is visible "$2" | tail -1)"
  case "$out" in
    *true*) echo "  ✗ $1 — element is visible but should be hidden"; FAIL=$((FAIL + 1));;
    *)      echo "  ✓ $1"; PASS=$((PASS + 1));;
  esac
}

# --- on-chain helpers (read the simulated mirror) ---------------------------

state_of()   { ev "(async()=>String(await window.__curie.negotiation.stateOf(${1}n)))()"; }
covered_of() { ev "(async()=>String(await window.__curie.negotiation.coveredAmountOf(${1}n)))()"; }
field_of()   { ev "(async()=>String((await window.__curie.negotiation.getNegotiation(${1}n)).${2}))()"; }

# --- lifecycle --------------------------------------------------------------

cleanup() {
  ab close --all >/dev/null 2>&1 || true
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

start_server() {
  [ "${SKIP_SERVE:-0}" = "1" ] && { echo "SKIP_SERVE=1 — using already-served $URL"; return; }
  if [ "${SKIP_BUILD:-0}" != "1" ]; then
    echo "Building lib + web…"
    # VITE_EXPOSE_TEST_API=1 opts the production preview bundle into the
    # `window.__curie.{negotiation,content,wallet,profiles}` test surface
    # client.ts gates behind this flag (see tick-40 e2e-harness-api-shape).
    ( cd "$REPO_ROOT" && npm run build && VITE_EXPOSE_TEST_API=1 npm run web:build ) >/dev/null 2>&1 \
      || { echo "BUILD FAILED"; exit 2; }
  fi
  echo "Serving $URL …"
  ( cd "$REPO_ROOT" && npm run web:preview ) >/dev/null 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "$URL" && return
    sleep 0.5
  done
  echo "Server did not come up at $URL"; exit 2
}

# ===========================================================================
# Scenario A — full happy-path lifecycle, driven through the UI
#   (R15 three views, R5 engage->Ready, R6 adjudication fires arbiter,
#    R6a deterministic covered = min(requested, cap), R8 settle marker,
#    R16 UI reflects on-chain state)
# ===========================================================================
scenario_happy_path() {
  echo "Scenario A: happy-path lifecycle (file → engage → adjudicate(approve) → accept → settle)"

  # Arrange: fresh app, file a request as the provider.
  open_app
  ab find testid nav-create click >/dev/null
  ab find testid create-note fill "Severe plaque psoriasis; documented failure of methotrexate and topical therapy." >/dev/null
  ab find testid create-drug fill "Adalimumab (RxNorm 1366724)" >/dev/null
  ab find testid create-evidence fill "https://api.fda.gov/drug/label.json?search=openfda.brand_name:HUMIRA" >/dev/null
  ab find testid create-amount fill "5200" >/dev/null
  ab find testid create-quantity fill "2" >/dev/null          # SPEC-0001: quantity drives the cap
  ab find testid create-days-supply fill "28" >/dev/null      # SPEC-0001: necessity context only
  eval_click create-submit
  ab wait 300 >/dev/null

  # Assert: request opened in Open; adjudication NOT possible yet (R5 gate).
  assert_eq "request filed in Open state" "0" "$(state_of 1)"
  assert_hidden "adjudicate hidden before policy attached (R5)" "[data-testid=adjudicate-submit]"

  # Act: switch to insurer, attach the compliant policy -> Ready (R5).
  ab find testid profile-pill-insurer click >/dev/null
  ab wait 200 >/dev/null
  # SPEC-0005 R8: profile switch returns to Overview; re-open the row.
  reopen_detail 1
  eval_click engage-load-compliant
  eval_click engage-submit
  ab wait 300 >/dev/null
  assert_eq "policy attached -> Ready (on-chain)" "1" "$(state_of 1)"
  # Badge text is the user-facing label, not the bare state-machine name
  # ("Policy Attached — Ready for AI" — Detail.tsx renders R16 with friendly copy).
  case "$(ab get text "[data-testid=state-badge]" | tail -1)" in
    *Ready*) echo "  ✓ UI badge reflects Ready (R16)"; PASS=$((PASS + 1));;
    *) echo "  ✗ UI badge reflects Ready (R16) — badge text did not contain 'Ready'"; FAIL=$((FAIL + 1));;
  esac

  # Act: pick decision 'approve' + a Cost Plus unit price of 2100 (cap = 2100 ×
  # quantity 2 = 4200 < requested 5200) and request adjudication -> arbiter fires
  # (R6), auto-resolves ~1.2s -> Approved (SPEC-0001 2026-05-27 per-unit cap).
  # The redesigned UI doesn't surface cost-pegging inputs (sim-runtime concern);
  # poke the SimulatedBackend's mutables via the test API instead (tick 45).
  eval_click decision-approve   # 0 = Decision.Approve
  ev "window.__curie.setNextCostPlusUnitPrice(2100n); 1" >/dev/null
  ev "window.__curie.setNextNadacUnitPrice(2000n); 1" >/dev/null
  eval_click adjudicate-submit
  ab wait 1800 >/dev/null
  assert_eq "approve ruling routes to Approved" "4" "$(state_of 1)"
  # R6a: deterministic covered amount = min(5200, 2100 × 2) = 4200.
  assert_eq "covered = min(requested, costPlus × qty) (R6a)" "4200" "$(covered_of 1)"

  # Act: both parties accept, then settle (R8 event marker + 50/50 fee).
  eval_click accept-submit
  ab wait 200 >/dev/null
  ab find testid profile-pill-provider click >/dev/null
  ab wait 200 >/dev/null
  # SPEC-0005 R8: profile switch returns to Overview; re-open the row.
  reopen_detail 1
  eval_click accept-submit
  ab wait 200 >/dev/null
  eval_click settle-submit
  ab wait 300 >/dev/null
  assert_eq "settled (terminal)" "6" "$(state_of 1)"
}

# ===========================================================================
# Scenario B — no PHI on-chain (R4/T1, the hard invariant)
# ===========================================================================
scenario_no_phi() {
  echo "Scenario B: no PHI on-chain (R4 hard invariant)"
  local token="ZZ_SECRET_PHI_TOKEN_99"

  # Arrange + Act: file a request whose justification contains a unique sentinel.
  open_app
  ab find testid nav-create click >/dev/null
  ab find testid create-note fill "$token — justification body that must never be committed." >/dev/null
  ab find testid create-drug fill "Adalimumab" >/dev/null
  ab find testid create-evidence fill "https://api.fda.gov/drug/label.json?search=HUMIRA" >/dev/null
  ab find testid create-amount fill "5200" >/dev/null
  ab find testid create-quantity fill "2" >/dev/null
  ab find testid create-days-supply fill "28" >/dev/null
  eval_click create-submit
  ab wait 300 >/dev/null

  # Assert: the committed justificationHash verifies against the off-chain note (R3)…
  assert_eq "justification verifies against on-chain hash (R3)" "true" \
    "$(ev "(async()=>{const n=await window.__curie.negotiation.getNegotiation(1n);return String(window.__curie.content.verify('${token} — justification body that must never be committed.', n.justificationHash))})()")"
  # …the sentinel never appears in the serialized on-chain record (R4)…
  assert_eq "sentinel absent from on-chain record (R4)" "true" \
    "$(ev "(async()=>{const n=await window.__curie.negotiation.getNegotiation(1n);const s=JSON.stringify(n,(_,v)=>typeof v==='bigint'?v.toString():v);return String(!s.includes('${token}'))})()")"
  # …and the sentinel is not present anywhere in the DOM after navigation.
  assert_eq "sentinel absent from rendered DOM" "true" \
    "$(ev "String(!document.documentElement.innerHTML.includes('${token}'))")"
}

# ===========================================================================
# Scenario C — adjudication is gated until a policy is attached (R5/T3 guard)
# ===========================================================================
scenario_adjudication_gating() {
  echo "Scenario C: adjudication gated until insurer attaches a policy (R5/T3)"

  # Arrange: a fresh request with no policy attached (still Open).
  open_app
  ab find testid nav-create click >/dev/null
  ab find testid create-note fill "Request for the policy-gating check." >/dev/null
  ab find testid create-drug fill "Etanercept" >/dev/null
  ab find testid create-amount fill "2500" >/dev/null
  eval_click create-submit
  ab wait 300 >/dev/null

  # Act + Assert: adjudication before a policy is attached must revert (guard).
  assert_eq "requestAdjudication before Ready reverts" "reverted" \
    "$(ev "(async()=>{try{await window.__curie.negotiation.requestAdjudication(1n);return 'no-revert'}catch(e){return 'reverted'}})()")"
}

# ===========================================================================
# Scenario C2 — non-compliant policy voids the contract (R6b/T5)
# ===========================================================================
scenario_policy_invalidated() {
  echo "Scenario C2: non-compliant policy -> PolicyInvalidated (R6b)"

  open_app
  ab find testid nav-create click >/dev/null
  eval_click load-sample
  eval_click create-submit
  ab wait 300 >/dev/null

  # Insurer attaches the NON-compliant policy, then adjudicate with policy_invalid.
  ab find testid profile-pill-insurer click >/dev/null
  ab wait 200 >/dev/null
  # SPEC-0005 R8: profile switch returns to Overview; re-open the row.
  reopen_detail 1
  eval_click engage-noncompliant-toggle
  eval_click engage-submit
  ab wait 300 >/dev/null
  # SPEC-0004 §3.5 R23: prime a populated `policyVoidedClauseIndices` so the
  # ruling-meta panel surfaces the new "Voided clauses" row (tick 51 UI).
  # SPEC-0004 §3.5 R11: prime ruling-citation indices too so the "Cited
  # references" row also renders.
  ev "window.__curie.setNextPolicyVoidedClauseIndices([2]); 1" >/dev/null
  ev "window.__curie.setNextUsedReferenceIndices([0, 3]); 1" >/dev/null
  eval_click decision-void   # 3 = Decision.PolicyInvalid
  eval_click adjudicate-submit
  ab wait 1800 >/dev/null
  assert_eq "non-compliant clause -> PolicyInvalidated (terminal)" "8" "$(state_of 1)"

  # SPEC-0002 R3: the gotcha panel renders the struck-through clause beside the
  # FDA-approved indication citation.
  assert_eq "gotcha panel rendered" "true" \
    "$(ev "String(!!document.querySelector('[data-testid=gotcha-panel]'))")"
  case "$(ab get text "[data-testid=gotcha-clause]" | tail -1)" in
    *PD-ADA-09*) echo "  ✓ offending clause shown (struck-through)"; PASS=$((PASS + 1));;
    *) echo "  ✗ offending clause not shown"; FAIL=$((FAIL + 1));;
  esac
  case "$(ab get text "[data-testid=gotcha-fda-citation]" | tail -1)" in
    *psoriasis*) echo "  ✓ FDA indication citation shown"; PASS=$((PASS + 1));;
    *) echo "  ✗ FDA indication citation not shown"; FAIL=$((FAIL + 1));;
  esac

  # SPEC-0004 §3.5 R11 + R23: the tick-51 ruling-meta rows surface the
  # primed sim values once the Ruled event is decoded.
  assert_eq "ruling-meta surfaces R23 voided clauses" "[2]" \
    "$(ab get text "[data-testid=ruling-voided-clauses]" | tail -1)"
  assert_eq "ruling-meta surfaces R11 cited references" "[0, 3]" \
    "$(ab get text "[data-testid=ruling-used-refs]" | tail -1)"
}

# ===========================================================================
# Scenario G — observer / non-party gating (SPEC-0002 R6, SPEC-0001 R11/T9)
# ===========================================================================
scenario_observer() {
  echo "Scenario G: observer can view but not act; non-party attempt rejected (R6/R11)"

  open_app
  ab find testid nav-create click >/dev/null
  eval_click load-sample
  eval_click create-submit
  ab wait 300 >/dev/null

  # Switch to the observer (party 99) and assert mutating actions are hidden.
  ab find testid profile-pill-observer click >/dev/null
  ab wait 200 >/dev/null
  # SPEC-0005 R8: profile switch returns to Overview; re-open the row.
  reopen_detail 1
  assert_eq "active party is observer (99)" "99" "$(ev "String(window.__curie.profiles.getActivePartyId())")"
  assert_hidden "engage hidden for observer" "[data-testid=engage-submit]"

  # The non-party attempt surfaces the contract's R11 gating directly.
  # Observer's profile maps to the providerClient (no separate observer
  # wallet), so a write attempt sees the sim backend's caller=providerAddr,
  # which is neither the insurer nor any other party — fires "auth: not
  # insurer" / "auth: not a party". We call the contract directly via the
  # test API (no UI button needed; this is contract-side R11 verification).
  assert_eq "non-party attempt rejected (R11)" "true" \
    "$(ev "(async()=>{try{const z='0x'+'00'.repeat(32);await window.__curie.negotiation.insurerEngage(1n,z,z);return 'false'}catch(e){return String(/auth:|not insurer|not a party|empty/i.test(String(e.message||e)))}})()")"
}

# ===========================================================================
# Scenario H — CDS-Hooks order-sign prefill (SPEC-0002 R7/T5)
# ===========================================================================
scenario_cds_prefill() {
  echo "Scenario H: mocked CDS Hooks order-sign prefills Create (R7)"

  open_app
  ab find testid nav-create click >/dev/null
  ab find testid cds-prefill click >/dev/null
  ab wait 200 >/dev/null

  case "$(ab get value "[data-testid=create-drug]" | tail -1)" in
    *Adalimumab*) echo "  ✓ CDS prefilled drug"; PASS=$((PASS + 1));;
    *) echo "  ✗ CDS drug not prefilled"; FAIL=$((FAIL + 1));;
  esac
  assert_eq "CDS prefilled quantity" "2" "$(ab get value "[data-testid=create-quantity]" | tail -1)"
  assert_eq "CDS prefilled days supply" "28" "$(ab get value "[data-testid=create-days-supply]" | tail -1)"
  assert_eq "CDS provenance note shown" "true" \
    "$(ev "String(!!document.querySelector('[data-testid=cds-provenance]'))")"
}

# ===========================================================================
# Scenario D — profile switching / single shared wallet (R12/R13/T9)
# ===========================================================================
scenario_profiles() {
  echo "Scenario D: profile switching & shared wallet (R12/R13)"

  open_app
  # Arrange/Assert: simulated wallet mode is shown.
  assert_eq "wallet mode is simulated" "simulated" "$(ab get text "[data-testid=wallet-mode]" | tail -1)"

  local addr1 addr2
  addr1="$(ev "window.__curie.wallet.address")"

  # Act: switch to insurer -> active party id is 2.
  ab find testid profile-pill-insurer click >/dev/null
  ab wait 150 >/dev/null
  # SPEC-0005 R8: profile switch returns to Overview; re-open the row.
  reopen_detail 1
  assert_eq "active party is insurer (2)" "2" "$(ev "String(window.__curie.profiles.getActivePartyId())")"

  # Act: switch to provider -> active party id is 1.
  ab find testid profile-pill-provider click >/dev/null
  ab wait 150 >/dev/null
  # SPEC-0005 R8: profile switch returns to Overview; re-open the row.
  reopen_detail 1
  assert_eq "active party is provider (1)" "1" "$(ev "String(window.__curie.profiles.getActivePartyId())")"

  # Assert: the wallet address is unchanged across switches (one shared wallet — R13).
  addr2="$(ev "window.__curie.wallet.address")"
  assert_eq "single shared wallet across profiles (R13)" "$addr1" "$addr2"
}

# ===========================================================================
# Scenario E — the demo sample case drives the flow (SPEC-0001 §4 / §6)
# ===========================================================================
scenario_sample_case() {
  echo "Scenario E: 'Load sample case' prefills and drives Create (demo-data)"

  # Arrange: fresh app, open Create, load the synthetic sample case.
  open_app
  ab find testid nav-create click >/dev/null
  eval_click load-sample
  ab wait 200 >/dev/null

  # Assert: the fixture's drug + requested amount were prefilled.
  case "$(ab get value "[data-testid=create-drug]" | tail -1)" in
    *Adalimumab*) echo "  ✓ sample drug prefilled"; PASS=$((PASS + 1));;
    *) echo "  ✗ sample drug not prefilled"; FAIL=$((FAIL + 1));;
  esac
  assert_eq "sample requested amount prefilled" "5200" "$(ab get value "[data-testid=create-amount]" | tail -1)"
  assert_eq "sample quantity prefilled" "2" "$(ab get value "[data-testid=create-quantity]" | tail -1)"
  assert_eq "sample days supply prefilled" "28" "$(ab get value "[data-testid=create-days-supply]" | tail -1)"

  # Act + Assert: filing from the sample case opens a request with that amount.
  eval_click create-submit
  ab wait 300 >/dev/null
  assert_eq "sample request filed (Open)" "0" "$(state_of 1)"
  assert_eq "requested amount on-chain" "5200" "$(field_of 1 requestedAmount)"
  assert_eq "quantity on-chain" "2" "$(field_of 1 quantity)"
}

# ===========================================================================
# Scenario F — both-party note verification on the website (R3, §4 deliverable)
# ===========================================================================
scenario_note_verify() {
  echo "Scenario F: verify an off-chain note copy against the on-chain hash (R3)"

  # Arrange: file a request with a known justification, landing on Detail.
  open_app
  ab find testid nav-create click >/dev/null
  ab find testid create-note fill "VERIFY_ME canonical justification body" >/dev/null
  ab find testid create-drug fill "Adalimumab" >/dev/null
  ab find testid create-evidence fill "https://api.fda.gov/drug/label.json?search=HUMIRA" >/dev/null
  ab find testid create-amount fill "5200" >/dev/null
  ab find testid create-quantity fill "2" >/dev/null
  ab find testid create-days-supply fill "28" >/dev/null
  eval_click create-submit
  ab wait 300 >/dev/null

  # Reveal the blockchain-proof block (collapsed by default — the verify panel
  # lives inside it).
  eval_click proof-toggle
  ab wait 100 >/dev/null

  # Act + Assert: the exact copy matches the committed hash…
  ab find testid verify-note-input fill "VERIFY_ME canonical justification body" >/dev/null
  eval_click verify-note-submit
  ab wait 150 >/dev/null
  case "$(ab find testid verify-note-result text | tail -1)" in
    *Matches*) echo "  ✓ matching note verifies against the on-chain hash"; PASS=$((PASS + 1));;
    *) echo "  ✗ matching note failed to verify"; FAIL=$((FAIL + 1));;
  esac

  # …and a tampered copy does not.
  ab find testid verify-note-input fill "tampered note body" >/dev/null
  eval_click verify-note-submit
  ab wait 150 >/dev/null
  case "$(ab find testid verify-note-result text | tail -1)" in
    *"Does not match"*) echo "  ✓ tampered note is rejected"; PASS=$((PASS + 1));;
    *) echo "  ✗ tampered note was not rejected"; FAIL=$((FAIL + 1));;
  esac
}

# ===========================================================================
# Scenario I — persisted DemoUser → top-bar pill + Settings card
#   (SPEC-0005 R10/R11 storage→registry→UI loop; T75b wiring)
#   (SPEC-0005 R12 — same-tab reactive add/remove, no page reload)
# ===========================================================================
scenario_persisted_users() {
  echo "Scenario I: persisted DemoUser → top-bar pill + Settings card (R10/R11/R12)"

  # Clean any prior state so the assertions read the seeded value.
  open_app
  ev "(()=>{localStorage.removeItem('curie:users'); return 'cleared'})()" >/dev/null
  ev "(()=>{localStorage.setItem('curie:users', JSON.stringify([{id:'harness-bob',label:'Harness Bob',role:'insurer',address:'0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'}])); return 'seeded'})()" >/dev/null

  # Reload so client.ts module init re-runs and the persisted user flows
  # through loadUsers() → profileConfig → ProfileRegistry.
  open_app

  # Top-bar role pill for the persisted user must be rendered.
  assert_eq "persisted user appears as a top-bar pill" "true" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-harness-bob]'))")"

  # Settings → Active profile must include the persisted user as a card.
  ab find testid nav-settings click >/dev/null
  ab wait 300 >/dev/null
  case "$(ev "Array.from(document.querySelectorAll('.profile-card .profile-card-label')).map(e=>e.innerText).join('|')")" in
    *Harness*Bob*) echo "  ✓ persisted user appears as a Settings card"; PASS=$((PASS + 1));;
    *) echo "  ✗ persisted user missing from Settings cards"; FAIL=$((FAIL + 1));;
  esac

  # ---- R12: add a user via Settings → pill row updates WITHOUT reload. ----
  # Fill the add-user form, submit, then immediately re-query the top-bar.
  ev "(()=>{const el=document.querySelector('[data-testid=users-add-label]');const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;setter.call(el,'Harness Carla');el.dispatchEvent(new Event('input',{bubbles:true}));return 'set-label'})()" >/dev/null
  ev "(()=>{const el=document.querySelector('[data-testid=users-add-address]');const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;setter.call(el,'0xcccccccccccccccccccccccccccccccccccccccc');el.dispatchEvent(new Event('input',{bubbles:true}));return 'set-addr'})()" >/dev/null
  ev "(()=>{const el=document.querySelector('[data-testid=users-add-role]');const setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;setter.call(el,'observer');el.dispatchEvent(new Event('change',{bubbles:true}));return 'set-role'})()" >/dev/null
  ev "(()=>{document.querySelector('[data-testid=users-add-submit]').click();return 'submitted'})()" >/dev/null
  ab wait 200 >/dev/null
  assert_eq "R12: new pill appears without reload" "true" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-harness-carla]'))")"

  # ---- R12: remove the user → pill row drops it WITHOUT reload. ----
  ev "(()=>{document.querySelector('[data-testid=users-remove-harness-carla]').click();return 'removed'})()" >/dev/null
  ab wait 200 >/dev/null
  assert_eq "R12: pill removed without reload" "false" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-harness-carla]'))")"

  # Cleanup so subsequent runs start from a known state.
  ev "(()=>{localStorage.removeItem('curie:users'); return 'cleared'})()" >/dev/null
}

# ===========================================================================
# Scenario J — demo-mode quick-switch hides + restores the legacy seed pills
#   (SPEC-0005 R13)
# ===========================================================================
scenario_demo_mode() {
  echo "Scenario J: demo-mode toggle hides/shows legacy seed pills (R13)"

  # Reset to known state: demoMode unset (defaults ON), no custom users.
  open_app
  ev "(()=>{localStorage.removeItem('curie:demoMode'); localStorage.removeItem('curie:users'); return 'cleared'})()" >/dev/null
  open_app

  # With demoMode default ON, the legacy seed pills are rendered.
  assert_eq "default demoMode ON: provider pill rendered" "true" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-provider]'))")"
  assert_eq "default demoMode ON: insurer pill rendered" "true" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-insurer]'))")"

  # Toggle OFF via the Settings panel (no page reload).
  ab find testid nav-settings click >/dev/null
  ab wait 250 >/dev/null
  assert_eq "Settings: demo-mode toggle starts ON" "on" \
    "$(ev "document.querySelector('[data-testid=demo-mode-toggle]').getAttribute('data-state')")"
  ev "(()=>{document.querySelector('[data-testid=demo-mode-toggle]').click();return 'toggled'})()" >/dev/null
  ab wait 200 >/dev/null
  assert_eq "Settings: demo-mode toggle flipped OFF" "off" \
    "$(ev "document.querySelector('[data-testid=demo-mode-toggle]').getAttribute('data-state')")"

  # Seed pills must disappear from the top bar without a reload.
  assert_eq "demoMode OFF: provider pill hidden" "false" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-provider]'))")"
  assert_eq "demoMode OFF: insurer pill hidden" "false" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-insurer]'))")"

  # Toggle back ON; seed pills reappear.
  ev "(()=>{document.querySelector('[data-testid=demo-mode-toggle]').click();return 'toggled'})()" >/dev/null
  ab wait 200 >/dev/null
  assert_eq "demoMode ON again: provider pill restored" "true" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-provider]'))")"

  # Persistence across reload: flip OFF, reload, OFF survives.
  ev "(()=>{document.querySelector('[data-testid=demo-mode-toggle]').click();return 'toggled'})()" >/dev/null
  ab wait 100 >/dev/null
  open_app
  assert_eq "demoMode OFF persists across reload" "false" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-provider]'))")"

  # Cleanup.
  ev "(()=>{localStorage.removeItem('curie:demoMode'); return 'cleared'})()" >/dev/null
}

# ===========================================================================
# Scenario K — Settings → Users key-paste derives the address (SPEC-0005 R11)
#   Uses the well-known privkey 0x11..11 → 0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A.
#   Asserts: derived address auto-fills, address field becomes read-only,
#   submit persists the derived address (not the key).
# ===========================================================================
scenario_key_paste_derives() {
  echo "Scenario K: key-paste derives address (R11)"

  open_app
  ev "(()=>{localStorage.removeItem('curie:users'); return 'cleared'})()" >/dev/null
  open_app
  ab find testid nav-settings click >/dev/null
  ab wait 250 >/dev/null

  # Fill label.
  ev "(()=>{const el=document.querySelector('[data-testid=users-add-label]');const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;setter.call(el,'Key-Paste Bob');el.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()" >/dev/null

  # Paste the well-known privkey.
  ev "(()=>{const el=document.querySelector('[data-testid=users-add-key]');const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;setter.call(el,'0x1111111111111111111111111111111111111111111111111111111111111111');el.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()" >/dev/null
  ab wait 100 >/dev/null

  # The address field's *displayed value* must match the derived address.
  assert_eq "R11: address auto-derives from pasted key" \
    "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A" \
    "$(ev "document.querySelector('[data-testid=users-add-address]').value")"

  # The address field becomes read-only while the key is present.
  assert_eq "R11: address field is read-only when key is set" "true" \
    "$(ev "String(document.querySelector('[data-testid=users-add-address]').readOnly)")"

  # Submit; the persisted DemoUser must carry the derived address — and
  # nothing in localStorage may contain the private key.
  ev "(()=>{document.querySelector('[data-testid=users-add-submit]').click();return 'ok'})()" >/dev/null
  ab wait 200 >/dev/null
  assert_eq "R11: derived pill present after submit" "true" \
    "$(ev "String(!!document.querySelector('[data-testid=profile-pill-key-paste-bob]'))")"
  assert_eq "R11: persisted address matches derived" \
    "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A" \
    "$(ev "JSON.parse(localStorage.getItem('curie:users'))[0].address")"
  assert_eq "R11: private key NOT persisted under curie:users" "false" \
    "$(ev "String((localStorage.getItem('curie:users')||'').includes('0x1111111111111111111111111111111111111111111111111111111111111111'))")"

  # Invalid key keeps the address field editable (length 10 hex — too short).
  ev "(()=>{document.querySelector('[data-testid=users-remove-key-paste-bob]').click();return 'ok'})()" >/dev/null
  ab wait 150 >/dev/null
  ev "(()=>{const el=document.querySelector('[data-testid=users-add-key]');const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;setter.call(el,'0x1111111111');el.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()" >/dev/null
  ab wait 100 >/dev/null
  assert_eq "R11: invalid key keeps address editable" "false" \
    "$(ev "String(document.querySelector('[data-testid=users-add-address]').readOnly)")"

  # Cleanup.
  ev "(()=>{localStorage.removeItem('curie:users'); return 'cleared'})()" >/dev/null
}

# --- main -------------------------------------------------------------------

start_server
echo "Running agent-browser E2E suite against $URL"
echo

scenario_happy_path;          echo
scenario_no_phi;              echo
scenario_adjudication_gating; echo
scenario_policy_invalidated;  echo
scenario_profiles;            echo
scenario_sample_case;         echo
scenario_note_verify;         echo
scenario_observer;            echo
scenario_cds_prefill;         echo
scenario_persisted_users;     echo
scenario_demo_mode;           echo
scenario_key_paste_derives;   echo

echo "──────────────────────────────────────────"
echo "agent-browser E2E: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1

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
# Coverage: R4/T1 (no PHI on-chain), R5/T3 (dispute gated until Ready),
# R6 (contract-native ruling), R8/T5 (settle within band), R12/R13/T9 (profile
# switching / shared wallet), R14/R15/T8 (three views + lifecycle), R16 (live
# status from events). T10 (eth_getLogs reconstruction) is real-RPC only and is
# out of scope for the simulated run.
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

state_of()  { ev "(async()=>String(await window.__curie.negotiation.stateOf(${1}n)))()"; }
agreed_of() { ev "(async()=>String((await window.__curie.negotiation.getNegotiation(${1}n)).agreedAmount))()"; }

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
    ( cd "$REPO_ROOT" && npm run build && npm run web:build ) >/dev/null 2>&1 \
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
#   (R14/R15 three views, R5 positions->Ready, R6 dispute fires agent,
#    R8 settle within band, R16 UI reflects on-chain state)
# ===========================================================================
scenario_happy_path() {
  echo "Scenario A: happy-path lifecycle (create → positions → dispute → approve → settle)"

  # Arrange: fresh app, open the Create view, fill the form.
  open_app
  ab find testid nav-create click >/dev/null
  ab find testid create-note fill "Severe plaque psoriasis; documented failure of methotrexate and topical therapy." >/dev/null
  ab find testid create-drug fill "Adalimumab" >/dev/null
  ab find testid create-floor fill "1000" >/dev/null
  ab find testid create-ceil fill "5000" >/dev/null

  # Act: create -> navigates to the Detail view for reqId 1.
  ab find testid create-submit click >/dev/null
  ab wait 300 >/dev/null

  # Assert: contract opened in Open; dispute is NOT possible yet (R5 gate).
  assert_eq "contract created in Open state" "0" "$(state_of 1)"
  assert_hidden "dispute hidden before both positions (R5)" "[data-testid=dispute-submit]"

  # Act: provider (active) submits a position; one side only -> still Open.
  ab find testid position-amount fill "2000" >/dev/null
  ab find testid position-submit click >/dev/null
  ab wait 200 >/dev/null
  assert_eq "still Open after one position" "0" "$(state_of 1)"

  # Act: switch to payer and submit the second position -> Ready (R5).
  ab select "[data-testid=profile-switcher]" payer >/dev/null
  ab wait 200 >/dev/null
  ab find testid position-amount fill "4000" >/dev/null
  ab find testid position-submit click >/dev/null
  ab wait 300 >/dev/null
  assert_eq "both positions -> Ready (on-chain)" "1" "$(state_of 1)"
  assert_eq "UI badge reflects Ready (R16)" "Ready" "$(ab get text "[data-testid=state-badge]" | tail -1)"

  # Act: choose verdict 'approve' and raise the dispute -> agent fires (R6),
  # auto-resolves after ~1.2s -> Approved.
  ab select "[data-testid=verdict-select]" approve >/dev/null
  ab find testid dispute-submit click >/dev/null
  ab wait 1800 >/dev/null
  assert_eq "approve ruling routes to Approved" "4" "$(state_of 1)"

  # Act: settle within the band [1000, 5000] (R8 event marker).
  ab find testid settle-amount fill "3000" >/dev/null
  ab find testid settle-submit click >/dev/null
  ab wait 300 >/dev/null
  assert_eq "settled (terminal)" "7" "$(state_of 1)"
  assert_eq "agreed amount recorded within band" "3000" "$(agreed_of 1)"
}

# ===========================================================================
# Scenario B — no PHI on-chain (R4/T1, the hard invariant)
# ===========================================================================
scenario_no_phi() {
  echo "Scenario B: no PHI on-chain (R4 hard invariant)"
  local token="ZZ_SECRET_PHI_TOKEN_99"

  # Arrange + Act: create a contract whose note contains a unique sentinel.
  open_app
  ab find testid nav-create click >/dev/null
  ab find testid create-note fill "$token — patient note body that must never be committed." >/dev/null
  ab find testid create-drug fill "Adalimumab" >/dev/null
  ab find testid create-floor fill "1000" >/dev/null
  ab find testid create-ceil fill "5000" >/dev/null
  ab find testid create-submit click >/dev/null
  ab wait 300 >/dev/null

  # Assert: the committed noteHash verifies against the off-chain note (R3)…
  assert_eq "note verifies against on-chain hash (R3)" "true" \
    "$(ev "(async()=>{const n=await window.__curie.negotiation.getNegotiation(1n);return String(window.__curie.content.verify('${token} — patient note body that must never be committed.', n.noteHash))})()")"
  # …the sentinel never appears in the serialized on-chain record (R4)…
  assert_eq "sentinel absent from on-chain record (R4)" "true" \
    "$(ev "(async()=>{const n=await window.__curie.negotiation.getNegotiation(1n);const s=JSON.stringify(n,(_,v)=>typeof v==='bigint'?v.toString():v);return String(!s.includes('${token}'))})()")"
  # …and the sentinel is not present anywhere in the DOM after navigation.
  assert_eq "sentinel absent from rendered DOM" "true" \
    "$(ev "String(!document.documentElement.innerHTML.includes('${token}'))")"
}

# ===========================================================================
# Scenario C — dispute is gated until Ready (R5/T3 guard)
# ===========================================================================
scenario_dispute_gating() {
  echo "Scenario C: dispute gated until both positions submitted (R5/T3)"

  # Arrange: a fresh contract with only one position submitted (still Open).
  open_app
  ab find testid nav-create click >/dev/null
  ab find testid create-note fill "Single-position contract for the gating check." >/dev/null
  ab find testid create-drug fill "Etanercept" >/dev/null
  ab find testid create-floor fill "500" >/dev/null
  ab find testid create-ceil fill "2500" >/dev/null
  ab find testid create-submit click >/dev/null
  ab wait 300 >/dev/null
  ab find testid position-amount fill "1500" >/dev/null
  ab find testid position-submit click >/dev/null
  ab wait 200 >/dev/null

  # Act + Assert: a dispute before Ready must revert (mirrors the contract guard).
  assert_eq "submitDispute before Ready reverts" "reverted" \
    "$(ev "(async()=>{try{await window.__curie.negotiation.submitDispute(1n,1n);return 'no-revert'}catch(e){return 'reverted'}})()")"
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

  # Act: switch to payer -> active party id is 2.
  ab select "[data-testid=profile-switcher]" payer >/dev/null
  ab wait 150 >/dev/null
  assert_eq "active party is payer (2)" "2" "$(ev "String(window.__curie.profiles.getActivePartyId())")"

  # Act: switch to provider -> active party id is 1.
  ab select "[data-testid=profile-switcher]" provider >/dev/null
  ab wait 150 >/dev/null
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
  ab find testid load-sample click >/dev/null
  ab wait 200 >/dev/null

  # Assert: the fixture's drug + benchmark band were prefilled.
  assert_eq "sample drug prefilled" "Adalimumab" "$(ab get value "[data-testid=create-drug]" | tail -1)"
  assert_eq "sample band floor prefilled" "2800" "$(ab get value "[data-testid=create-floor]" | tail -1)"
  assert_eq "sample band ceil prefilled" "5200" "$(ab get value "[data-testid=create-ceil]" | tail -1)"

  # Act + Assert: creating from the sample case opens a contract with that band.
  ab find testid create-submit click >/dev/null
  ab wait 300 >/dev/null
  assert_eq "sample contract created (Open)" "0" "$(state_of 1)"
  assert_eq "band lower bound on-chain" "2800" \
    "$(ev "(async()=>String((await window.__curie.negotiation.getNegotiation(1n)).priceFloor))()")"
  assert_eq "band upper bound on-chain" "5200" \
    "$(ev "(async()=>String((await window.__curie.negotiation.getNegotiation(1n)).priceCeil))()")"
}

# ===========================================================================
# Scenario F — both-party note verification on the website (R3, §4 deliverable)
# ===========================================================================
scenario_note_verify() {
  echo "Scenario F: verify an off-chain note copy against the on-chain hash (R3)"

  # Arrange: create a contract with a known note, landing on Detail.
  open_app
  ab find testid nav-create click >/dev/null
  ab find testid create-note fill "VERIFY_ME canonical note body" >/dev/null
  ab find testid create-drug fill "Adalimumab" >/dev/null
  ab find testid create-floor fill "1000" >/dev/null
  ab find testid create-ceil fill "5000" >/dev/null
  ab find testid create-submit click >/dev/null
  ab wait 300 >/dev/null

  # Act + Assert: the exact copy matches the committed hash…
  ab find testid verify-note-input fill "VERIFY_ME canonical note body" >/dev/null
  ab find testid verify-note-submit click >/dev/null
  ab wait 150 >/dev/null
  case "$(ab find testid verify-note-result text | tail -1)" in
    *matches*) echo "  ✓ matching note verifies against the on-chain hash"; PASS=$((PASS + 1));;
    *) echo "  ✗ matching note failed to verify"; FAIL=$((FAIL + 1));;
  esac

  # …and a tampered copy does not.
  ab find testid verify-note-input fill "tampered note body" >/dev/null
  ab find testid verify-note-submit click >/dev/null
  ab wait 150 >/dev/null
  case "$(ab find testid verify-note-result text | tail -1)" in
    *"does not match"*) echo "  ✓ tampered note is rejected"; PASS=$((PASS + 1));;
    *) echo "  ✗ tampered note was not rejected"; FAIL=$((FAIL + 1));;
  esac
}

# --- main -------------------------------------------------------------------

start_server
echo "Running agent-browser E2E suite against $URL"
echo

scenario_happy_path;    echo
scenario_no_phi;        echo
scenario_dispute_gating; echo
scenario_profiles;      echo
scenario_sample_case;   echo
scenario_note_verify;   echo

echo "──────────────────────────────────────────"
echo "agent-browser E2E: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1

#!/usr/bin/env bash
# Pre-flight wallet sufficiency helper for agent-browser scenarios — SPEC-0005 R23.
#
# Computes an upper-bound STT cost for a scenario and asserts the active
# wallet has enough balance to run it BEFORE any write transaction fires.
# A scenario that would otherwise revert opaquely mid-flow instead aborts
# with the spec's exact loud failure message:
#
#   <scenario>: insufficient balance: needed X STT, have Y STT,
#   short Z STT — fund <addr> at https://testnet.somnia.network/
#
# Real-mode-only: when VITE_WALLET_MODE != "real" the function returns 0
# silently, matching client.ts's IS_REAL gate. Source this file from
# run.sh and call assert_wallet_sufficient at the top of each scenario
# that fires write txs.

# --- tunables (overridable via env for tests + future tuning) ---------------

# Gas-per-write-tx upper bound on Somnia testnet. 250k pads above the
# observed ~180k for the heaviest CoverageNegotiation write (handleResponse
# carrying the full evidence-index payload from SPEC-0004 §3.5).
COST_GAS_PER_WRITE_UPPER="${COST_GAS_PER_WRITE_UPPER:-250000}"

# Max fee-per-gas upper bound, in wei (100 gwei). Somnia testnet base fee
# runs 1-10 gwei; 100 gwei keeps a 10x safety margin.
COST_MAX_FEE_WEI="${COST_MAX_FEE_WEI:-100000000000}"

# Agent fee per arbiter ruling, in wei — matches the deployed contract.
COST_AGENT_FEE_WEI="${COST_AGENT_FEE_WEI:-350000000000000000}"

# RPC URL — VITE_RPC_URL takes precedence, then RPC_URL, then Somnia default.
COST_RPC_URL="${VITE_RPC_URL:-${RPC_URL:-https://api.infra.testnet.somnia.network/}}"

# --- internal helpers ------------------------------------------------------

# Derive the active wallet's address from VITE_PRIVATE_KEY in .env without
# leaking the key. Echoes the address. Returns non-zero on missing key or
# derivation failure.
#
# Tick-85 hardening (security-review M1+L1): the key is piped to node's
# stdin via a bash builtin (printf) so it never appears in /proc/<pid>/
# cmdline of any process. xtrace is also disabled around the key handling
# so callers running `set -x` don't echo the key to logs.
_cost_derive_active_wallet_address() {
  local env_file="${COST_ENV_FILE:-${REPO_ROOT:-$(pwd)}/.env}"
  local key prev_x="$-"
  set +x
  key="$(grep -E '^VITE_PRIVATE_KEY=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2-)"
  # Strip surrounding quotes if present.
  key="${key%\"}"; key="${key#\"}"
  key="${key%\'}"; key="${key#\'}"
  if [ -z "$key" ]; then
    echo "cost-estimator: VITE_PRIVATE_KEY not set in $env_file" >&2
    case "$prev_x" in *x*) set -x ;; esac
    return 2
  fi
  local addr
  # Pipe the key via stdin; node reads fd 0 with readFileSync. The key never
  # appears in argv (no `ps -ef` exposure) and the heredoc body never echoes.
  addr="$(printf '%s' "$key" | node --input-type=module -e "
    import { Wallet } from 'ethers';
    import { readFileSync } from 'fs';
    const k = readFileSync(0, 'utf8').trim();
    process.stdout.write(new Wallet(k).address);
  " 2>/dev/null)"
  local rc=$?
  key=""  # Clear from local var memory.
  case "$prev_x" in *x*) set -x ;; esac
  if [ $rc -ne 0 ] || [ -z "$addr" ]; then
    echo "cost-estimator: could not derive address from VITE_PRIVATE_KEY" >&2
    return 3
  fi
  printf '%s' "$addr"
}

# Strict 0x40-hex address validator. Used on caller-supplied addresses
# before they enter the RPC body (security-review L2: body-injection guard).
_cost_is_valid_address() {
  case "$1" in
    0x[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) return 0 ;;
    *) return 1 ;;
  esac
}

# Strict non-negative integer validator. Used on writes / arbiters / balance
# strings before they enter python (security-review H1 hardening).
_cost_is_nonneg_int() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
    *) return 0 ;;
  esac
}

# Query the RPC for the wallet's balance and echo it as a decimal wei
# integer. Honors COST_TEST_BALANCE_WEI for unit tests so they don't need
# a live RPC.
#
# Tick-85 hardening (security-review H1): the RPC's `result` string is
# regex-validated as `^0x[0-9a-fA-F]+$` before being passed to python
# via stdin/env (never interpolated into source). A malicious RPC can no
# longer inject python.
_cost_get_balance_wei() {
  local addr="$1"
  if ! _cost_is_valid_address "$addr"; then
    echo "cost-estimator: invalid address [$addr] — expected 0x + 40 hex" >&2
    return 6
  fi
  if [ -n "${COST_TEST_BALANCE_WEI:-}" ]; then
    if ! _cost_is_nonneg_int "$COST_TEST_BALANCE_WEI"; then
      echo "cost-estimator: COST_TEST_BALANCE_WEI must be non-negative integer wei" >&2
      return 7
    fi
    printf '%s' "$COST_TEST_BALANCE_WEI"
    return 0
  fi
  local resp hex
  resp="$(curl -sf -X POST "$COST_RPC_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$addr\",\"latest\"],\"id\":1}" 2>/dev/null)" \
    || { echo "cost-estimator: balance RPC failed for $addr at $COST_RPC_URL" >&2; return 4; }
  hex="$(printf '%s' "$resp" | CE_RESP="$resp" python3 -c "
import os, sys, json
try:
  print(json.loads(os.environ['CE_RESP']).get('result',''))
except Exception:
  sys.exit(1)
" 2>/dev/null)"
  case "$hex" in
    0x[0-9a-fA-F]*) ;;
    *) echo "cost-estimator: balance RPC returned non-hex result: $resp" >&2; return 5 ;;
  esac
  # Strict hex → decimal via python, but with input passed by env (no
  # source-string interpolation; injection-proof).
  CE_HEX="$hex" python3 -c "import os; print(int(os.environ['CE_HEX'], 16))"
}

# Format a wei integer as a STT string with 4 decimal places. Input MUST
# be a non-negative integer string; callers validate upstream.
_cost_format_stt() {
  CE_WEI="$1" python3 -c "import os; print(f'{int(os.environ[\"CE_WEI\"])/1e18:.4f}')"
}

# --- public API ------------------------------------------------------------

# assert_wallet_sufficient SCENARIO_NAME WRITE_TX_COUNT ARBITER_CALL_COUNT [WALLET_ADDR]
#
# Asserts that the active wallet's balance is at least the upper-bound cost
# of the scenario. On shortfall, prints the spec's loud failure message to
# stderr and returns 1. On sim mode (VITE_WALLET_MODE != "real"), returns 0
# silently. WALLET_ADDR defaults to the address derived from .env's
# VITE_PRIVATE_KEY.
assert_wallet_sufficient() {
  local scenario="$1" writes="$2" arbiters="$3" addr="${4:-}"

  # Sim mode: skip silently. Tests force-enable with COST_FORCE_CHECK=1.
  if [ "${VITE_WALLET_MODE:-}" != "real" ] && [ -z "${COST_FORCE_CHECK:-}" ]; then
    return 0
  fi

  # Validate writes + arbiters before any math (no negative counts, no
  # python interpolation): non-negative integers only.
  if ! _cost_is_nonneg_int "$writes" || ! _cost_is_nonneg_int "$arbiters"; then
    echo "$scenario: writes + arbiters must be non-negative integers (got [$writes] [$arbiters])" >&2
    return 8
  fi

  if [ -z "$addr" ]; then
    addr="$(_cost_derive_active_wallet_address)" || return $?
  fi

  local have need short need_stt have_stt short_stt
  need="$(CE_W="$writes" CE_A="$arbiters" CE_G="$COST_GAS_PER_WRITE_UPPER" CE_F="$COST_MAX_FEE_WEI" CE_AF="$COST_AGENT_FEE_WEI" python3 -c "
import os
w = int(os.environ['CE_W']); a = int(os.environ['CE_A'])
g = int(os.environ['CE_G']); f = int(os.environ['CE_F']); af = int(os.environ['CE_AF'])
print(w*g*f + a*af)
")"
  have="$(_cost_get_balance_wei "$addr")" || return $?

  if CE_HAVE="$have" CE_NEED="$need" python3 -c "
import os, sys
sys.exit(0 if int(os.environ['CE_HAVE']) >= int(os.environ['CE_NEED']) else 1)
"; then
    return 0
  fi

  short="$(CE_NEED="$need" CE_HAVE="$have" python3 -c "
import os
print(int(os.environ['CE_NEED']) - int(os.environ['CE_HAVE']))
")"
  need_stt="$(_cost_format_stt "$need")"
  have_stt="$(_cost_format_stt "$have")"
  short_stt="$(_cost_format_stt "$short")"
  printf '%s: insufficient balance: needed %s STT, have %s STT, short %s STT — fund %s at https://testnet.somnia.network/\n' \
    "$scenario" "$need_stt" "$have_stt" "$short_stt" "$addr" >&2
  return 1
}

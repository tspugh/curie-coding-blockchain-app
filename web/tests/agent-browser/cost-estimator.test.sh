#!/usr/bin/env bash
# Tests for cost-estimator.sh — SPEC-0005 R23.
# Uses COST_TEST_BALANCE_WEI to mock the RPC; uses COST_FORCE_CHECK=1 to
# bypass the sim-mode gate so we can exercise the math without a real chain.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=cost-estimator.sh
. "$HERE/cost-estimator.sh"

PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1 — $2"; }

# --- T1: sim-mode bypass returns 0 silently -------------------------------
unset VITE_WALLET_MODE COST_FORCE_CHECK COST_TEST_BALANCE_WEI
if out="$(assert_wallet_sufficient "T1 sim-mode" 6 1 0x0000000000000000000000000000000000000001 2>&1)" \
   && [ -z "$out" ]; then
  pass "T1 sim-mode bypass: returns 0 with no stderr"
else
  fail "T1 sim-mode bypass: expected silent 0, got rc=$? out=[$out]"
fi

# --- T2: sufficient balance returns 0 -------------------------------------
# Need = 6 × 250000 × 1e11 + 1 × 3.5e17 = 1.5e17 + 3.5e17 = 5.0e17 wei
# Provide 1 STT (1e18 wei) → more than enough.
export COST_FORCE_CHECK=1 COST_TEST_BALANCE_WEI=1000000000000000000
if out="$(assert_wallet_sufficient "T2 sufficient" 6 1 0xDEAD000000000000000000000000000000000001 2>&1)" \
   && [ -z "$out" ]; then
  pass "T2 sufficient balance: returns 0 with no stderr"
else
  fail "T2 sufficient balance: expected silent 0, got rc=$? out=[$out]"
fi

# --- T3: short balance returns 1 + emits spec's exact message format -----
# Need = 5.0e17 wei (see T2). Provide 1e17 wei = 0.1 STT → short.
export COST_TEST_BALANCE_WEI=100000000000000000
out="$(assert_wallet_sufficient "T3 scenario" 6 1 0xDEAD000000000000000000000000000000000002 2>&1)"; rc=$?
if [ $rc -ne 0 ] && \
   printf '%s' "$out" | grep -q '^T3 scenario: insufficient balance: needed ' && \
   printf '%s' "$out" | grep -q ' STT, have ' && \
   printf '%s' "$out" | grep -q ' STT, short ' && \
   printf '%s' "$out" | grep -q 'fund 0xDEAD000000000000000000000000000000000002 at https://testnet.somnia.network/$'; then
  pass "T3 short balance: returns 1 + message matches spec format"
else
  fail "T3 short balance: rc=$rc msg=[$out]"
fi

# --- T4: zero arbiter calls don't add agent fee --------------------------
# Need = 6 × 250000 × 1e11 + 0 × 3.5e17 = 1.5e17 wei. Provide 1.6e17 → enough.
export COST_TEST_BALANCE_WEI=160000000000000000
if out="$(assert_wallet_sufficient "T4 no-arbiter" 6 0 0xDEAD000000000000000000000000000000000003 2>&1)" \
   && [ -z "$out" ]; then
  pass "T4 zero arbiter calls: returns 0 (gas-only cost)"
else
  fail "T4 zero arbiter calls: expected 0, got rc=$? out=[$out]"
fi

# --- T5: zero writes + 1 arbiter only counts the agent fee ---------------
# Need = 0 + 1 × 3.5e17 = 3.5e17 wei. Provide 3.6e17 → enough.
export COST_TEST_BALANCE_WEI=360000000000000000
if out="$(assert_wallet_sufficient "T5 arbiter-only" 0 1 0xDEAD000000000000000000000000000000000004 2>&1)" \
   && [ -z "$out" ]; then
  pass "T5 zero writes, 1 arbiter: returns 0"
else
  fail "T5 zero writes, 1 arbiter: expected 0, got rc=$? out=[$out]"
fi

# --- T6: the failure message includes wei → STT formatting --------------
# Need 5.0e17 wei, have 1e17 → short 4.0e17 = 0.4 STT.
export COST_TEST_BALANCE_WEI=100000000000000000
out="$(assert_wallet_sufficient "T6 format" 6 1 0xDEAD000000000000000000000000000000000005 2>&1)"
if printf '%s' "$out" | grep -q 'needed 0.5000 STT, have 0.1000 STT, short 0.4000 STT'; then
  pass "T6 STT formatting: 4-decimal place output verified"
else
  fail "T6 STT formatting: msg=[$out]"
fi

# --- T7: invalid address rejected before RPC body interpolation ---------
# L2 hardening — caller-supplied address must match 0x + 40 hex.
unset COST_TEST_BALANCE_WEI
export COST_FORCE_CHECK=1
out="$(assert_wallet_sufficient "T7 bad-addr" 1 0 'evil"]} injection' 2>&1)"; rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'invalid address'; then
  pass "T7 invalid address rejected"
else
  fail "T7 invalid address: rc=$rc out=[$out]"
fi

# --- T8: negative writes/arbiters rejected ------------------------------
# H1/M1 hardening — non-numeric input rejected before python interpolation.
export COST_TEST_BALANCE_WEI=1000000000000000000
out="$(assert_wallet_sufficient "T8 neg" -1 0 0xDEAD000000000000000000000000000000000006 2>&1)"; rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'non-negative integers'; then
  pass "T8 negative writes rejected"
else
  fail "T8 negative writes: rc=$rc out=[$out]"
fi
out="$(assert_wallet_sufficient "T8b inject" '1; rm -rf /' 0 0xDEAD000000000000000000000000000000000007 2>&1)"; rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'non-negative integers'; then
  pass "T8b shell-injection-shaped writes rejected"
else
  fail "T8b inject writes: rc=$rc out=[$out]"
fi

echo "──────────────────────────────────────────"
echo "cost-estimator tests: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ]

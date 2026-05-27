#!/usr/bin/env bash
#
# Run the real-backend integration test (scripts/real-backend-localnode.mjs)
# against a throwaway local Hardhat node — proving the library's REAL code path
# (RealBackend: ethers vs a deployed contract + live events) end-to-end without a
# funded testnet wallet (SPEC-0001 T7/R11/R16). The only piece this can't
# reproduce locally is a genuine Somnia native-agent ruling (R9 — needs testnet);
# the mock platform stands in for the callback.
#
# Builds the lib + contract artifacts, starts `hardhat node`, runs the test, and
# tears the node down. Exit code propagates from the test.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_PID=""

cleanup() { [ -n "$NODE_PID" ] && kill "$NODE_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "Building library + compiling contracts…"
  ( cd "$REPO_ROOT" && npm run build ) >/dev/null 2>&1 || { echo "lib build failed"; exit 2; }
  ( cd "$REPO_ROOT/contracts" && npx hardhat compile ) >/dev/null 2>&1 || { echo "contract compile failed"; exit 2; }
fi

echo "Starting local Hardhat node…"
( cd "$REPO_ROOT/contracts" && npx hardhat node ) >/tmp/curie-hardhat-node.log 2>&1 &
NODE_PID=$!

for _ in $(seq 1 40); do
  curl -sf -o /dev/null -X POST -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    http://127.0.0.1:8545 && break
  sleep 0.5
done
curl -sf -o /dev/null -X POST -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  http://127.0.0.1:8545 || { echo "node did not come up"; cat /tmp/curie-hardhat-node.log; exit 2; }

echo "Running real-backend integration test…"
( cd "$REPO_ROOT" && node scripts/real-backend-localnode.mjs )

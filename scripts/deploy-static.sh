#!/usr/bin/env bash
# Build the Curie web app and publish it as an HTTPS static site (SPEC-0001 R18).
#
# The app is a fully client-side Vite SPA: `npm run build` emits the library to
# dist/ (the @lib alias), then `npm run web:build` emits the static site to
# web/dist/. We sync web/dist/ to an S3 bucket fronted by CloudFront (HTTPS) and
# invalidate the CDN cache.
#
# Config is via env vars (no AWS account specifics are committed here):
#   CURIE_DEPLOY_BUCKET    (required)  target S3 bucket name
#   CURIE_DEPLOY_DIST_ID   (required)  CloudFront distribution id
#   AWS_PROFILE            (optional)  AWS CLI profile (else default creds)
#   AWS_REGION             (optional)  defaults to us-east-1
#
# Usage:  CURIE_DEPLOY_BUCKET=... CURIE_DEPLOY_DIST_ID=... ./scripts/deploy-static.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$here"

# Load the local .env (gitignored) so CURIE_DEPLOY_* / AWS_PROFILE come from there.
if [ -f "$here/.env" ]; then set -a; . "$here/.env"; set +a; fi

: "${CURIE_DEPLOY_BUCKET:?set CURIE_DEPLOY_BUCKET (in .env) to the target S3 bucket}"
: "${CURIE_DEPLOY_DIST_ID:?set CURIE_DEPLOY_DIST_ID to the CloudFront distribution id}"
AWS_REGION="${AWS_REGION:-us-east-1}"
profile_arg=()
[ -n "${AWS_PROFILE:-}" ] && profile_arg=(--profile "$AWS_PROFILE")

echo ">>> install + build (library then web)"
npm ci
npm run build           # tsc -> dist/index.js  (consumed by the web app via @lib)
# PUBLIC BUNDLE SAFETY: .env was sourced above (set -a) and carries the dev signing
# keys. Vite inlines `import.meta.env.VITE_PRIVATE_KEY` as a BARE "0x..." literal —
# erasing the variable name the secret-guard below greps for — so the guard CANNOT
# catch a key leaked this way. The only robust defense is to never let a key reach the
# build: force the wallet keys EMPTY for the public bundle. With no inlined key,
# hasUsableProviderKey() is false and the SPEC-0008 onboarding modal prompts each
# visitor for their own wallet (the intended public-demo trust model).
# SPEC-0008 R14: designated BURNABLE demo keys — INTENTIONALLY baked into the public
# bundle behind the "Load demo wallets" button (public, testnet-only, disposable). They
# DEFAULT to the local .env demo wallets ("use the defaults from our local environment");
# override with CURIE_DEMO_PROVIDER_KEY / CURIE_DEMO_INSURER_KEY to use a dedicated burnable
# wallet (RECOMMENDED so draining it can't touch your deploy wallet, and so the guard below
# keeps protecting the deploy/raw PRIVATE_KEY). The user's OWN-key slot (VITE_PRIVATE_KEY)
# stays empty (R7) — only the explicit demo channel is populated.
demo_provider="${CURIE_DEMO_PROVIDER_KEY:-${VITE_PRIVATE_KEY:-}}"
demo_insurer="${CURIE_DEMO_INSURER_KEY:-${VITE_PRIVATE_KEY_INSURER:-}}"
VITE_PRIVATE_KEY="" VITE_PRIVATE_KEY_INSURER="" \
  VITE_DEMO_PROVIDER_KEY="$demo_provider" VITE_DEMO_INSURER_KEY="$demo_insurer" \
  npm run web:build  # vite build -> web/dist/

dist="web/dist"
[ -d "$dist" ] || { echo "FATAL: $dist not found after build"; exit 1; }

echo ">>> secret/PHI guard — refuse to publish a bundle with a leaked secret"
# Meaningful checks ONLY. A web3 bundle legitimately contains 0x<64-hex> strings
# (ZeroHash, secp256k1 curve constants, content hashes) and the literal token
# "PRIVATE_KEY" (an env-var NAME, e.g. process.env.PRIVATE_KEY) — flagging those is a
# guaranteed false positive, so we don't. Real leaks: a committed .env, a PEM
# private-key block, or a key/mnemonic actually inlined as a VALUE (only possible if
# someone VITE_-prefixed a secret).
if find "$dist" -name '.env*' | grep -q .; then
  echo "FATAL: a .env file is in $dist — aborting."; exit 1
fi
if grep -rIlE -- '-----BEGIN [A-Z ]*PRIVATE KEY-----' "$dist" >/dev/null 2>&1; then
  echo "FATAL: a PEM private-key block is in $dist — aborting."; exit 1
fi
if grep -rIoE -- '(PRIVATE_KEY|privateKey|MNEMONIC|mnemonic)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?0x?[a-fA-F0-9]{40,}' "$dist" >/dev/null 2>&1; then
  echo "FATAL: a private-key/mnemonic VALUE appears inlined in $dist — aborting."; exit 1
fi
# Defense-in-depth: a vite-inlined key is a BARE "0x..." literal indistinguishable
# from a content hash by pattern alone — so we check for the EXACT key VALUES that were
# in scope at build time. Zero false positives: we look for these specific secrets only.
# The SPEC-0008 R14 demo keys are INTENTIONALLY inlined (public testnet wallets) — allowlist
# their exact values; abort on ANY OTHER inlined key value. NOTE: if a demo key equals your
# deploy/raw PRIVATE_KEY (the .env-default case), the guard can't distinguish them by value,
# so that key is treated as the intended demo key — use a dedicated CURIE_DEMO_* wallet to
# keep the guard protecting the deploy key.
for var in VITE_PRIVATE_KEY VITE_PRIVATE_KEY_INSURER PRIVATE_KEY; do
  val="${!var:-}"
  [ -z "$val" ] && continue
  if [ "$val" = "$demo_provider" ] || [ "$val" = "$demo_insurer" ]; then continue; fi
  if grep -rIqF -- "$val" "$dist"; then
    echo "FATAL: the value of \$$var is inlined in $dist — a private key would be PUBLIC. Aborting."; exit 1
  fi
done
echo "guard OK (no .env, no PEM key, no inlined key/mnemonic value, no in-scope key value)"

echo ">>> sync $dist -> s3://$CURIE_DEPLOY_BUCKET"
# Long-cache the hashed assets; never cache index.html (so deploys go live immediately).
aws "${profile_arg[@]}" --region "$AWS_REGION" s3 sync "$dist" "s3://$CURIE_DEPLOY_BUCKET" \
  --delete --exclude index.html --cache-control "public,max-age=31536000,immutable"
aws "${profile_arg[@]}" --region "$AWS_REGION" s3 cp "$dist/index.html" "s3://$CURIE_DEPLOY_BUCKET/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html"

echo ">>> invalidate CloudFront ($CURIE_DEPLOY_DIST_ID)"
aws "${profile_arg[@]}" --region "$AWS_REGION" cloudfront create-invalidation \
  --distribution-id "$CURIE_DEPLOY_DIST_ID" --paths "/*" \
  --query 'Invalidation.Id' --output text

echo ">>> done. Site will reflect the new build once the invalidation completes."

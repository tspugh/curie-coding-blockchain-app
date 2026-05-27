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

: "${CURIE_DEPLOY_BUCKET:?set CURIE_DEPLOY_BUCKET to the target S3 bucket}"
: "${CURIE_DEPLOY_DIST_ID:?set CURIE_DEPLOY_DIST_ID to the CloudFront distribution id}"
AWS_REGION="${AWS_REGION:-us-east-1}"
profile_arg=()
[ -n "${AWS_PROFILE:-}" ] && profile_arg=(--profile "$AWS_PROFILE")

echo ">>> install + build (library then web)"
npm ci
npm run build           # tsc -> dist/index.js  (consumed by the web app via @lib)
npm run web:build       # vite build -> web/dist/

dist="web/dist"
[ -d "$dist" ] || { echo "FATAL: $dist not found after build"; exit 1; }

echo ">>> secret/PHI guard — refuse to publish a bundle containing obvious secrets"
# A static bundle must never carry a private key or .env. Fail loudly if it does.
if find "$dist" -name '.env*' | grep -q .; then
  echo "FATAL: a .env file is in $dist — aborting."; exit 1
fi
if grep -rIlE 'PRIVATE_KEY|BEGIN [A-Z ]*PRIVATE KEY|0x[a-fA-F0-9]{64}' "$dist" >/dev/null 2>&1; then
  echo "FATAL: a private-key-shaped string is in $dist — aborting (no secrets in the static bundle)."; exit 1
fi

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

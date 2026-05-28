# Curie web app — static hosting (S3 + CloudFront)

Hosting plan for the Curie demo web app (SPEC-0001 R18). The app is a **fully
client-side Vite SPA** — in simulated mode it has no backend, and in real mode the
"backend" is the Somnia contract reached from the browser. So it ships as a **static
site**. A wallet dApp requires **HTTPS** (secure context), so bare-S3 (HTTP only) is
insufficient; CloudFront provides HTTPS + CDN.

- **Account / profile:** `471112593726` / `pugh.thomas` (us-east-1). See [`dev-instance.md`](./dev-instance.md).
- **Cost:** ~**$0/mo** at demo scale — S3 storage is cents; CloudFront free tier (1 TB/mo, 12 mo) covers demo traffic; the default CloudFront cert (HTTPS on `*.cloudfront.net`) is free. ACM + Route 53 only if we want a custom domain (ACM cert free; Route 53 ~$0.50/mo/zone + registration).
- **Status: PROVISIONED + first build deployed** (2026-05-27). IaC moved to the app repo (`curie-coding-blockchain-app/infra/`); values live in the app repo's local `.env`.

## Architecture

```
build (Vite) → web/dist/ ──aws s3 sync──▶ S3 (private bucket)
                                              ▲ Origin Access Control (OAC)
        browser ◀──HTTPS── CloudFront distribution (default *.cloudfront.net cert)
                              · default root object: index.html
                              · SPA rewrite: 403/404 → /index.html (200)
```

- **S3**: private bucket (no public access); only CloudFront reads it via **OAC**.
- **CloudFront**: HTTPS, gzip/br, `index.html` default root object, and **custom error
  responses 403 & 404 → `/index.html` with 200** so client-side routes resolve (SPA).
- **Cert**: the default CloudFront certificate (no domain needed) gives HTTPS on the
  distribution's `*.cloudfront.net` URL. Add **ACM (us-east-1) + Route 53** only for a
  custom domain.

## Deploy

The IaC **and** the deploy script now live in the **app repo** (`curie-coding-blockchain-app`):
`infra/static-site.cfn.yaml` + `scripts/deploy-static.sh`. The script **sources the app
repo's local `.env`** (gitignored) for the account-specific values, guards against shipping
any secret/PHI, syncs `web/dist/` (long-cache assets, never-cache `index.html`), and
invalidates CloudFront. From the app repo:

```bash
./scripts/deploy-static.sh   # reads CURIE_DEPLOY_BUCKET / CURIE_DEPLOY_DIST_ID / AWS_PROFILE from .env
```

Account-specific values are **never committed** — they live in the app repo's local `.env`
(shape in its `.env.example`). Current provisioned values (private record; mirror of `.env`):

| Resource | Value |
|---|---|
| S3 bucket | `curie-web-static-sitebucket-wpowow9sqopi` |
| CloudFront distribution id | `EC0Y6JFNMILF0` |
| CloudFront domain (demo URL) | <https://d2inaytdsjck4j.cloudfront.net> |

Stack `curie-web-static` provisioned 2026-05-27 (`CREATE_COMPLETE`); first build deployed.

## Team access

The stack also creates a scoped managed policy **`curie-web-deploy`** attached to the
team IAM users (`ols.violet`, `ripperda.grant`, `pugh.thomas` — the `TeamUsers`
parameter). It grants **only** S3 read/write on *this* bucket + CloudFront
invalidation/read on *this* distribution — enough to run `scripts/deploy-static.sh`,
nothing more (no admin). `TeamUsers` has **no committed default** (no usernames in the
public-destined repo); set `CURIE_TEAM_USERS` in the app repo `.env` and re-run the
provisioning deploy (`--parameter-overrides TeamUsers=$CURIE_TEAM_USERS`) to add/remove a
teammate. Currently: `ols.violet`, `ripperda.grant`, `pugh.thomas`.

## Provisioning (one-time, IaC — run locally from an admin profile)

Infrastructure-as-code lives in the **app repo** at
`curie-coding-blockchain-app/infra/static-site.cfn.yaml` (CloudFormation: private S3 + OAC
+ CloudFront + bucket policy + SPA error-rewrites + default cert + the scoped
`curie-web-deploy` team policy). The **box agent never provisions this** — it has no infra
credentials; provisioning is done **locally** from an admin profile. Run from the app repo:

```bash
set -a; . ./.env; set +a   # AWS_PROFILE / AWS_REGION / CURIE_TEAM_USERS
# create / update the stack (CloudFront takes a few minutes)
aws --profile "$AWS_PROFILE" --region "$AWS_REGION" cloudformation deploy \
  --stack-name curie-web-static --template-file infra/static-site.cfn.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides TeamUsers="$CURIE_TEAM_USERS"

# read outputs (bucket / dist id / demo URL)
aws --profile "$AWS_PROFILE" --region "$AWS_REGION" cloudformation describe-stacks \
  --stack-name curie-web-static --query 'Stacks[0].Outputs' --output table

# tear down (deletes the bucket + distribution)
aws --profile "$AWS_PROFILE" --region "$AWS_REGION" cloudformation delete-stack --stack-name curie-web-static
```

**Hard rule:** the static bundle is public — only **synthetic / public** fixtures and a
**public testnet** contract address may ship in it. **No PHI, no `PRIVATE_KEY`, no `.env`**
(the deploy script fails the build if it detects them). Real-mode keys are supplied by the
user at runtime, never built in.

# @cliqueue/* Monorepo Package Architecture

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — @cliqueue/* monorepo architecture: pnpm workspaces + shared @cliqueue/fhir-types internal package confirmed best practice; no Da Vinci npm constants package exists; publish all four packages

**Question answered:** Should `@cliqueue/pa-lifecycle`, `@cliqueue/cds-hooks-client`, and `@cliqueue/cda-attachments` be structured as a `@cliqueue/*` pnpm monorepo with a shared internal `@cliqueue/fhir-types` package for FHIR extension URL constants — and what is the correct monorepo architecture?

- **pnpm workspaces with `workspace:*` protocol is the confirmed best-practice for a 3–4 package TypeScript monorepo publishing to npm.** The `workspace:*` reference is automatically converted to a pinned semver on publish, so external consumers see a clean resolved dependency. Internal packages declare `"@cliqueue/fhir-types": "workspace:*"` in their `package.json`. No intermediary publish step is needed before the workspace resolves. ([pnpm workspaces docs](https://pnpm.io/workspaces))

- **A dedicated shared `@cliqueue/fhir-types` package (rather than duplicated constants) is correct for this use case.** When multiple published packages (`pa-lifecycle`, `cds-hooks-client`, `cda-attachments`) share the same FHIR extension URL strings (e.g., `http://hl7.org/fhir/us/davinci-crd/StructureDefinition/ext-coverage-information`), duplication causes URL-string drift and breaks cross-package type compatibility. Medplum's monorepo (26 packages, including `@medplum/fhirtypes` as a separate shared package) is the canonical reference pattern in the FHIR TypeScript ecosystem. ([medplum/medplum GitHub](https://github.com/medplum/medplum); [`@medplum/fhirtypes` npm](https://www.npmjs.com/package/@medplum/fhirtypes))

- **`@cliqueue/fhir-types` should be published to npm (not kept workspace-only)** because all three consumer packages are themselves published. If a published package's `package.json` references an unpublished workspace-only package, downstream installers (`npm install @cliqueue/pa-lifecycle`) cannot resolve the dependency. pnpm workspace protocol auto-converts `workspace:*` to the published version on pack, so publishing `@cliqueue/fhir-types` alongside the others is the correct path. ([pnpm workspaces — publishing](https://pnpm.io/workspaces))

- **No Da Vinci CRD/CDex TypeScript constants npm package exists.** `@davinci/core` on npm is an HP REST API framework unrelated to HL7. `hl7.fhir.us.davinci-cdex#2.1.0` is a FHIR IG package registry artifact consumed by IG build tooling, not by npm install chains. The `HL7-DaVinci` GitHub org has reference implementation apps but no published npm constants package. `@medplum/fhirtypes` covers core FHIR resources but not Da Vinci extension URLs. **`@cliqueue/fhir-types` must be hand-rolled.** ([HL7-DaVinci GitHub org](https://github.com/HL7-DaVinci); [npm @davinci/core](https://www.npmjs.com/package/@davinci/core); [Da Vinci CDex IG downloads](https://build.fhir.org/ig/HL7/davinci-ecdx/downloads.html))

- **Recommended `@cliqueue/fhir-types` scope:** Export only the minimal set of typed constants needed across the four packages: (a) Da Vinci CRD extension URLs (`ext-coverage-information`, `coveragePaDetail` ValueSet codes), (b) Da Vinci CDS Hooks prefetch template types, (c) C-CDA R2.1 document type LOINC codes and template OIDs for CMS-0053-F attachment types, (d) `PaStatus` enum (6 values). Do NOT re-export full FHIR resource types — depend on `@medplum/fhirtypes` as a peer dependency where FHIR4 resource typing is needed (Task, Coverage, Claim). This keeps `@cliqueue/fhir-types` small and avoids pulling the full Medplum type tree into every package. (Perplexity synthesis — advisory, no primary citation)

- **Toolchain recommendation for 3–4 packages: pnpm workspaces + Changesets + TypeScript project references.** Turborepo is optional but adds build/test caching that becomes useful at CI scale. Nx is over-engineered for 4 packages. TypeScript project references (`tsc -b`) enforce build ordering so `fhir-types` compiles before consumers. Changesets manages independent semver bumps — `@cliqueue/fhir-types` bumps independently from consumer packages. ([Changesets](https://github.com/changesets/changesets); [TS project references](https://www.typescriptlang.org/docs/handbook/project-references.html); [Turborepo docs](https://turbo.build/repo/docs))

- **`@medplum/fhirtypes` as a `peerDependency` (not `dependency`) of `@cliqueue/pa-lifecycle` and `@cliqueue/cda-attachments` is correct.** Hospital integration engineers who install these packages likely already have `@medplum/fhirtypes` in their project (it is a common FHIR toolchain package). Declaring it as a peer avoids bundling the full generated FHIR type tree inside cliqueue packages; the consumer provides it. This is Medplum's own pattern across `@medplum/react`, `@medplum/core`, etc. ([medplum monorepo packages](https://github.com/medplum/medplum/tree/main/packages))

**Design implication:** The four `@cliqueue/*` packages (`cds-hooks-client`, `pa-lifecycle`, `cda-attachments`, `fhir-types`) form a single pnpm workspace monorepo. `@cliqueue/fhir-types` is the root shared-constants package and is published alongside the others. All three consumer packages declare `"@cliqueue/fhir-types": "workspace:*"` internally and `"@cliqueue/fhir-types": "^x.y.z"` post-publish. The monorepo is the fifth `@cliqueue/*` package group (alongside `@cliqueue/contracts` for ABI types). Changesets manages independent versioning.

**Open questions generated:**
1. Should `@cliqueue/contracts` (the ABI type package, exporting `ClaimsAdjudicator` ABI and `ISBTRegistry`) be included in the same `@cliqueue/*` pnpm monorepo as `fhir-types`, `pa-lifecycle`, `cds-hooks-client`, and `cda-attachments` — or kept as a separate repo aligned with the Solidity contract release cycle?
2. Should `@cliqueue/fhir-types` export a `fromCoverageInformationTask(task: fhir4.Task): PaStatusResult` parser as a shared utility (used by both `cds-hooks-client` and `pa-lifecycle`) — or keep it in `pa-lifecycle` only, accepting that `cds-hooks-client` must import from `pa-lifecycle` (creating a package dependency in the wrong direction)?
3. Should the `@cliqueue/*` monorepo use Turborepo for build/test pipeline caching from day one — establishing a CI pattern that scales cleanly past 4 packages — or defer Turborepo until the package count grows beyond 6?

---

## 2026-05-17 — npm scoped package public access: `publishConfig.access = "public"` IS required; npm orgs are free for public packages; Changesets respects publishConfig per-package

**Question answered:** Does npm require an explicit `"publishConfig": {"access": "public"}` field in `package.json` for `@cliqueue/*` scoped packages to publish publicly without a paid npm org account — and should `@cliqueue/contracts` Changesets config use this field?

- **Yes, `"publishConfig": {"access": "public"}` is required for scoped packages publishing to npm without the `--access public` CLI flag.** npm's default for all scoped packages (e.g. `@cliqueue/contracts`) is `restricted` (private). Without explicit public access declaration, `npm publish` will either publish as private (if the account supports private packages) or fail with a payment-required error on a free account. This is the primary pitfall for first-time scoped-package publishers on free accounts. ([npm docs: creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/); [npm docs: about scopes](https://docs.npmjs.com/about-scopes/))

- **Two mechanisms for declaring public access — `publishConfig.access` in `package.json` is preferred over CLI flag.** Both `"publishConfig": {"access": "public"}` and `npm publish --access public` achieve the same result. The `publishConfig.access` approach is strongly preferred for `@cliqueue/*` packages because: (a) it is declarative and version-controlled, (b) it survives CI workflow changes without flag drift, (c) it works correctly with Changesets `changeset publish` without additional CLI arguments. ([npm docs: package.json publishConfig](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#publishconfig))

- **Changesets `changeset publish` respects `publishConfig.access` from per-package `package.json` — no extra CLI flag needed.** The Changesets publish command reads each package's `publishConfig` and passes the access level to npm during publish. The `.changeset/config.json` global `access` field also controls access (`"restricted"` is the Changesets default; setting it to `"public"` applies globally to all packages in the monorepo). Per-package `publishConfig.access` takes priority over the global Changesets config. ([Changesets config file options](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md); [Changesets CLI options](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md))

- **For `@cliqueue/contracts` (separate Foundry repo), the correct setup is: set `"publishConfig": {"access": "public"}` in `package.json` AND set `"access": "public"` in `.changeset/config.json`.** The dual-setting is belt-and-suspenders: `package.json` publishConfig covers direct `npm publish` invocations in CI; `.changeset/config.json` ensures Changesets CLI workflows are consistent. This is the pattern used by OpenZeppelin Contracts and other single-package Solidity npm repos. (Perplexity synthesis — advisory; no single primary citation for the dual-setting pattern)

- **npm organizations for public packages are free — no paid account needed for `@cliqueue` scope.** Any npm user can create a public npm organization at no cost. Paid org features are only required for private packages. The `@cliqueue` scope can be claimed by registering it as a free public org on npmjs.com, as long as the name is available. The free plan allows unlimited public packages under the org scope. ([npm docs: organizations](https://docs.npmjs.com/organizations); [npm orgs docs: publishing an org scoped package](https://npm.github.io/orgs-docs/publishing-an-org-scoped-package.html))

- **For the `@cliqueue/*` pnpm monorepo, the global `.changeset/config.json` should use `"access": "public"` rather than the per-package approach**, because all five packages (`fhir-types`, `pa-lifecycle`, `cds-hooks-client`, `cda-attachments`, and future additions) are public. Setting `"access": "public"` globally eliminates the risk of a new package being accidentally published as restricted if a developer forgets to add `publishConfig` to its `package.json`. Individual packages can still use `"publishConfig": {"access": "restricted"}` to opt out for any hypothetical private package. (Perplexity synthesis — advisory)

- **Minimum required `package.json` snippet for `@cliqueue/contracts` in the Foundry repo:**
  ```json
  {
    "name": "@cliqueue/contracts",
    "publishConfig": {
      "access": "public"
    }
  }
  ```
  And `.changeset/config.json`:
  ```json
  {
    "access": "public"
  }
  ```

**Design implication:** The `@cliqueue/contracts` separate Foundry repo and the `@cliqueue/*` pnpm monorepo both need `"publishConfig": {"access": "public"}` in each package's `package.json` AND `"access": "public"` in `.changeset/config.json`. The npm org `@cliqueue` can be claimed for free as a public org. Hospital integration engineers consuming `@cliqueue/contracts` install it from npm with a standard `npm install @cliqueue/contracts` — no registry configuration, no private access tokens.

**Open questions generated:**
1. Should the `@cliqueue/contracts` GitHub Actions release workflow verify that the npm org `@cliqueue` is provisioned (claims the scope) before the first `changeset publish` — and should the deployment runbook include a one-time `npm org:set @cliqueue public` setup step?
2. Should the `.changeset/config.json` in the `@cliqueue/*` monorepo explicitly list all five package names in a `"fixed"` or `"linked"` versioning group — or use independent versioning (Changesets default) where each package bumps on its own release cadence?
3. Should cliqueue pin the minimum npm CLI version in CI (e.g., `npm@10+`) to guarantee `publishConfig.access` is respected — since older npm versions had inconsistent handling of the `publishConfig` field for scoped packages?

---

## 2026-05-17 — @cliqueue/contracts co-location decision: separate repo is correct; wagmi CLI Foundry plugin is production-ready; commit generated ABI bindings; per-chain address map in wagmi.config.ts

**Question answered:** Should `@cliqueue/contracts` (ABI types + wagmi-generated hooks for `ClaimsAdjudicator` and `ISBTRegistry` on Somnia) be co-located in the same pnpm monorepo as the four FHIR/EDI packages, or kept in a separate repository aligned with the Solidity release cycle?

- **Separate repo is the correct architecture for `@cliqueue/contracts`.** Major DeFi projects that publish both Solidity contracts and TypeScript SDKs consistently separate the two at the repo level: Uniswap separates `v3-core` (Solidity) from `v3-sdk` (TypeScript); Aave separates `aave-v3-core` from `aave-js`; Compound separates `compound-protocol` from `compound-js`; OpenZeppelin separates Contracts from Defender client tooling. The common factor is that contract repos move on a slower, audit-gated cadence while SDK/tooling repos move on a regular development cadence. ([Uniswap v3-core](https://github.com/Uniswap/v3-core); [Uniswap v3-sdk](https://github.com/Uniswap/v3-sdk); [Aave v3-core](https://github.com/aave/aave-v3-core); [Compound protocol](https://github.com/compound-finance/compound-protocol))

- **The wagmi CLI Foundry plugin is production-ready and is the correct codegen path.** It reads Foundry `forge build` artifacts from `out/` and generates typed TypeScript ABI bindings and viem/wagmi hooks into a target file (e.g., `src/generated.ts`). Configuration: `foundry({ project: '../contracts', artifacts: 'out/' })`. Supports watch mode, glob include/exclude patterns (by default excludes test and script artifacts), broadcast detection for deployed addresses, and name-collision prefixing. No beta designation. ([wagmi CLI Foundry plugin](https://wagmi.sh/cli/api/plugins/foundry); [wagmi CLI getting started](https://wagmi.sh/cli/getting-started))

- **Commit generated ABI TypeScript bindings in the contracts repo** — do not regenerate-only-in-CI for a published package. The wagmi ecosystem norm is `out: 'src/generated.ts'` checked in alongside the Solidity source. This makes the generated output versioned alongside the ABI that produced it, and consumers can inspect the binding without running the generator locally. Regeneration in CI is used for validation (diff check), not as a substitute for the committed file. ([wagmi CLI getting started](https://wagmi.sh/cli/getting-started); [TypeChain pattern](https://github.com/dethcrypto/TypeChain))

- **Per-chain address map in `wagmi.config.ts` is the canonical multi-chain pattern.** Single contract declaration with `address: { [mainnet.id]: '0x...', [sepolia.id]: '0x...' }`. For cliqueue: `{ [somnia.id]: CLAIMS_ADJUDICATOR_MAINNET, [somniaTestnet.id]: CLAIMS_ADJUDICATOR_TESTNET }`. This generates one artifact supporting both chains with chain-aware hook/client code. ([wagmi CLI multi-chain address map](https://wagmi.sh/cli/getting-started))

- **ABI version pinning: consumer packages should pin `@cliqueue/contracts` to an exact semver or `^major`.** A contract upgrade that changes function signatures, events, or emitted data is a major version bump. Minor/patch versions cover additive changes (new view functions, new events) or address-only updates. FHIR/EDI packages (`pa-lifecycle`, `cds-hooks-client`, `cda-attachments`) list `"@cliqueue/contracts": "^1.0.0"` as a `devDependency` (used only for type imports), not a `dependency` — they do not ship ABI hooks to hospital app consumers. ([monorepo versioning strategies](https://amarchenko.dev/blog/2023-09-26-versioning/))

- **Foundry + pnpm coexistence is low-friction if repos are separate.** When co-located, pnpm's strict symlinked `node_modules` layout can conflict with tooling that assumes flat hoisting; Foundry itself uses `lib/` (not `node_modules`) for Solidity dependencies and is unaffected, but `wagmi generate` scripts and codegen helpers run via Node and can hit pnpm path resolution issues. Keeping the Foundry contract repo separate eliminates this class of interference entirely. Codegen runs as a separate CI job post-`forge build`, publishing the `@cliqueue/contracts` npm artifact. ([wagmi/wagmi discussions](https://github.com/wevm/wagmi/discussions/5003))

- **CI publish trigger for `@cliqueue/contracts`: gate on Solidity artifact diff, not on TS file changes.** Standard approach: CI runs `forge build` → `wagmi generate` → `git diff --exit-code src/generated.ts`; if diff detected, run Changesets publish. This ensures `@cliqueue/contracts` publishes only when the ABI changes, not when unrelated TS touches a sibling package in a shared monorepo. A separate contracts repo makes this CI path trivially simple — all commits to that repo are candidates for a contracts release.

**Design implication:** `@cliqueue/contracts` lives in a separate repository (the Solidity/Foundry project repo), not in the FHIR/EDI pnpm monorepo. The FHIR/EDI monorepo lists `@cliqueue/contracts` as an external npm dependency, pinned to the deployed ABI version. The contracts repo uses wagmi CLI Foundry plugin for codegen, commits `src/generated.ts`, and publishes to npm on every deployment-tagged Solidity release. This cleanly separates the two cadences and eliminates Foundry/pnpm toolchain interference.

**Open questions generated:**
1. Should cliqueue's Foundry contracts repo include a Changesets config alongside Foundry — or use a simpler manual `npm version` + `npm publish` workflow tied explicitly to deployment tags, given the infrequent Solidity release cadence?
2. Should `@cliqueue/contracts` export a `SOMNIA_CHAIN` viem chain definition (chain ID 5031, RPC URL, block explorer) alongside the generated ABI hooks — making it the single import point for Somnia connectivity in hospital agent apps?
3. Should the wagmi CLI `wagmi.config.ts` in the contracts repo support Somnia-specific chain configuration as a first-class plugin parameter — or require a manual chain-id entry until wagmi adds Somnia to its built-in chain list?

---

## 2026-05-17 — Somnia (chain ID 5031) is native in viem@2.49.2 / wagmi; Changesets is correct for @cliqueue/contracts despite low cadence; export SOMNIA_CHAIN is redundant

**Question answered:** (1) Does wagmi's built-in viem chain list include Somnia (chain ID 5031) — or must `wagmi.config.ts` define a custom chain object? (2) Should `@cliqueue/contracts` use Changesets or a manual `npm version` + `npm publish` workflow tied to deployment tags?

- **Somnia mainnet (chain ID 5031) and Somnia Testnet (chain ID 50312) are natively present in viem@2.49.2** as `somnia` and `somniaTestnet` respectively. This is verified against the wagmi chains reference page (`wagmi.sh/core/api/chains`) which is generated from viem's chain registry at the stated version. **Import path: `import { somnia, somniaTestnet } from 'viem/chains'`.** No custom `defineChain` is needed in `wagmi.config.ts`. ([wagmi chains docs](https://wagmi.sh/core/api/chains); [wagmi react chains](https://wagmi.sh/react/api/chains))

- **Consequence: `@cliqueue/contracts` does NOT need to export a `SOMNIA_CHAIN` viem object.** Hospital integration engineers can import `somnia` directly from `viem/chains` (already a transitive dependency via wagmi). Exporting a redundant chain definition would create a version-skew risk if `@cliqueue/contracts` pins one viem version and the hospital app uses a newer one. The correct pattern: `wagmi.config.ts` in the contracts repo uses `import { somnia, somniaTestnet } from 'viem/chains'` natively, and the published package's README links to `viem/chains` for chain configuration. ([viem chains source](https://github.com/wevm/viem/tree/main/src/chains))

- **`wagmi.config.ts` multi-chain address map using native chain IDs is confirmed.** The per-chain address pattern `{ [somnia.id]: '0x...', [somniaTestnet.id]: '0x...' }` works with the native imported chain objects — no custom chain definition needed. This resolves the prior open question about whether cliqueue must manually configure the chain in `wagmi.config.ts`. ([wagmi CLI foundry plugin](https://wagmi.sh/cli/api/plugins/foundry))

- **Changesets is the correct versioning tool for `@cliqueue/contracts` even at low cadence.** OpenZeppelin Contracts (the canonical Solidity npm package benchmark) uses `@changesets/cli` in its `devDependencies` alongside a custom `scripts/release/version.sh`. This confirms that the DeFi/web3 norm for published Solidity packages is Changesets + CI automation, not manual `npm version`. Changesets accumulates intents during development and batches them into a release PR — which matches the low-cadence "accumulate across many PRs, ship when audit is done" pattern for Solidity. ([OpenZeppelin contracts package.json](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/package.json); [Changesets GitHub](https://github.com/changesets/changesets))

- **Changesets tradeoffs at low Solidity cadence are minor.** The overhead is: (a) each PR that changes ABI or address must include a `changeset add` step creating a changeset file, (b) a release PR is opened by the Changesets bot aggregating all pending changesets. For a repo that releases 3–5× per year, this is low-friction. The benefit is automated CHANGELOG.md generation, consistent semver intent tracking across contributors, and a release PR that is independently reviewable before `npm publish`. Manual `npm version` has no such audit trail.

- **Recommendation: single-package Changesets config in the contracts repo.** Use `pnpm changeset` (not the full monorepo Changesets setup from the FHIR/EDI repo). Since `@cliqueue/contracts` is a standalone package (not a workspace), a minimal `.changeset/config.json` with `"linked": []` and a GitHub Actions workflow calling `changeset publish` after `forge build` + `wagmi generate` is sufficient. No Turborepo or pnpm workspace needed. ([Changesets single-package repo guide](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md))

**Design implication:** `wagmi.config.ts` in the `@cliqueue/contracts` Foundry repo imports `somnia` and `somniaTestnet` directly from `viem/chains` — no custom chain object. The contracts repo uses Changesets (not manual `npm version`) for release versioning, following the OpenZeppelin pattern. `@cliqueue/contracts` does not export a `SOMNIA_CHAIN` constant; the README instructs hospital engineers to import from `viem/chains`.

**Open questions generated:**
1. Should the `@cliqueue/contracts` Changesets config use `"access": "public"` on a scoped package — and does npm require an explicit `publishConfig.access` field in `package.json` for `@cliqueue/*` scoped packages to publish publicly without a paid org account?
2. Should cliqueue pin a minimum viem version in `@cliqueue/contracts`'s `peerDependencies` (e.g., `"viem": ">=2.49.2"`) to guarantee that `somnia` chain ID 5031 is available — or rely on documentation alone?
3. Should the `@cliqueue/contracts` GitHub Actions release workflow run `forge build` → `wagmi generate` → `changeset publish` in a single job, or split into separate `build` and `publish` jobs with artifact upload between steps?

---

**See also** — [[../topics/cda|CDA hub]] · [[../topics/sbt|SBT hub]]

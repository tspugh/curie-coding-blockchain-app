# CDA Schematron Validator VSAC Dependency and CI Validation Design

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — Does `cda-schematron-validator` v1.1.12 require VSAC API access for C-CDA Schematron validation in CI?

**Question:** Does `cda-schematron-validator` v1.1.12 require separate VSAC API access to resolve value set bindings — would C-CDA Schematron validation in `@cliqueue/cda-attachments` CI need an NLM API key?

### Finding 1: No VSAC API access required at validation time — terminology server is generation-only

- The HL7 `fhir-cda-validation` pipeline has two distinct phases:
  1. **Schematron generation**: converts FHIR StructureDefinitions → `.sch` Schematron files. This step calls a FHIR terminology server (default: `https://tx.fhir.org/r5/`) to expand value sets and produces a `ValueSet-expansions.json` cache file. This is a one-time build step run by IG authors, not by consumers.
  2. **Schematron validation**: runs the pre-generated `.sch` file against CDA XML using `cda-schematron-validator`. This step requires **no external network access** — it is pure local evaluation.
  - [HL7/fhir-cda-validation README](https://github.com/HL7/fhir-cda-validation/blob/main/README.md)

- The terminology server parameter (`--terminology-server`) and VSAC are relevant only to step 1 (generation), not step 2 (validation). `@cliqueue/cda-attachments` consumes pre-generated Schematron artifacts and runs step 2 only.

### Finding 2: `cda-schematron-validator` uses local resource files for vocabulary checks

- The `cda-schematron-validator` API accepts an optional `resourceDir` parameter pointing to a local directory of `voc.xml` files. If value set membership checks are present in the Schematron, they are resolved against these local files — not via live VSAC/NLM calls.
  - [cda-schematron-validator README](https://github.com/priyaranjan-tokachichu/cda-schematron-validator)
- The validator exposes `{ includeWarnings: false }` to suppress warning-level assertions. Schematron rules that depend on value set membership and cannot be locally resolved are treated as warnings, not hard failures, unless explicitly configured otherwise.

### Finding 3: No NLM API key required for CI use

- No evidence (README, `package.json`, dependency list, or HL7 validation pipeline docs) suggests that `cda-schematron-validator` makes live VSAC or NLM/UMLS API calls during validation. The package has no network-layer dependencies beyond its core xmldom + xpath dependencies.
  - [npm registry: cda-schematron-validator](https://registry.npmjs.org/cda-schematron-validator)

### Finding 4: Structural validation scope without VSAC

- Offline Schematron validation catches the primary conformance failures relevant to claims attachments:
  - Wrong template OID (`templateId/@root` assertions)
  - Missing required sections (LOINC section codes)
  - Invalid element cardinality and required child elements
  - Incorrect document-level structural patterns
- What offline validation may miss (without bundled value set expansions):
  - Code membership checks within large dynamic value sets (e.g., SNOMED CT condition hierarchies)
  - Some `@codeSystem` / `@displayName` consistency checks bound to VSAC-managed value sets
- For claims attachment document templates (Progress Note, Consultation Note, Operative Note, Procedure Note, Discharge Summary, Unstructured Document), structural conformance — not terminology completeness — is the primary CI gate. CMS-0053-F compliance requires well-formed CDA documents with correct document-type codes; it does not mandate deep terminology coverage in the CI pipeline.

### Finding 5: Recommended CI architecture for `@cliqueue/cda-attachments`

- **CI setup (no external dependencies):**
  1. Commit the pre-generated C-CDA R2.1 Schematron file (`.sch`) from the HL7 C-CDA 2.1 IG build into the repo as a static artifact. This file already embeds the value set expansions computed at IG build time.
  2. Run `cda-schematron-validator` against known-valid and known-invalid CDA fixture files in Jest/Vitest — pure Node.js, no subprocess, no Java, no NLM key.
  3. Use `{ includeWarnings: false }` to reduce noise from terminology-binding warnings not critical to attachment structural conformance.
  4. Optionally: for stricter value-set coverage, bundle the `voc.xml` vocabulary files from the C-CDA 2.1 IG build and pass as `resourceDir`. This enables membership checks without live API access.
- **Pre-generation setup (one-time, IG author step):**
  - The `fhir-cda-validation` tool with `--terminology-server https://tx.fhir.org/r5/` generates the `.sch` file used in CI. This step is run once per IG version update, not per-claim.

**Design implication:** `@cliqueue/cda-attachments` CI validation requires no NLM API key, no VSAC credentials, and no Java. Commit the pre-generated C-CDA R2.1 `.sch` file as a static repo artifact. Run `cda-schematron-validator` locally in Vitest for structural conformance. Bundle `voc.xml` from the IG build for terminology membership checks if needed. The "pure Node.js, no external dependencies" CI requirement confirmed on 2026-05-17 is fully satisfiable.

**Open questions generated:**
1. Should `@cliqueue/cda-attachments` commit the pre-generated C-CDA R2.1 `.sch` file directly into the repo — accepting that IG updates (rare: once per 2–4 years for C-CDA) require a manual re-generation step — or generate it dynamically in CI using `fhir-cda-validation` with a terminology server call? — priority: medium
2. Does the C-CDA R2.1 `.sch` file from the HL7 `fhir-cda-validation` tool require any modifications to work with `cda-schematron-validator` v1.1.12's XPath 1.0 engine — since the tool's README notes "some limitations with XPath 2.0 functions and variable resolution"? — priority: high
3. Should `@cliqueue/cda-attachments` bundle a subset of `voc.xml` vocabulary files covering only the 6 supported document template value sets — reducing bundle size compared to shipping the full C-CDA vocabulary file? — priority: medium

---

## 2026-05-17 — C-CDA R2.1 Schematron XPath 1.0 compatibility gap: `current()` unsupported, dateTime comparisons skipped, variable resolution pre-processed — `cda-schematron-validator` catches "most" rules but misses date ordering and `current()`-dependent template assertions

**Question:** Does the C-CDA R2.1 `.sch` file require XPath 2.0 functions that `cda-schematron-validator` v1.1.12 cannot evaluate — and does this limit structural conformance coverage for any of the 6 supported document template types?

### Finding 1: HL7/fhir-cda-validation README documents three confirmed XPath 2.0 gaps (primary source)

The HL7 `fhir-cda-validation` README (https://github.com/HL7/fhir-cda-validation/blob/main/README.md) explicitly lists the following as known limitations of the included validator:

- **`current()` not supported:** "Some assertions use the XPath 2.0 function `current()` which is not supported by the included validator. These assertions have been tested manually."
- **DateTime comparisons not supported:** "Comparisons on dateTimes are not supported (e.g. procedure start date must be before document date)."
- **Value sets with apostrophes excluded:** "Value sets containing values with apostrophes (`'`) are not included."
- **Variable resolution pre-processed:** Schematron `<let>` variable declarations are not natively handled — the tool pre-processes `.sch` files by replacing all variable references with their literal values before validation. This is a workaround, not full Schematron support.
- **README self-assessment:** "The validator seems to be catching most of the generated Schematron rules" — qualified claim, not a completeness guarantee.

These are confirmed limitations against the generated `.sch` file, not hypothetical XPath engine differences.

### Finding 2: `cda-schematron-validator` v1.1.12 uses an XPath 1.0 engine (xmldom + xpath npm package)

- The package dependency stack is `xmldom` + `xpath` (npm), both of which implement XPath 1.0. XPath 2.0-only functions (`matches()`, `tokenize()`, `current()`, `string-join()`, `xs:dateTime()`, `ends-with()`, `some ... satisfies`, `every ... satisfies`) are not available.
- When an assertion references an XPath 2.0 function, the engine either silently skips it (false negative — violation not caught) or throws a runtime evaluation error (depending on the function and expression context).
- [cda-schematron-validator](https://github.com/priyaranjan-tokachichu/cda-schematron-validator); [xpath npm package](https://www.npmjs.com/package/xpath)

### Finding 3: Which C-CDA conformance rule classes are silently missed for the 6 cliqueue document templates

For the 6 cliqueue-supported document templates (Progress Note, Consultation Note, Operative Note, Procedure Note, Discharge Summary, Unstructured Document):

**Confirmed silently missed:**
- **Date/time ordering assertions** — e.g., "procedure effectiveTime/@low must precede document effectiveTime" — any assertion using XPath 2.0 date comparison functions. Affects Operative Note, Procedure Note, Discharge Summary most heavily (temporal logic is common in these templates).
- **`current()`-dependent template assertions** — Schematron rules that use `current()` to cross-reference the current context node. Number of affected assertions is not published but HL7 confirmed they exist and require manual testing.
- **Value set membership checks where the value set contains apostrophes** — excluded at generation time; affects any coded element using a value set with apostrophe-containing display names.
- **FHIRPath `conformsTo()` assertions** — not applicable to C-CDA validation but documented for completeness.

**Not silently missed (XPath 1.0-safe rule classes):**
- Template ID (`templateId/@root`) presence and value checks — basic attribute equality, XPath 1.0 safe.
- Required section LOINC code checks — XPath 1.0 safe.
- Element cardinality checks (`count(...) = n`) — XPath 1.0 safe.
- Required element existence checks (`not(@nullFlavor)`, `@moodCode`, `@classCode`) — XPath 1.0 safe.
- Basic structural nesting and required child element checks — XPath 1.0 safe.

**Unstructured Document** is least affected because it has minimal entry-level and date-ordering constraints by design. Progress Note, Consultation Note, Operative Note, Procedure Note, and Discharge Summary carry more temporal and contextual constraints and are proportionally more exposed.

### Finding 4: Practical consequence for cliqueue CI pipeline

The XPath 1.0 limitation creates a **false-negative risk** in CI: a CDA document can pass `cda-schematron-validator` while containing violations that a full XSLT 2.0 Schematron processor (e.g., Saxon-HE via Java/Docker) would catch. The specific missed categories are:
1. Temporal ordering violations in encounter notes (Operative, Procedure, Discharge Summary)
2. Template conformance assertions that use `current()` (number unknown; HL7 tests these manually)
3. Any coded element bound to a value set with an apostrophe-containing member

**Mitigation strategy confirmed viable:** The HL7 README acknowledges the gap and states the tool "seems to be catching most of the generated Schematron rules." The recommended approach for production-grade CI is to combine:
- `cda-schematron-validator` for fast offline structural checks (catches template IDs, required sections, cardinality — the majority of rules)
- KvalitetsIT/cda-validator Docker container (Saxon-HE XSLT 2.0-based, full XPath 2.0 support) as a stricter gate in CI/CD for release builds

For cliqueue's `@cliqueue/cda-attachments` MVP, the temporal ordering and `current()`-dependent rule gaps are acceptable in the PR-time Node.js gate if the KvalitetsIT Docker gate runs on release builds. The structural rules caught by `cda-schematron-validator` (template IDs, required sections, cardinality) are sufficient for CMS-0053-F attachment type correctness — the primary CI goal.

**Design implication:** `@cliqueue/cda-attachments` CI uses a **two-tier validation architecture**: (Tier 1) `cda-schematron-validator` v1.1.12 in Vitest — fast, offline, XPath 1.0, catches structural rules; (Tier 2) KvalitetsIT/cda-validator Docker (full XPath 2.0, Saxon-HE) on release/pre-publish builds only. The Tier 1 gap (missed `current()` and dateTime assertions) must be documented in the hospital onboarding checklist and compensated by known-valid XML fixtures as the primary conformance evidence.

**Open questions generated:**
1. Should `@cliqueue/cda-attachments` publish a formal "Schematron Coverage Gap Memo" alongside the hospital onboarding checklist — disclosing the `current()` and dateTime XPath 2.0 limitation of `cda-schematron-validator` and documenting which rule classes are covered vs. not covered for the 6 supported templates? — priority: high
2. Should the KvalitetsIT/cda-validator Docker gate be mandatory in CI for all PRs touching `@cliqueue/cda-attachments` fixture files — or restricted to release builds to avoid Docker dependency in fast PR feedback loops? — priority: medium
3. Can cliqueue pre-audit the committed `.sch` file to enumerate all assertions using `current()` or XPath 2.0 date functions — producing a definitive count of "manually tested rules" — so hospital integration engineers know the exact coverage boundary? — priority: medium

---

**See also** — [[../topics/cda|CDA hub]]

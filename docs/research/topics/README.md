---
title: Research Topic Hubs — Index
type: topic-hub-index
status: navigation
---

# Research Topic Hubs

Cross-cutting indices over `docs/research/`. Each hub answers a single recurring-theme question:
"if I want everything in this repo that touches *X*, where is it?"

Hubs are **navigation, not summary**. They link to source files; they do not paraphrase them.

See also: [[../../INDEX|docs index]] · [[../log|research log]] · [[../research-questions|open research questions]]

---

## Active hubs

- [[corti]] — Corti / Symphony references: as off-chain coder, as MCP service, and as a HIPAA business associate.
- [[x12]] — X12 EDI transaction sets (837, 835, 275, 277), adapter boundary, and regulatory adjacencies.
- [[cda]] — HL7 Clinical Document Architecture: validation, X12 275 package boundary, TS ecosystem, FHIR replacement track.
- [[sbt]] — Soulbound-token credential primitive: registry data design, scoping, lifecycle, staffing floor, claim-flow integration.
- [[prior-auth]] — Prior authorization on-chain encoding: `paStatus`, `paAuthHash`, `satisfiedPaId`, `paHash`, related events.
- [[settlement-stablecoin]] — Settlement token (USDC native vs USDC.e, USDso, Frax, SOMI), governance, GENIUS Act / DASP perimeter.
- [[hipaa]] — HIPAA / PHI boundary: on-chain boundary, BAA chain, re-identification, minimum-necessary. **Selective hub** — only files where HIPAA is the *primary* subject.
- [[dispute-window]] — Dispute window architecture: events, storage, listener, window governance, BFT-vs-app-layer finality.
- [[upgradeable-proxy]] — Upgradeable proxy + Timelock + multisig: proxy pattern, timelock design, governance multisig, DASP interaction.
- [[somnia-substrate]] — Somnia chain capabilities cliqueue depends on: finality/TPS/gas, EVM hardfork level, precompiles, event subscription, ZK verification, agent runtime model.

## Candidate hubs (not yet written)

Themes that recur across many research files and would benefit from a hub once someone has a 30-minute window to write one. Drafting order is roughly:

- **Events & subscription mechanics** — `somnia/eth-subscribe-*`, `data-streams-sdk-*`, `claim-submitted-event-*`, `ClaimPAStatusResolved*`. *(Note: partly indexed by [[dispute-window]] Listener section + [[prior-auth]] events section + [[somnia-substrate]] event-subscription section.)*
- **Change Healthcare narrative thread** — referenced in many files as the "why decentralize" anchor; would consolidate the citation chain.
- **Off-chain trust models** — `tee-attestation-*`, `oracle-attestation-schemes`, `zkverify-*`, `phase2-custom-agents-*`. *(Note: partly indexed by [[somnia-substrate]] ZK / Agent-runtime sections.)*

## Bidirectional connectivity status

The hubs link **outward** to source files; source files mostly do not yet link **back**. To make navigation bidirectional, source files can carry a minimal `See also` footer:

```markdown
---

**See also** — [[../topics/corti|Corti hub]] · [[../topics/x12|X12 hub]]
```

**Pilot coverage** (updated 2026-05-18, iteration 9):

✅ **All 5 `docs/research/` source folders are now at 100% footer coverage (120/120 files).**

| Folder | Footer coverage |
|--------|-----------------|
| `agreement-layer/` | 29 / 29 (100%) |
| `ai-models/` | 6 / 6 (100%) |
| `market/` | 17 / 17 (100%) |
| `regulatory/` | 19 / 19 (100%) |
| `somnia/` | 49 / 49 (100%) |

Iteration history:
- iteration 4 — 5 Corti-anchored files in `ai-models/`
- iteration 5 — 12 SBT + 9 PA files in `somnia/` + 1 in `agreement-layer/`
- iteration 6 — 9 settlement-stablecoin + 10 X12/CDA files
- iteration 7 — all 19 `regulatory/` + 7 dispute somnia + 3 timelock/proxy agreement-layer
- iteration 8 — all 17 `market/` + 10 remaining `agreement-layer/`
- iteration 9 — all 19 remaining `somnia/` + 1 `ai-models/` (paired with new [[somnia-substrate]] hub)

**The navigation system is structurally complete.** Future iterations can:
- *Maintain* — when new research files are added, follow the convention in the matching cluster.
- *Deepen* — add more text inside existing hubs (e.g. expand the "Frame" section of a hub when more is known).
- *Refactor* — split a hub if it grows unwieldy (e.g. a future "Events & subscription mechanics" hub split from [[dispute-window]] + [[prior-auth]] + [[somnia-substrate]]).
- *Audit* — periodically re-grep the codebase to ensure new files have footers and hubs link them.

## Conventions for writing a new hub

1. **One file per recurring topic.** Filename = kebab-case slug = the wiki-link name (`[[corti]]`).
2. **Frontmatter:** include at least `title`, `type: topic-hub`, `status: navigation`.
3. **Open with a one-paragraph framing.** What is this topic and why does it recur in this repo? Cite the project's framing (e.g. PHI boundary, X12 interop) rather than invent new claims.
4. **Group links by question, not by folder.** The folder tree is already the default index; the hub's value is a new axis.
5. **One-line glosses, ≤ 12 words.** The hub should be a map. Detail belongs in the linked file.
6. **Top-of-file `See also:` row.** Link to neighbouring hubs and back to the root index. This keeps the wiki connected even if a reader entered through any single hub.
7. **Footer: "How to extend this hub".** Explicit instructions so a future contributor knows where new files go.

## Conventions for source-file footers (bidirectional connectivity)

Every research source file should carry a minimal `**See also**` footer at the very end, separated from the file's content by a horizontal rule. This is what makes the navigation graph bidirectional — without it, hubs only link outward.

**Template:**

```markdown

---

**See also** — [[../topics/HUB1|HUB1 hub]] · [[../topics/HUB2|HUB2 hub]]
```

**Rules:**

1. **Exactly 5 lines:** blank, `---`, blank, `**See also** — …`, no trailing blank.
2. **Place at the very end of the file**, after all existing content (including any "Open questions" section). The footer is navigation metadata, not part of the file's content.
3. **List 1-4 hubs** in order of relevance. The first hub should be the file's *primary* topic; later hubs are secondary or cross-cutting.
4. **Use display names ending in "hub"** (e.g. `[[../topics/corti|Corti hub]]`) so the navigation purpose is unambiguous in plain-markdown viewers.
5. **No content commentary in the footer.** It's a pointer, not a summary.

**When to skip the footer:**

- The file is a *topic hub* itself (`docs/research/topics/*.md`) — those use the top-of-file `See also:` row instead, since they're already navigation.
- The file is a *reference capture* of external material (`docs/reference/curie/*`, `docs/reference/somnia-agent-kit/*`) — those are imported wholesale; we don't modify them.
- The file is *human-gated* (e.g. `docs/VISION.md`, `docs/PROTOTYPE_SPEC.md` per `CLAUDE.md`) — don't add anything without explicit approval.

**Beyond `docs/research/`:** the same pattern applies to framing docs (e.g. [[../../ROADMAP|ROADMAP]] carries a multi-hub footer) and domain references (e.g. [[../../domain/payer-architecture|domain/payer-architecture]]). For *historical* documents like amendments, the footer can explicitly call out the supersession (e.g. "historical context only — current answer lives in …").

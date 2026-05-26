---
name: spec-author
description: >-
  Use this WHENEVER authoring, editing, or reviewing a build spec in `docs/specs/`
  of the Curie application repo — or when asked to "write a spec", "turn this into
  a spec", or "standardize a spec". It defines the required structure every spec
  must follow (user story, requirements, technical documentation, deliverables,
  test cases, pass/fail criteria) so specs are consistent and executable. Trigger
  it before creating a new `docs/specs/NNNN-*.md` file or when a spec is missing
  any required section.
---

# Spec author — the standard structure for `docs/specs/`

A spec in `docs/specs/` is the source of truth for a unit of work: enough that an
implementer (human or agent) can build it and an independent reviewer can decide,
objectively, whether it's done. Every spec MUST contain the sections below, in order.
Keep examples synthetic — **no PHI** ever appears in a spec.

## File & header conventions

- **File name:** `docs/specs/NNNN-kebab-title.md` (`NNNN` = next free four-digit number; never reuse).
- **Header block** at the top:
  - `# SPEC-NNNN: <title>`
  - A status line: `Status: Draft | Approved | In progress | Implemented | Superseded` · `Owner:` · `Date:`

## Required sections

### 1. Summary & user story
One or two sentences on what this delivers, then a short user story:
> As a `<role>`, I want `<capability>`, so that `<benefit>`.
Add more than one story only if the spec genuinely serves multiple roles.

### 2. Requirements
The functional/behavioral requirements, numbered (`R1`, `R2`, …) so tests and criteria
can reference them. State *what* must be true, not *how*. Mark each MUST / SHOULD.

### 3. Technical documentation
The design — the *how*. Cover what applies: architecture, on-chain/off-chain boundary,
contract interface (states, functions, events, guards), data shapes/types, key flows,
external endpoints/APIs used, network params, and dependencies. Diagrams and code
sketches welcome. This is the section an implementer works from.

### 4. Deliverables
A concrete, checkable list of artifacts this spec produces — files, contracts,
endpoints, agents, UI, fixtures, docs. One bullet per artifact.

### 5. Test cases
What must be tested — the *cases/scenarios* to cover (happy paths, edge cases, guard
violations, security checks), not the test implementation. Reference requirement IDs.

### 6. Pass / fail criteria
The objective gate. Two explicit lists:
- **PASS — all must hold:** the conditions that mean the spec is satisfied (checkbox list).
- **FAIL — any triggers rejection:** disqualifying conditions (e.g., PHI on-chain, a guard that doesn't revert, a deliverable missing).

### 7. Out of scope
What this spec deliberately excludes / defers, so reviewers don't expect it.

### 8. Open questions
Unresolved decisions, each with a priority. Empty is fine — say "None."

## Authoring rules

- Requirements (§2) are *what*; technical documentation (§3) is *how*; pass/fail (§6)
  is *how we know it's done*. Don't blur them.
- Every PASS criterion should trace to a requirement and be checkable by a reviewer
  who didn't write the spec.
- Synthetic data only in examples; never include real identifiers.
- Keep it scannable: short sections, lists over prose where possible.

# Technical Design

Design notes that sit between [`docs/specs/`](../specs/) (what to build) and the
code. Use this folder for diagrams, sequence walkthroughs, alternatives that were
weighed, and design rationale that isn't an ADR-style amendment.

- [`appeal-ladder-enforcement.md`](appeal-ladder-enforcement.md) — Part D / commercial appeal-ladder encoding: `(payerLine, appealRound)` on-chain, ladder-specific filing windows / amount-in-controversy thresholds / sequencing / terminal rounds, UI stage-name table. Implements SPEC-0004 §2.4.

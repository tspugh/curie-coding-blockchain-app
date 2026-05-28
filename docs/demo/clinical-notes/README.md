# Demo Clinical Notes — placeholder

This folder is reserved for **synthetic, de-identified** clinical-note material used
to drive demo runs of the coverage-exception flow (provider packet → AI mediator
ruling → settlement).

No notes are checked in yet. The earlier set of synthetic notes (diabetes foot ulcer,
chest-pain workup, COPD exacerbation, upper respiratory, knee osteoarthritis) was
written for a coder-UI demo and has been retired — it doesn't fit the drug
coverage-exception arbitration flow this product runs.

When demo material lands here it must:

- be **synthetic** — no real patient data, ever (see the no-PHI-on-chain rule);
- focus on the **drug coverage-exception** scenario (non-formulary or step-therapy
  request, provider justification, payer criteria, AI-mediator ruling);
- be small enough to commit byte-identically and reference by hash from the
  on-chain exchange.

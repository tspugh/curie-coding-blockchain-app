# Curie — Demo Video Transcript (v1 draft)

**Format:** ~2.5 min promo. Live screen-recordings + static slides, **voiceover-narrated**.
**Audience:** hackathon judges (technical, skeptical — show it's *real* and *on-chain*).
**Centerpiece:** the deny→appeal→**approve** flip (Scene 5) — recorded **only after** the live flip
lands (Part D of the plan). Until then, Scene 5 is scripted but not shot.

**Honesty rails:** every workflow shown is live-verified; synthetic data only; every stat is sourced
or flagged `NEEDS SOURCE`. Do **not** imply features that aren't real (no price arbitration; on-chain
reasoning text is roadmap).

**Legend:** 🎬 = on-screen action/visual · 🎙️ = voiceover · ▢ = on-screen caption · 📌 = source.

---

### Scene 1 — Hook: the problem (0:00–0:18)  · SLIDE
- 🎬 Problem slide (faxes / phone-tree / "peer-to-peer review" imagery).
- 🎙️ "Getting a drug covered shouldn't take a week. But today it does — prior authorization is a
  paperwork shuffle of faxes, phone trees, and peer-to-peer reviews between providers and payers."
- ▢ "Part D standard decision: up to **72 hours**. Commercial peer-to-peer: **5–10 business days**."
- 📌 `docs/domain/coverage-exception-process.md` §3 (CMS / Pharmacy Times).

### Scene 2 — Positioning (0:18–0:32)  · SLIDE
- 🎬 Title slide: **Curie — AI Drug Coverage Arbiter**.
- 🎙️ "Curie replaces that black box with autonomous AI agents that read the actual clinical evidence
  and rule on coverage — on a public blockchain. Every decision is escrowed, auditable, and final.
  And patient data never leaves the clinic."
- ▢ "Autonomous · On-chain · Auditable · PHI-free."

### Scene 3 — Hero: a valid request, approved (0:32–1:12)  · LIVE
- 🎬 New Request → **Load demo: Adalimumab (Humira) · plaque psoriasis**. Show the justification field's
  "stays off-chain — only a hash on the blockchain." Submit. Switch to **Payer**, attach the Part D
  policy. Provider → **Request AI Decision** → badge flips to **"AI reviewing…"**. The ruling lands →
  **Approved**. Both parties **Accept** → **Settled** (STT moves). Open **blockchain proof**.
- 🎙️ "Here's the whole loop, live on Somnia. A provider requests Humira for plaque psoriasis and cites
  the FDA label. An autonomous agent reads that label on-chain, confirms the indication, and approves —
  then real escrow settles between payer and provider. Start to finish, about a minute."
- ▢ "Agent reads FDA label → Approved → escrow settled on-chain."

### Scene 4 — Integrity: an invalid request, denied (1:12–1:34)  · LIVE
- 🎬 New Request → **Bupropion (Wellbutrin) · ADHD**, cites the FDA label. Run the decision → **Denied**.
- 🎙️ "But it's not a rubber stamp. Ask it to cover bupropion for ADHD — an off-label use — and the same
  agent reads the same FDA label and correctly denies. It's actually adjudicating the evidence."
- ▢ "Off-label, unsupported by the FDA label → Denied. Not a yes-machine."

### Scene 5 — Centerpiece: appeal with stronger evidence → flips to Approved (1:34–2:08)  · LIVE *(contingent on Part D)*
- 🎬 From the Denied bupropion request, provider **Appeals** citing the **Cochrane systematic review**
  (PubMed). Badge → "AI reviewing…" → re-ruling lands → **Approved**. Stepper advances; proof panel
  shows the appeal round on-chain.
- 🎙️ "So the provider appeals — this time citing a Cochrane systematic review showing bupropion
  reduces ADHD symptoms. The agent re-reads, weighs the stronger evidence, and reverses itself to
  approve. Due process — multi-round, evidence-based, and automated."
- ▢ "Appeal → agent re-reads Cochrane review → Approved. Evidence-based reversal."

### Scene 6 — Privacy + transparency (2:08–2:28)  · LIVE quick-cuts
- 🎬 The justification "stays off-chain" + hash preview; the **blockchain-proof** panel (hashes +
  verify-on-chain link); the **Network** live event stream.
- 🎙️ "Throughout, no patient record ever touched the chain — only cryptographic hashes. And every
  decision, every appeal, every settlement is right there on Somnia, independently verifiable."
- ▢ "PHI stays off-chain (hashes only) · every step verifiable on Somnia."

### Scene 7 — Stats (2:28–2:42)  · SLIDE
- 🎬 Stat slide(s).
- ▢ "Days → minutes." · "Real on-chain settlement: <tx hash / block from the live demo>." ·
  "Built on Somnia: **1M+ TPS, sub-second finality**."
- 📌 Somnia figures = Somnia-published (attribute on-slide). Real tx hash/block = captured from the
  live runs (Scenes 3 & 5). **`NEEDS SOURCE`** before adding any physician-time / admin-cost burden stat.

### Scene 8 — Close (2:42–2:55)  · SLIDE
- 🎬 Closing title + tagline.
- 🎙️ "Curie: drug-coverage decisions that are fast, fair, auditable, and private — by design."
- ▢ "Curie — coverage, arbitrated. · <link / QR to the live demo>."

---

## Open items for iteration (with the user)
- **Tone/length:** target ~2.5 min; trim Scene 6 first if over.
- **Scene 5** shoots only once the live flip is real (Part D). Fallback if we choose not to ship the
  flip: cut Scene 5, extend Scene 4's "it appeals" as roadmap, retime to ~2:20.
- **Burden stat** (Scene 7): find a citable physician-time / cost figure, or drop it. Do not invent.
- Decide voice (you) + music bed; captions reinforce stats only (not full subtitles).

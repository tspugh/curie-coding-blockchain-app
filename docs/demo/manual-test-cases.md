# Demo — off-label appeal-flip test cases

Reusable, copy-paste inputs for the **deny → appeal → approve** flip: a provider requests an
**off-label** drug, the AI agent denies it against the FDA label, the provider **appeals** with an
authoritative compendia source, and the agent **reverses to Approved**.

**How the flip works (and what's experimental).** The on-chain "scrape" agent returns a single
short passage from the appeal URL. For an off-label drug, a raw source (StatPearls, a long abstract)
often yields the *"used off-label"* background line, so the decision correctly stays Denied. We
sidestep that by pointing the appeal at a **hand-curated, support-forward document** whose entire
content is the efficacy/compendia case — so the extractor can't miss it. This is **curated per
case** (the honest "experimental, improving" framing); the general version (auto-fetch and distill
*any* authoritative source) is SPEC-0010's normalizer, still deferred. Curated docs cite **public**
sources only; **no PHI**.

Both cases are **live-verified on-chain** against the live contract
`0xBc7d5097904133055EDB93e50AEfd6A2f8E81C7E` (no redeploy needed — it scrapes whatever appeal URL is
supplied). Curated docs are served durably from CloudFront (`web/public/evidence/`).

---

## Case 1 — Bupropion × ADHD  *(wired into the demo)*

The easy path: it's in the **"Try a demo" dropdown**, and the appeal form has a one-click
**"Load compendia evidence (experimental)"** button that fills the appeal URL for you.

- Dropdown: **Bupropion (Wellbutrin) — ADHD (off-label, expect Deny)**
- Initial evidence (auto-filled): `https://api.fda.gov/drug/label.json?search=openfda.brand_name:WELLBUTRIN&limit=1` → **Denied**
- Appeal evidence (via the button): `https://d2inaytdsjck4j.cloudfront.net/evidence/bupropion-adhd.txt` → **Approved**
- Curated doc cites: **Cochrane systematic review, PMID 28965364** ("bupropion decreased the severity of ADHD symptoms").
- On-chain proof: **reqId 2** — `state=Approved`, `appealRound=1`.

---

## Case 2 — Amitriptyline × Migraine prophylaxis  *(manual entry)*

Not in the dropdown and **no auto-fill button** — paste every field, including the appeal URL by hand.
Amitriptyline is FDA-approved for *depression*; its label does not list migraine (verified).

**New Request form:**

| Field | Value |
|---|---|
| Medication Name | `Amitriptyline (Elavil)` |
| Why is this medication needed? | `Adult with frequent episodic migraine inadequately controlled on first-line measures; clinician requests amitriptyline for migraine prophylaxis (off-label — amitriptyline is FDA-approved for depression).` |
| Evidence URL | `https://api.fda.gov/drug/label.json?search=openfda.generic_name:amitriptyline&limit=1` |
| Agent Prompt Hint | `A patient with frequent migraine requests amitriptyline for migraine prophylaxis (off-label; amitriptyline is FDA-approved for depression). Reply approve if amitriptyline is FDA-approved OR supported by recognized clinical compendia/guidelines for migraine prophylaxis; reply deny if the evidence does not establish an approved or compendia-supported use for migraine prophylaxis; needs_more_info if insufficient.` |
| Quantity (units) | `1` |
| Days Supply | `30` |
| Amount Requested (STT) | `0.005` |
| Payer line | `Commercial` |

**Appeal evidence URL** (paste into the appeal's Evidence URL field after it Denies):
```
https://d2inaytdsjck4j.cloudfront.net/evidence/amitriptyline-migraine.txt
```
- Curated doc cites: **BMJ meta-analysis, PMID 20961988** + the **AAN/AHS** migraine-prevention guideline.
- On-chain proof: **reqId 3** — `state=Approved`, `appealRound=1`.

---

## Flow to reproduce (both cases)
1. **New Request** → enter the fields (or pick the dropdown for bupropion) → **Submit**.
2. Switch role to **Payer** → attach a policy → **Engage**.
3. Switch back to **Provider** → **Request AI Decision** → ~30–60s → **Denied** (off-label).
4. **Appeal** → set the appeal Evidence URL to the curated doc (button for bupropion; paste for
   amitriptyline) → submit → ~30–60s → **Approved**.

## Notes
- **STT cost:** each full live run is ~**1.4 STT** (two on-chain rulings). Provider
  `0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128` held **4.69 STT** as of the last run (~3 runs left
  before a top-up).
- **Adding another off-label case:** drop a curated `web/public/evidence/<drug>-<indication>.txt`
  (cite a public source; support-forward text only), redeploy static, and point the appeal at it.
  To wire it into the dropdown + button, add `appealEvidenceUrl` in `web/src/drugEvidenceMap.ts`.
- **Degrades safely:** an off-label drug with no curated doc just stays Denied on appeal with a
  random URL — it doesn't crash.

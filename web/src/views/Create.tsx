/**
 * Create view: the provider files a drug coverage request.
 * Clinical justification stays off-chain; only its hash is committed on-chain (R4).
 */
import { useMemo, useState } from "react";
import { ZERO_HASH, hashContent, PayerLine, type Profile } from "@lib";
import { client, INSURER_ADDRESS } from "../client.js";
import { parseAmount, shortHex } from "../shared.js";
import { SAMPLE_CASE } from "../sampleCase.js";

interface CreateProps {
  readonly activeProfile: Profile;
  readonly onCreated: (reqId: bigint) => void;
  readonly onCancel: () => void;
}

export function Create({ activeProfile, onCreated, onCancel }: CreateProps) {
  const [justification, setJustification] = useState("");
  const [drug, setDrug] = useState("");
  const [evidence, setEvidence] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [daysSupply, setDaysSupply] = useState("");
  const [payerLine, setPayerLine] = useState<PayerLine>(PayerLine.PartD);
  const [committedHash, setCommittedHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Live preview of the hash that WILL be committed on-chain (R4 — justification
  // text stays off-chain; only this keccak256 lands on the ledger). Updates as
  // the user types so they see exactly what gets recorded.
  const justificationHashPreview = useMemo(
    () => (justification ? hashContent(justification) : null),
    [justification],
  );

  const insurerProfile = useMemo<Profile>(() => {
    const all = client.profiles.listProfiles();
    return (
      all.find((p) => p.id === "insurer") ??
      all.find((p) => p.id !== activeProfile.id) ??
      activeProfile
    );
  }, [activeProfile]);

  function loadDemo() {
    setJustification(SAMPLE_CASE.justification);
    setDrug(SAMPLE_CASE.drug);
    setEvidence(SAMPLE_CASE.evidenceRef);
    setAmount(SAMPLE_CASE.requestedAmount);
    setQuantity(SAMPLE_CASE.quantity);
    setDaysSupply(SAMPLE_CASE.daysSupply);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const requestedAmount = parseAmount(amount);
    const quantityVal = parseAmount(quantity);
    const daysSupplyVal = daysSupply.trim() === "" ? 0n : parseAmount(daysSupply);

    if (!justification.trim()) return setError("Clinical justification is required.");
    if (!drug.trim()) return setError("Medication name is required.");
    if (requestedAmount === null) return setError("Amount must be a number.");
    if (quantityVal === null || quantityVal <= 0n)
      return setError("Quantity must be a whole number greater than 0.");
    if (daysSupplyVal === null)
      return setError("Days supply must be a number (or leave blank).");

    setBusy(true);
    try {
      // R4: store the justification off-chain; commit only its hash on-chain.
      const stored = client.content.put(justification);
      setCommittedHash(stored.hash);

      const reqId = await client.negotiation.createContract({
        providerId: activeProfile.partyId,
        insurerId: insurerProfile.partyId,
        providerAddr: client.wallet.address,
        // SPEC-0004 R2b: providerAddr != insurerAddr. The insurer is a second
        // wallet whose private key lives in VITE_PRIVATE_KEY_INSURER (UNIT-7a);
        // the insurer profile's signer is hot-swapped via setActiveClientProfile
        // so engage() can later be called by that wallet.
        insurerAddr: INSURER_ADDRESS,
        payerLine,
        drugRef: hashContent(drug),
        requestedAmount,
        quantity: quantityVal,
        daysSupply: daysSupplyVal,
        justificationHash: stored.hash,
        evidenceUri:
          evidence.trim() === "" ? ZERO_HASH : hashContent(evidence),
      });
      onCreated(reqId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <section className="view create">
      <div className="view-head">
        <h1>Request Drug Coverage</h1>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {/* Demo shortcut */}
      <div className="demo-hero">
        <div className="demo-hero-text">
          <strong>Try the demo case</strong>
          <span>
            Pre-filled with a realistic Humira (adalimumab) coverage scenario
          </span>
        </div>
        <button
          type="button"
          className="primary"
          data-testid="load-sample"
          onClick={loadDemo}
        >
          Load Demo Case →
        </button>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label>
          Why is this medication needed?{" "}
          <span className="label-hint">· stays off-chain</span>
          <textarea
            data-testid="create-note"
            rows={4}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Describe the clinical justification — this stays private (off-chain). Only a secure hash is recorded on the blockchain."
          />
        </label>
        {justificationHashPreview && (
          <div className="hash-preview" data-testid="hash-preview">
            <span className="hash-preview-chars">
              {justification.length} chars · stays in your wallet / agent
            </span>
            <code className="hash-preview-hash" title={justificationHashPreview}>
              hash {shortHex(justificationHashPreview)}
            </code>
          </div>
        )}

        <label>
          Medication Name
          <input
            data-testid="create-drug"
            type="text"
            value={drug}
            onChange={(e) => setDrug(e.target.value)}
            placeholder="e.g. Adalimumab (Humira)"
          />
        </label>

        <div className="row">
          <label>
            Quantity (units)
            <input
              data-testid="create-quantity"
              type="text"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="2"
            />
          </label>
          <label>
            Days Supply
            <input
              data-testid="create-days-supply"
              type="text"
              inputMode="numeric"
              value={daysSupply}
              onChange={(e) => setDaysSupply(e.target.value)}
              placeholder="28 (optional)"
            />
          </label>
        </div>

        <label>
          Amount Requested ($)
          <input
            data-testid="create-amount"
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5200"
          />
        </label>

        <label>
          Supporting Evidence (optional)
          <input
            data-testid="create-evidence"
            type="text"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Link to FDA label, clinical guideline, or study (optional)"
          />
        </label>

        <label>
          Payer line <span className="label-hint">· sets the appeal ladder</span>
          <select
            data-testid="create-payer-line"
            value={payerLine}
            onChange={(e) => setPayerLine(Number(e.target.value) as PayerLine)}
          >
            <option value={PayerLine.Commercial}>
              Commercial — Internal Appeal → External Review
            </option>
            <option value={PayerLine.PartD}>
              Medicare Part D — Redetermination → IRE → ALJ
            </option>
            <option value={PayerLine.Medicaid}>
              Medicaid (MCO) — Plan Appeal → External / Fair Hearing
            </option>
          </select>
        </label>

        <div className="parties">
          <span>
            Filing as: <strong>{activeProfile.label}</strong>
          </span>
          <span>
            Sending to: <strong>{insurerProfile.label}</strong>
          </span>
        </div>

        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          className="primary"
          data-testid="create-submit"
          disabled={busy}
        >
          {busy ? "Submitting…" : "Submit Request →"}
        </button>
      </form>

      {committedHash && (
        <div className="committed">
          <div>
            Justification hash committed on-chain:{" "}
            <code data-testid="committed-hash">{committedHash}</code>
          </div>
          <p className="hint">
            The justification text stays private and off-chain. Only this
            cryptographic hash is recorded on the blockchain — proving the
            document existed without exposing its contents.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Create view: the provider files a drug coverage request.
 * Clinical justification stays off-chain; only its hash is committed on-chain (R4).
 */
import { useMemo, useState } from "react";
import {
  ZERO_HASH,
  hashContent,
  PayerLine,
  SAMPLE_ORDER_SIGN_REQUEST,
  orderSignToDraft,
  type Profile,
} from "@lib";
import { client, INSURER_ADDRESS } from "../client.js";
import { parseAmount, shortHex } from "../shared.js";
import { SAMPLE_CASE } from "../sampleCase.js";
import { useWalletBalance } from "../hooks/useWalletBalance.js";
import { ErrorCard } from "../components/ErrorCard.js";

// SPEC-0003 §2.6 R31: the user's wallet must hold `requestedAmount` plus the
// reserve for the next-step `requestAdjudication` so they can finish the
// negotiation loop. Sourced from VITE_AGENT_FEE_WEI to match the value the
// SDK already forwards on `requestAdjudication` (see client.ts:160).
const AGENT_FEE_RESERVE_WEI: bigint = BigInt(
  import.meta.env.VITE_AGENT_FEE_WEI ?? "330000000000000000",
);

function fmtStt(wei: bigint): string {
  // Whole-STT integer division for the user-facing message — the cap
  // discussion lives in the spec, not the form copy.
  const whole = wei / 1_000_000_000_000_000_000n;
  const milli = (wei % 1_000_000_000_000_000_000n) / 1_000_000_000_000_000n;
  return milli === 0n ? `${whole} STT` : `${whole}.${milli.toString().padStart(3, "0")} STT`;
}

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
  // Set when the form is hydrated from a CDS-Hooks `order-sign` payload
  // (SPEC-0002 R7). Drives a provenance banner so users see the form
  // wasn't hand-typed.
  const [cdsProvenance, setCdsProvenance] = useState<string | null>(null);

  // Live preview of the hash that WILL be committed on-chain (R4 — justification
  // text stays off-chain; only this keccak256 lands on the ledger). Updates as
  // the user types so they see exactly what gets recorded.
  const justificationHashPreview = useMemo(
    () => (justification ? hashContent(justification) : null),
    [justification],
  );

  // SPEC-0003 §2.6 R30-R32: live wallet-balance gate. The `requestedAmount`
  // field is in demo dollars (not wei) so it doesn't enter the wei-balance
  // comparison directly — the meaningful check from R31 is the
  // agent-fee reserve the provider must hold so the next-step
  // `requestAdjudication` can escrow it. The check is skipped in simulated
  // mode (`wei === null`) — there's no chain to pay for.
  const { wei: balanceWei } = useWalletBalance();
  const balanceBlock = useMemo<{
    current: bigint;
    required: bigint;
    missing: bigint;
  } | null>(() => {
    if (balanceWei === null) return null;
    const required = AGENT_FEE_RESERVE_WEI;
    return balanceWei < required
      ? { current: balanceWei, required, missing: required - balanceWei }
      : null;
  }, [balanceWei]);

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
    setCdsProvenance(null);
    setError(null);
  }

  // SPEC-0002 R7 — hydrate the form from a mock CDS Hooks `order-sign`
  // payload, mirroring the EHR-integrated flow where a clinician triggers
  // coverage from inside their order-entry workflow.
  function loadCdsOrder() {
    const draft = orderSignToDraft(SAMPLE_ORDER_SIGN_REQUEST);
    setJustification(draft.justification);
    setDrug(draft.drug);
    setEvidence(SAMPLE_CASE.evidenceRef);
    setAmount(draft.requestedAmount ? draft.requestedAmount.toString() : SAMPLE_CASE.requestedAmount);
    setQuantity(draft.quantity.toString());
    setDaysSupply(draft.daysSupply.toString());
    setCdsProvenance(`CDS Hooks order-sign · hook ${SAMPLE_ORDER_SIGN_REQUEST.hook}`);
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
        <button
          type="button"
          className="secondary"
          data-testid="cds-prefill"
          onClick={loadCdsOrder}
        >
          Load from EHR (CDS Hooks) →
        </button>
      </div>

      {cdsProvenance && (
        <div className="provenance" data-testid="cds-provenance">
          <strong>Imported from EHR</strong>
          <span>{cdsProvenance}</span>
        </div>
      )}

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

        {error && <ErrorCard error={error} onDismiss={() => setError(null)} />}
        {balanceBlock && (
          <p className="error" data-testid="balance-block">
            Wallet balance is below the agent-fee reserve required for the
            next-step adjudication. You have <strong>{fmtStt(balanceBlock.current)}</strong>;
            need <strong>{fmtStt(balanceBlock.required)}</strong> (short by
            {" "}<strong>{fmtStt(balanceBlock.missing)}</strong>). Top up the
            wallet at the Somnia testnet faucet, then try again.
          </p>
        )}

        <button
          type="submit"
          className="primary"
          data-testid="create-submit"
          disabled={busy || balanceBlock !== null}
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

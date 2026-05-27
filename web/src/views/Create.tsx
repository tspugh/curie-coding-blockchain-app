/**
 * Create view (R15/R16): the provider files a drug coverage-exception request.
 *
 * R4 boundary, made visible: the raw justification note goes into the off-chain
 * ContentStore via `content.put`, and ONLY the returned keccak256 hash is passed
 * to `createContract({ justificationHash })`. The drug name and the public-
 * evidence ref are likewise hashed (`hashContent`) into opaque bytes32 refs. The
 * committed hash is shown with a "stays off-chain" note so the boundary is
 * auditable from the UI.
 *
 * The active profile files as the PROVIDER (partyId + wallet address); the other
 * default profile is the INSURER (same wallet address under single-wallet, R12).
 */
import { useMemo, useState } from "react";
import { ZERO_HASH, hashContent, type Profile } from "@lib";
import { client } from "../client.js";
import { parseAmount } from "../shared.js";
import { SAMPLE_CASE } from "../sampleCase.js";

interface CreateProps {
  readonly activeProfile: Profile;
  /** Navigate to the new request once filed. */
  readonly onCreated: (reqId: bigint) => void;
  readonly onCancel: () => void;
}

export function Create({ activeProfile, onCreated, onCancel }: CreateProps) {
  const [justification, setJustification] = useState("");
  const [drug, setDrug] = useState("");
  const [evidence, setEvidence] = useState("");
  const [amount, setAmount] = useState("");
  const [committedHash, setCommittedHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The insurer is the OTHER default profile. With a single shared wallet,
  // switching profiles lets that wallet act as both parties (R12); a self-claim
  // (insurer === provider) is also valid if only one profile exists (R13).
  const insurerProfile = useMemo<Profile>(() => {
    const all = client.profiles.listProfiles();
    return all.find((p) => p.id !== activeProfile.id) ?? activeProfile;
  }, [activeProfile]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const requestedAmount = parseAmount(amount);
    if (justification.trim() === "") return setError("Justification note is required.");
    if (drug.trim() === "") return setError("Drug name is required.");
    if (requestedAmount === null) {
      return setError("Requested amount must be a non-negative integer.");
    }

    setBusy(true);
    try {
      // R4: store the justification off-chain; commit only its hash.
      const stored = client.content.put(justification);
      setCommittedHash(stored.hash);

      const reqId = await client.negotiation.createContract({
        providerId: activeProfile.partyId,
        insurerId: insurerProfile.partyId,
        providerAddr: client.wallet.address,
        insurerAddr: client.wallet.address,
        drugRef: hashContent(drug),
        requestedAmount,
        justificationHash: stored.hash,
        evidenceUri: evidence.trim() === "" ? ZERO_HASH : hashContent(evidence),
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
        <h1>File coverage-exception request</h1>
        <div>
          <button
            type="button"
            data-testid="load-sample"
            onClick={() => {
              // Prefill from the synthetic demo case (demo-data/sample-case.md).
              setJustification(SAMPLE_CASE.justification);
              setDrug(SAMPLE_CASE.drug);
              setEvidence(SAMPLE_CASE.evidenceRef);
              setAmount(SAMPLE_CASE.requestedAmount);
              setError(null);
            }}
          >
            Load sample case
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label>
          De-identified justification note (kept off-chain)
          <textarea
            data-testid="create-note"
            rows={5}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Clinical justification — stays off-chain; only its keccak256 hash is committed."
          />
        </label>

        <label>
          Drug (RxNorm / NDC)
          <input
            data-testid="create-drug"
            type="text"
            value={drug}
            onChange={(e) => setDrug(e.target.value)}
            placeholder="e.g. Adalimumab (RxNorm 1366724)"
          />
        </label>

        <label>
          Public-evidence reference (openFDA / DailyMed URL)
          <input
            data-testid="create-evidence"
            type="text"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="https://api.fda.gov/drug/label.json?search=… (optional)"
          />
        </label>

        <label>
          Requested (billed) amount
          <input
            data-testid="create-amount"
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5200"
          />
        </label>

        <div className="parties">
          <span>
            Provider (you): <strong>{activeProfile.label}</strong> (party{" "}
            {activeProfile.partyId.toString()})
          </span>
          <span>
            Insurer: <strong>{insurerProfile.label}</strong> (party{" "}
            {insurerProfile.partyId.toString()})
          </span>
        </div>

        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          className="primary"
          data-testid="create-submit"
          disabled={busy}
        >
          {busy ? "Filing…" : "File request"}
        </button>
      </form>

      {committedHash && (
        <div className="committed">
          <div>
            Committed justification hash:{" "}
            <code data-testid="committed-hash">{committedHash}</code>
          </div>
          <p className="hint">
            The justification body stays off-chain in the ContentStore; only this
            keccak256 hash is committed on-chain (R4). No PHI crosses the boundary.
          </p>
        </div>
      )}
    </section>
  );
}

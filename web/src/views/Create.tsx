/**
 * Create view (R15): capture a note + drug + price band and open a contract.
 *
 * R4 boundary, made visible: the raw note text goes into the off-chain
 * ContentStore via `content.put`, and ONLY the returned keccak256 hash is
 * passed to `createContract({ noteHash })`. The drug name is likewise hashed
 * (`hashContent`) into an opaque bytes32 drugRef. The committed hash is shown
 * to the user with a "raw note stays off-chain" note so the boundary is
 * auditable from the UI.
 */
import { useMemo, useState } from "react";
import { ZERO_HASH, hashContent, type Profile } from "@lib";
import { client } from "../client.js";
import { parseAmount } from "../shared.js";

interface CreateProps {
  readonly activeProfile: Profile;
  /** Navigate to the new contract once created. */
  readonly onCreated: (reqId: bigint) => void;
  readonly onCancel: () => void;
}

export function Create({ activeProfile, onCreated, onCancel }: CreateProps) {
  const [note, setNote] = useState("");
  const [drug, setDrug] = useState("");
  const [floor, setFloor] = useState("");
  const [ceil, setCeil] = useState("");
  const [committedHash, setCommittedHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The destination is the OTHER default profile. With a single shared wallet,
  // switching profiles lets that wallet act as both parties (R13); a
  // self-contract (destination === initiator) is also valid if only one exists.
  const otherProfile = useMemo<Profile>(() => {
    const all = client.profiles.listProfiles();
    return all.find((p) => p.id !== activeProfile.id) ?? activeProfile;
  }, [activeProfile]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceFloor = parseAmount(floor);
    const priceCeil = parseAmount(ceil);
    if (note.trim() === "") return setError("Note text is required.");
    if (drug.trim() === "") return setError("Drug name is required.");
    if (priceFloor === null || priceCeil === null) {
      return setError("Price floor and ceiling must be non-negative integers.");
    }
    if (priceFloor > priceCeil) {
      return setError("Price floor must not exceed the ceiling.");
    }

    setBusy(true);
    try {
      // R4: store the note off-chain; commit only its hash.
      const stored = client.content.put(note);
      setCommittedHash(stored.hash);

      const reqId = await client.negotiation.createContract({
        initiatorId: activeProfile.partyId,
        destinationId: otherProfile.partyId,
        drugRef: hashContent(drug),
        noteHash: stored.hash,
        priceFloor,
        priceCeil,
        evidenceUri: ZERO_HASH,
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
        <h1>Create contract</h1>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label>
          Patient note (kept off-chain)
          <textarea
            data-testid="create-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Clinical note text — stays off-chain; only its hash is committed."
          />
        </label>

        <label>
          Drug name
          <input
            data-testid="create-drug"
            type="text"
            value={drug}
            onChange={(e) => setDrug(e.target.value)}
            placeholder="e.g. Adalimumab"
          />
        </label>

        <div className="row">
          <label>
            Price floor
            <input
              data-testid="create-floor"
              type="text"
              inputMode="numeric"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="1000"
            />
          </label>
          <label>
            Price ceiling
            <input
              data-testid="create-ceil"
              type="text"
              inputMode="numeric"
              value={ceil}
              onChange={(e) => setCeil(e.target.value)}
              placeholder="5000"
            />
          </label>
        </div>

        <div className="parties">
          <span>
            Initiator: <strong>{activeProfile.label}</strong> (party{" "}
            {activeProfile.partyId.toString()})
          </span>
          <span>
            Destination: <strong>{otherProfile.label}</strong> (party{" "}
            {otherProfile.partyId.toString()})
          </span>
        </div>

        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          className="primary"
          data-testid="create-submit"
          disabled={busy}
        >
          {busy ? "Creating…" : "Create contract"}
        </button>
      </form>

      {committedHash && (
        <div className="committed">
          <div>
            Committed note hash:{" "}
            <code data-testid="committed-hash">{committedHash}</code>
          </div>
          <p className="hint">
            Raw note stays off-chain in the ContentStore; only this keccak256
            hash is committed on-chain (R4).
          </p>
        </div>
      )}
    </section>
  );
}

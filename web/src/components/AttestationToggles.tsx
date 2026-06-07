/**
 * SPEC-0007 R13 — provider attestation toggles for the adjudication panel.
 *
 * Controlled + presentational: given the attested clauses + the current toggle state,
 * renders a yes/no toggle (+ optional de-identified evidence URL) per clause and reports
 * edits via `onChange`. Extracted from Detail.tsx so the toggle wiring is unit-testable in
 * isolation (the on-chain Attestation[] is built separately by `buildAttestations`).
 *
 * Trust labeling (A0012): attested clauses are *provider-asserted, not agent-verified* — the
 * agent records and trusts them. NO PHI: only a boolean + an optional de-identified URL.
 */
import type { PolicyClause } from "@lib";
import type { AttestationInput } from "../attestations.js";

export interface AttestationTogglesProps {
  readonly clauses: ReadonlyArray<PolicyClause>;
  readonly value: Readonly<Record<string, AttestationInput>>;
  readonly onChange: (next: Record<string, AttestationInput>) => void;
}

export function AttestationToggles({ clauses, value, onChange }: AttestationTogglesProps) {
  if (clauses.length === 0) return null;

  const set = (id: string, patch: Partial<AttestationInput>) => {
    const cur = value[id] ?? { attested: false, evidenceUrl: "" };
    onChange({ ...value, [id]: { ...cur, ...patch } });
  };

  return (
    <div className="attestation-panel" data-testid="attestation-panel">
      <p className="action-label">Provider attestations (de-identified)</p>
      <p className="hint">
        Patient-specific criteria the AI <strong>records and trusts</strong> but does not
        independently verify — <em>provider-asserted, not agent-verified</em>. No PHI: only a
        yes/no and an optional de-identified evidence link cross on-chain.
      </p>
      {clauses.map((c) => {
        const st = value[c.id] ?? { attested: false, evidenceUrl: "" };
        return (
          <div key={c.id} className="attestation-row" data-testid={`attestation-${c.id}`}>
            <label className="attestation-toggle">
              <input
                type="checkbox"
                data-testid={`attestation-toggle-${c.id}`}
                checked={st.attested}
                onChange={(e) => set(c.id, { attested: e.target.checked })}
              />
              <span>{c.text}</span>
            </label>
            <input
              type="text"
              className="attestation-url"
              data-testid={`attestation-url-${c.id}`}
              placeholder="De-identified evidence URL (optional)"
              value={st.evidenceUrl}
              onChange={(e) => set(c.id, { evidenceUrl: e.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}

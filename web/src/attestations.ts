/**
 * A0012 / SPEC-0007 R13 — provider-attestation helpers for the adjudication UI.
 *
 * Pure functions (no React, no DOM) so the clause-resolution + attestation-building
 * logic — the part most likely to harbor a bug (hash-matching the attached policy,
 * mapping clause ids and evidence URLs to on-chain hashes) — is unit-testable without
 * rendering the heavy Detail view.
 */
// Import the lib via the built dist (the exact target the `@lib` alias points to in
// vite.config) rather than the `@lib` alias, so this pure module is resolvable by the
// node/tsx test runner — which does not honor the Vite alias — and can be unit-tested.
import {
  ZERO_HASH,
  hashContent,
  policiesForLine,
  type Attestation,
  type CuratedPolicy,
  type PayerLine,
  type PolicyClause,
} from "../../dist/index.js";

/**
 * SPEC-0005 R14: serialize a curated policy into the single-string body the insurer
 * commits off-chain. The on-chain policyHash is the keccak256 of THIS string, so the
 * format MUST be stable for clause-level replay — do not reorder/relabel without
 * bumping the policy id. (Single source of truth; the adjudication UI reverse-maps
 * the on-chain hash through this exact serialization.)
 */
export function renderCuratedPolicyText(policy: CuratedPolicy): string {
  const head = `${policy.name}. ${policy.summary}`;
  const clauseLines = policy.clauses.map(
    (c) => `Clause ${c.id}${c.voids ? " (FLAGGED)" : ""}: ${c.text}`,
  );
  return [head, ...clauseLines].join(" ");
}

/**
 * R13: reverse-map an on-chain `policyHash` to the ATTESTED (patient-specific) clauses
 * of the attached curated policy, matched within the negotiation's payer line (the
 * insurer attached it at engage, so by adjudication time the provider knows what to
 * attest). Returns [] for a public-only / custom / unmatched policy.
 */
export function resolveAttestedClauses(
  policyHash: string | null | undefined,
  payerLine: PayerLine,
): readonly PolicyClause[] {
  if (!policyHash || policyHash === ZERO_HASH) return [];
  const target = policyHash.toLowerCase();
  const match = policiesForLine(payerLine).find(
    (p) => hashContent(renderCuratedPolicyText(p)).toLowerCase() === target,
  );
  return match ? match.clauses.filter((c) => c.type === "attested") : [];
}

/** One attested clause's UI state: the provider's yes/no + an optional evidence URL. */
export interface AttestationInput {
  readonly attested: boolean;
  readonly evidenceUrl: string;
}

/**
 * R5/R13: build the on-chain `Attestation[]` from the provider's toggle state. clauseId
 * and evidenceUriHash are keccak hashes (NO PHI on-chain — only a boolean + hashes
 * cross). An unset clause defaults to `attested: false`, so the R7 conjunction blocks
 * Approve until the provider affirmatively checks it.
 */
export function buildAttestations(
  clauses: readonly PolicyClause[],
  state: Readonly<Record<string, AttestationInput>>,
): Attestation[] {
  return clauses.map((c) => {
    const st = state[c.id] ?? { attested: false, evidenceUrl: "" };
    const url = st.evidenceUrl.trim();
    return {
      clauseId: hashContent(c.id),
      attested: st.attested,
      evidenceUriHash: url ? hashContent(url) : ZERO_HASH,
    };
  });
}

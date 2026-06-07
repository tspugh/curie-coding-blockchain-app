/**
 * SPEC-0010 §3.6 — authoritative-source allowlist.
 *
 * Pure data model + curated defaults + matcher + defaults⊕override merge. No DOM, no
 * network: the Settings UI (web) supplies the localStorage override; the normalizer (future)
 * supplies the submitted source. Keeping this in the lib lets both consume one source of
 * truth and unit-test the matcher without a browser.
 *
 * TRUST (R13): adding a source widens what counts as authoritative. In the demo the override
 * is a local operator convenience; in production allowlist membership is payer/governance-
 * controlled. A claim submitter must never be able to self-approve their own source.
 */

/** Ordered so an approval can require `tier >= threshold` (SPEC-0010 R4). */
export enum SourceTier {
  UNVETTED = 0, // never satisfies an off-label approval
  NARRATIVE = 1, // narrative review / reference page
  PEER_REVIEWED = 2, // indexed primary literature (PMID/DOI) — floor for the literature
  GUIDELINE = 3, // specialty-society / national guideline
  SYSTEMATIC_REVIEW = 4, // Cochrane / meta-analysis
  FDA_LABEL = 5, // openFDA / DailyMed structured label
}

/** How a submitted source is matched to an allowlist entry. */
export type SourceMatch =
  | { readonly kind: "host"; readonly host: string } // exact hostname, e.g. "api.fda.gov"
  | { readonly kind: "urlPrefix"; readonly prefix: string } // URL starts-with (https only)
  | { readonly kind: "identifier"; readonly scheme: "pmid" | "doi" }; // resolved via canonical resolver (R3)

export interface ApprovedSource {
  readonly id: string;
  readonly label: string;
  readonly match: SourceMatch;
  readonly tier: SourceTier;
  readonly builtin: boolean; // shipped default — cannot be deleted, only disabled
  readonly enabled: boolean;
}

/** Curated defaults (SPEC-0010 §3.6 table). All `builtin`, all enabled by default. */
export const DEFAULT_APPROVED_SOURCES: ReadonlyArray<ApprovedSource> = Object.freeze([
  { id: "openfda", label: "openFDA drug label", match: { kind: "host", host: "api.fda.gov" }, tier: SourceTier.FDA_LABEL, builtin: true, enabled: true },
  { id: "dailymed", label: "DailyMed label", match: { kind: "host", host: "dailymed.nlm.nih.gov" }, tier: SourceTier.FDA_LABEL, builtin: true, enabled: true },
  { id: "pubmed", label: "PubMed (PMID)", match: { kind: "identifier", scheme: "pmid" }, tier: SourceTier.PEER_REVIEWED, builtin: true, enabled: true },
  { id: "pmc", label: "PubMed Central", match: { kind: "urlPrefix", prefix: "https://www.ncbi.nlm.nih.gov/pmc/" }, tier: SourceTier.PEER_REVIEWED, builtin: true, enabled: true },
  { id: "crossref", label: "Crossref (DOI)", match: { kind: "identifier", scheme: "doi" }, tier: SourceTier.PEER_REVIEWED, builtin: true, enabled: true },
  { id: "nice", label: "NICE guidance", match: { kind: "host", host: "www.nice.org.uk" }, tier: SourceTier.GUIDELINE, builtin: true, enabled: true },
  { id: "uspstf", label: "USPSTF", match: { kind: "host", host: "www.uspreventiveservicestaskforce.org" }, tier: SourceTier.GUIDELINE, builtin: true, enabled: true },
]);

/** The persisted override shape (localStorage `curie:approvedSources`). */
export interface AllowlistOverride {
  /** ids of built-in defaults the operator has disabled. */
  readonly disabled?: ReadonlyArray<string>;
  /** operator-added custom sources (always treated as `builtin: false`). */
  readonly custom?: ReadonlyArray<ApprovedSource>;
}

/** A bare PubMed id: "12345678", "pmid:12345678", "PMID 12345678". */
export function parsePmid(s: string): string | null {
  const m = s.trim().match(/^(?:pmid[:\s]*)?(\d{1,8})$/i);
  return m ? m[1]! : null;
}

/** A DOI: "10.1002/14651858…", optionally "doi:" / a doi.org URL. */
export function parseDoi(s: string): string | null {
  const t = s.trim().replace(/^doi:\s*/i, "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return /^10\.\d{4,9}\/\S+$/.test(t) ? t : null;
}

export interface MatchResult {
  readonly source: ApprovedSource;
  /** Floor tier from the matched entry. The normalizer/resolver MAY refine it upward
   *  (e.g. a Cochrane PMID → SYSTEMATIC_REVIEW) from publication metadata. */
  readonly tier: SourceTier;
}

/**
 * Match a submitted source (a URL, or a bare PMID/DOI) to the first ENABLED allowlist entry.
 * Returns null when nothing enabled matches → the caller rejects the source (R7).
 */
export function matchSource(
  submitted: string,
  sources: ReadonlyArray<ApprovedSource> = DEFAULT_APPROVED_SOURCES,
): MatchResult | null {
  const s = submitted.trim();
  if (s.length === 0) return null;
  const enabled = sources.filter((x) => x.enabled);

  const pmid = parsePmid(s);
  const doi = parseDoi(s);

  // Identifier inputs only match identifier entries (R3).
  if (pmid) {
    const e = enabled.find((x) => x.match.kind === "identifier" && x.match.scheme === "pmid");
    return e ? { source: e, tier: e.tier } : null;
  }
  if (doi) {
    const e = enabled.find((x) => x.match.kind === "identifier" && x.match.scheme === "doi");
    return e ? { source: e, tier: e.tier } : null;
  }

  // Otherwise it must be a parseable URL; match host then urlPrefix.
  let host: string;
  try {
    host = new URL(s).hostname.toLowerCase();
  } catch {
    return null; // not an identifier, not a URL → cannot be authoritative
  }
  const byHost = enabled.find((x) => x.match.kind === "host" && x.match.host.toLowerCase() === host);
  if (byHost) return { source: byHost, tier: byHost.tier };
  const byPrefix = enabled.find((x) => x.match.kind === "urlPrefix" && s.startsWith(x.match.prefix));
  return byPrefix ? { source: byPrefix, tier: byPrefix.tier } : null;
}

/** True when the source is on the (enabled) allowlist. */
export function isAllowlisted(submitted: string, sources?: ReadonlyArray<ApprovedSource>): boolean {
  return matchSource(submitted, sources) !== null;
}

/**
 * Merge the curated defaults with an operator/governance override: built-ins toggled by
 * `disabled`, custom entries appended (forced `builtin: false`). Pure — the override is
 * supplied by the caller (the Settings UI reads it from localStorage). Defaults are never
 * dropped (R2: disable-not-delete).
 */
export function mergeAllowlist(override: AllowlistOverride | null | undefined): ApprovedSource[] {
  const disabled = new Set(override?.disabled ?? []);
  const base = DEFAULT_APPROVED_SOURCES.map((d) => ({ ...d, enabled: d.enabled && !disabled.has(d.id) }));
  const custom = (override?.custom ?? [])
    .filter((c) => !DEFAULT_APPROVED_SOURCES.some((d) => d.id === c.id)) // never shadow a built-in id
    .map((c) => ({ ...c, builtin: false }));
  return [...base, ...custom];
}

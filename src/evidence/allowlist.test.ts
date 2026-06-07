/**
 * SPEC-0010 §3.6 allowlist tests (T9–T12): defaults match to the right tiers; identifier vs
 * host vs urlPrefix matching; non-allowlisted → reject; merge with disable/custom; built-ins
 * are never shadowed/dropped.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_APPROVED_SOURCES,
  SourceTier,
  matchSource,
  isAllowlisted,
  mergeAllowlist,
  parsePmid,
  parseDoi,
  type ApprovedSource,
} from "./allowlist.js";

test("T9: curated defaults match to the correct tiers", () => {
  assert.equal(matchSource("https://api.fda.gov/drug/label.json?search=x")?.tier, SourceTier.FDA_LABEL);
  assert.equal(matchSource("https://dailymed.nlm.nih.gov/dailymed/x")?.tier, SourceTier.FDA_LABEL);
  assert.equal(matchSource("28965364")?.source.id, "pubmed"); // bare PMID
  assert.equal(matchSource("pmid:28965364")?.tier, SourceTier.PEER_REVIEWED);
  assert.equal(matchSource("10.1002/14651858.CD009504.pub2")?.source.id, "crossref"); // DOI
  assert.equal(matchSource("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6485546/")?.source.id, "pmc");
  assert.equal(matchSource("https://www.nice.org.uk/guidance/ng87")?.tier, SourceTier.GUIDELINE);
});

test("T9: a source matching no enabled entry is rejected", () => {
  assert.equal(matchSource("https://my-self-hosted-evidence.example.com/bupropion.html"), null);
  assert.equal(isAllowlisted("https://example.com/x"), false);
  assert.equal(matchSource("not a url and not an id"), null);
  assert.equal(matchSource(""), null);
});

test("parsePmid / parseDoi", () => {
  assert.equal(parsePmid("28965364"), "28965364");
  assert.equal(parsePmid("PMID 28965364"), "28965364");
  assert.equal(parsePmid("abc"), null);
  assert.equal(parseDoi("10.1002/14651858.CD009504.pub2"), "10.1002/14651858.CD009504.pub2");
  assert.equal(parseDoi("https://doi.org/10.1002/x.y"), "10.1002/x.y");
  assert.equal(parseDoi("12345678"), null); // a PMID is not a DOI
});

test("T10: merge disables a built-in (then its sources are rejected)", () => {
  const merged = mergeAllowlist({ disabled: ["openfda"] });
  assert.equal(merged.find((s) => s.id === "openfda")?.enabled, false);
  assert.equal(matchSource("https://api.fda.gov/drug/label.json", merged), null);
  // a still-enabled default keeps matching
  assert.equal(matchSource("https://www.nice.org.uk/guidance/ng87", merged)?.source.id, "nice");
});

test("T10: merge appends a custom source that then matches", () => {
  const custom: ApprovedSource = {
    id: "my-compendium",
    label: "Payer compendium mirror",
    match: { kind: "host", host: "compendium.example.org" },
    tier: SourceTier.GUIDELINE,
    builtin: false,
    enabled: true,
  };
  const merged = mergeAllowlist({ custom: [custom] });
  assert.equal(matchSource("https://compendium.example.org/bupropion", merged)?.tier, SourceTier.GUIDELINE);
});

test("T10/R2: defaults are never dropped; a custom entry cannot shadow a built-in id", () => {
  const merged = mergeAllowlist({
    custom: [
      { id: "openfda", label: "spoof", match: { kind: "host", host: "evil.example" }, tier: SourceTier.FDA_LABEL, builtin: false, enabled: true },
    ],
  });
  // still exactly one openfda, and it is the built-in (host api.fda.gov), not the spoof
  const openfda = merged.filter((s) => s.id === "openfda");
  assert.equal(openfda.length, 1);
  assert.equal(openfda[0]?.builtin, true);
  assert.equal(matchSource("https://evil.example/x", merged), null);
  assert.equal(merged.length, DEFAULT_APPROVED_SOURCES.length); // spoof rejected, count unchanged
});

test("mergeAllowlist(null) returns the defaults unchanged", () => {
  const merged = mergeAllowlist(null);
  assert.equal(merged.length, DEFAULT_APPROVED_SOURCES.length);
  assert.ok(merged.every((s) => s.builtin && s.enabled));
});

/**
 * DOM tests for the SPEC-0007 R13 AttestationToggles component (the provider
 * attestation toggles extracted from Detail.tsx). Renders in jsdom and exercises the
 * controlled-input wiring: toggle → onChange({attested}), URL field → onChange({evidenceUrl}),
 * and the "no attested clauses → render nothing" path.
 *
 * PHI-free: synthetic clause text only.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { JSDOM } = req("jsdom") as typeof import("jsdom");

import React from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

const dom = new JSDOM("<!DOCTYPE html><body></body>", { url: "http://localhost/" });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot } from "react-dom/client";
import { AttestationToggles } from "./components/AttestationToggles.js";

type Clause = { id: string; text: string; type: "attested" };
const CLAUSES: Clause[] = [
  { id: "ADHD-BUP-03", text: "Trial-and-failure of a preferred stimulant.", type: "attested" },
  { id: "PD-ADA-02", text: "Step-therapy exception documented.", type: "attested" },
];

function invoke(el: Element, handler: "onClick" | "onChange", arg: unknown): void {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps"));
  if (!key) throw new Error("no __reactProps");
  const props = (el as unknown as Record<string, Record<string, unknown>>)[key];
  const fn = props?.[handler];
  if (typeof fn !== "function") throw new Error(`${handler} not found`);
  (fn as (a: unknown) => void)(arg);
}

async function render(props: Parameters<typeof AttestationToggles>[0]) {
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(AttestationToggles, props)); });
  return {
    query: (s: string) => container.querySelector(s),
    cleanup: async () => { await act(async () => { root.unmount(); }); container.remove(); },
  };
}

test("R13: no attested clauses → renders nothing (no panel)", async () => {
  const ctx = await render({ clauses: [], value: {}, onChange: () => {} });
  try {
    assert.equal(ctx.query("[data-testid=attestation-panel]"), null);
  } finally { await ctx.cleanup(); }
});

test("R13: renders a toggle + URL field per attested clause + the trust note", async () => {
  const ctx = await render({ clauses: CLAUSES, value: {}, onChange: () => {} });
  try {
    assert.ok(ctx.query("[data-testid=attestation-panel]"), "panel renders");
    assert.ok(ctx.query("[data-testid=attestation-toggle-ADHD-BUP-03]"), "toggle for clause 1");
    assert.ok(ctx.query("[data-testid=attestation-toggle-PD-ADA-02]"), "toggle for clause 2");
    assert.ok(ctx.query("[data-testid=attestation-url-ADHD-BUP-03]"), "url field for clause 1");
    // honest trust labeling present
    const panel = ctx.query("[data-testid=attestation-panel]");
    assert.ok(/provider-asserted, not agent-verified/i.test(panel?.textContent ?? ""), "trust note");
  } finally { await ctx.cleanup(); }
});

test("R13: toggling a checkbox reports onChange({attested:true}) for that clause", async () => {
  let latest: Record<string, { attested: boolean; evidenceUrl: string }> = {};
  const ctx = await render({ clauses: CLAUSES, value: {}, onChange: (n) => { latest = n; } });
  try {
    await act(async () => {
      invoke(ctx.query("[data-testid=attestation-toggle-ADHD-BUP-03]")!, "onChange", {
        target: { checked: true },
      });
    });
    assert.equal(latest["ADHD-BUP-03"]?.attested, true);
    assert.equal(latest["ADHD-BUP-03"]?.evidenceUrl, "");
  } finally { await ctx.cleanup(); }
});

test("R13: editing the URL field reports onChange({evidenceUrl}) without losing attested", async () => {
  let latest: Record<string, { attested: boolean; evidenceUrl: string }> = {};
  const ctx = await render({
    clauses: CLAUSES,
    value: { "PD-ADA-02": { attested: true, evidenceUrl: "" } },
    onChange: (n) => { latest = n; },
  });
  try {
    await act(async () => {
      invoke(ctx.query("[data-testid=attestation-url-PD-ADA-02]")!, "onChange", {
        target: { value: "https://example.org/deid" },
      });
    });
    assert.equal(latest["PD-ADA-02"]?.evidenceUrl, "https://example.org/deid");
    assert.equal(latest["PD-ADA-02"]?.attested, true, "attested preserved while editing URL");
  } finally { await ctx.cleanup(); }
});

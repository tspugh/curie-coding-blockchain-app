/**
 * SPEC-0010 §3.6 — localStorage persistence for the approved-source allowlist OVERRIDE.
 *
 * Only the override (disabled built-in ids + custom entries) is stored; the curated defaults
 * live in the lib (`DEFAULT_APPROVED_SOURCES`) and are merged over at read time via
 * `mergeAllowlist`. This is the demo's local operator convenience (R13) — in production the
 * override source is the payer-governed list / on-chain registry.
 */
import type { AllowlistOverride } from "@lib";

export const APPROVED_SOURCES_STORAGE_KEY = "curie:approvedSources";

export function loadApprovedSourcesOverride(): AllowlistOverride | null {
  try {
    const raw = window.localStorage.getItem(APPROVED_SOURCES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AllowlistOverride;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveApprovedSourcesOverride(override: AllowlistOverride): void {
  try {
    window.localStorage.setItem(APPROVED_SOURCES_STORAGE_KEY, JSON.stringify(override));
  } catch {
    /* storage unavailable (private mode / disabled) — non-fatal for the demo */
  }
}

export function clearApprovedSourcesOverride(): void {
  try {
    window.localStorage.removeItem(APPROVED_SOURCES_STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}

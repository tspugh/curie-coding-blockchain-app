/**
 * SPEC-0005 R13 — Demo-mode quick-switch.
 *
 * `demoMode` is a single boolean controlled from Settings. When ON, the
 * legacy three-profile shortcut (provider / insurer / observer seeds)
 * appears in the top-bar Role pill row. When OFF, only the operator-added
 * userStore entries render — giving a clean "production-shaped" view for
 * guided walkthroughs that don't need the demo cruft.
 *
 * **Default:** ON in v0 (preserves current behaviour for a fresh install
 * that has no custom users yet). SPEC-0005 R13 calls for OFF in v1; v0 is
 * intentionally noisier so a developer opening the app for the first time
 * still sees the seeds.
 *
 * Persistence: `curie:demoMode` under `localStorage` as the literal string
 * `"true"` or `"false"`. `loadDemoMode()` falls back to the default when
 * the key is unset or unreadable.
 */

export const DEMO_MODE_STORAGE_KEY = "curie:demoMode";
export const DEMO_MODE_CHANGED_EVENT = "curie:demo-mode-changed";

/** v0 default. Flip to `false` when v1 ships. */
const DEFAULT_DEMO_MODE = true;

/** Read the persisted demo-mode flag. Returns the default on any error. */
export function loadDemoMode(): boolean {
  if (typeof window === "undefined") return DEFAULT_DEMO_MODE;
  try {
    const raw = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (raw === null) return DEFAULT_DEMO_MODE;
    return raw === "true";
  } catch {
    return DEFAULT_DEMO_MODE;
  }
}

/**
 * Persist the demo-mode flag and fire the same-tab CustomEvent so listeners
 * (App.tsx's pill-row filter) reactively update without a page reload.
 * Cross-tab parity comes from the browser's native `storage` event, which
 * App.tsx also listens for on `DEMO_MODE_STORAGE_KEY`.
 */
export function saveDemoMode(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, String(on));
    window.dispatchEvent(new CustomEvent(DEMO_MODE_CHANGED_EVENT));
  } catch {
    /* localStorage unavailable (private mode, SSR) — swallow. */
  }
}

/**
 * SPEC-0006 R21 — pure gate logic for the Create form's submit-disabled
 * condition and liveness-error banner visibility.
 *
 * Extracted from Create.tsx so the R21 gate rules can be unit-tested without
 * requiring a React renderer or a running Vite dev-server.
 *
 * The gate rules are:
 *   - In sim mode: liveness is ignored; only the non-empty-field checks apply.
 *   - In real mode: submit is blocked until `urlLivenessResult.ok === true`.
 *   - The error banner is shown in real mode when result is not null and ok===false.
 *
 * PHI-FREE: this module processes only liveness booleans and HTTP status codes;
 * no patient identifiers, SSNs, DOBs, phone numbers or email addresses are
 * handled here.
 */

import type { LivenessResult } from "./urlLiveness.js";

/**
 * Returns `true` when the R21 liveness gate should keep the submit button
 * disabled.
 *
 * This mirrors the expression in Create.tsx:
 *   `IS_REAL && (urlLivenessResult === null || !urlLivenessResult.ok)`
 *
 * @param isReal   - Whether the app is in real (on-chain) mode.
 * @param result   - The current liveness result (null = pending / not yet probed).
 */
export function isSubmitBlockedByLiveness(
  isReal: boolean,
  result: LivenessResult | null,
): boolean {
  if (!isReal) return false;
  if (result === null) return true;
  return !result.ok;
}

/**
 * Returns `true` when the R21 error banner should be shown.
 *
 * This mirrors the JSX condition in Create.tsx:
 *   `IS_REAL && urlLivenessResult !== null && !urlLivenessResult.ok`
 *
 * @param isReal  - Whether the app is in real (on-chain) mode.
 * @param result  - The current liveness result.
 */
export function shouldShowLivenessBanner(
  isReal: boolean,
  result: LivenessResult | null,
): boolean {
  if (!isReal) return false;
  if (result === null) return false;
  return !result.ok;
}

/**
 * SPEC-0003 §2.4 R21 — Polished, contained error UI.
 *
 * Renders any caught error (a thrown `Error` or a raw string) as a structured
 * card with:
 *   (a) one-line plain-English headline (R16 revert-reason mapping when the
 *       error matches a known contract revert string);
 *   (b) collapsible "Technical details" block hiding the raw `Error(...)`;
 *   (c) a "What to do" hint sourced from the same R16 map;
 *   (d) explicit dismiss + optional retry affordances.
 *
 * The card is contained — fixed slot in its parent — and MUST NOT push other
 * elements off the page or cause the surrounding panel to reflow.
 */
import { useState } from "react";
import { extractRevertReason, mapRevertReason } from "@lib";

export interface ErrorCardProps {
  /** Error or message to render. */
  readonly error: unknown;
  /** Called when the user clicks Dismiss. */
  readonly onDismiss: () => void;
  /** Optional — called when the user clicks Retry; the button is hidden when omitted. */
  readonly onRetry?: () => void;
}

export function ErrorCard({ error, onDismiss, onRetry }: ErrorCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  // R16 revert-reason lookup: when the error matches a known contract revert
  // string, we surface the friendly headline + "what to do" hint from the map.
  // Otherwise (validation, network blip, JS exception) the raw error message
  // is short and already user-facing, so we use it AS the headline rather than
  // burying it under a generic "Something went wrong" — the technical-details
  // collapse still holds the unmodified Error.message for the dev console.
  const reason = extractRevertReason(error);
  const mapped = reason ? mapRevertReason(reason) : null;
  const raw = error instanceof Error ? error.message : String(error);
  const headline = mapped?.headline ?? raw;
  const whatToDo =
    mapped?.details ??
    "Try again — if it keeps failing, check the transaction details and the wallet's connection.";
  const technical = raw;

  return (
    <div
      role="alert"
      className="error-card"
      data-testid="error-card"
    >
      <div className="error-card-head">
        <span className="error-card-icon" aria-hidden="true">⚠</span>
        <strong className="error-card-headline" data-testid="error-card-headline">
          {headline}
        </strong>
      </div>
      <p className="error-card-hint" data-testid="error-card-hint">{whatToDo}</p>
      <details
        className="error-card-details"
        onToggle={(e) => setShowDetails((e.target as HTMLDetailsElement).open)}
      >
        <summary>{showDetails ? "Hide" : "Show"} technical details</summary>
        <pre data-testid="error-card-technical">{technical}</pre>
      </details>
      <div className="error-card-actions">
        {onRetry && (
          <button
            type="button"
            className="primary"
            data-testid="error-card-retry"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
        <button
          type="button"
          data-testid="error-card-dismiss"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

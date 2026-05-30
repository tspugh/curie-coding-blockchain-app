/**
 * SPEC-0003 §2.1 R1. Renders the live STT balance for the active signer.
 * Empty in simulated mode (no provider → hook returns `null`).
 */
import { useWalletBalance } from "../hooks/useWalletBalance.js";
import { formatStt } from "../format.js";

export function WalletBalance(): JSX.Element | null {
  const { wei, refreshedAt } = useWalletBalance();
  // SPEC-0005 R6: always render a column even in sim mode so the top-bar
  // keeps a stable 3-column shape; show "—" instead of going blank.
  const display = wei === null ? "—" : `${formatStt(wei)} STT`;
  return (
    <span
      className="wallet-balance"
      data-testid="wallet-balance"
      title={refreshedAt ? `Refreshed ${new Date(refreshedAt).toLocaleTimeString()}` : ""}
    >
      <span className="label">Balance</span>
      <span className="wallet-line-content">
        <code className="wallet-balance-value">{display}</code>
      </span>
    </span>
  );
}

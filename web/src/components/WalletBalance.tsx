/**
 * SPEC-0003 §2.1 R1. Renders the live STT balance for the active signer.
 * Empty in simulated mode (no provider → hook returns `null`).
 */
import { useWalletBalance } from "../hooks/useWalletBalance.js";
import { formatStt } from "../format.js";

export function WalletBalance(): JSX.Element | null {
  const { wei, refreshedAt } = useWalletBalance();
  if (wei === null) return null;
  return (
    <span
      className="wallet-balance"
      data-testid="wallet-balance"
      title={refreshedAt ? `Refreshed ${new Date(refreshedAt).toLocaleTimeString()}` : ""}
    >
      <span className="label">Balance</span>
      <code>{formatStt(wei)} STT</code>
    </span>
  );
}

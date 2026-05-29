/**
 * SPEC-0003 §2.1 R1. Renders the live STT balance for the active signer.
 * Empty in simulated mode (no provider → hook returns `null`).
 */
import { useWalletBalance } from "../hooks/useWalletBalance.js";

const WEI_PER_STT = 10n ** 18n;

/** Format wei → "1.2345 STT" with 4 decimal places. */
function formatStt(wei: bigint): string {
  const whole = wei / WEI_PER_STT;
  const frac = wei % WEI_PER_STT;
  // 4 decimal places: shift frac by 1e14 (18 − 4 = 14).
  const fracStr = (frac / 10n ** 14n).toString().padStart(4, "0");
  return `${whole.toString()}.${fracStr}`;
}

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

/**
 * SPEC-0003 §2.1 R1 — Live wallet balance.
 *
 * Polls `provider.getBalance(wallet.address)` on mount, on every confirmed
 * tx (via {@link subscribeTxLog}), and on a low-frequency interval
 * (default 30s) gated on document visibility. Skipped in simulated mode
 * (no provider).
 */
import { useEffect, useState } from "react";
import { client } from "../client.js";
import { subscribeTxLog } from "../txLogger.js";

const POLL_MS = 30_000;

interface WalletInfo {
  provider: unknown;
  address: string;
}

function getProvider(): { getBalance(addr: string): Promise<bigint> } | null {
  const w = (client.wallet as unknown) as Partial<WalletInfo>;
  const p = w.provider as
    | { getBalance(addr: string): Promise<bigint> }
    | undefined;
  return p ?? null;
}

export interface WalletBalance {
  /** wei, as bigint. `null` while loading / in simulated mode. */
  readonly wei: bigint | null;
  /** Last refresh timestamp (ms). 0 while loading. */
  readonly refreshedAt: number;
}

export function useWalletBalance(): WalletBalance {
  const [bal, setBal] = useState<WalletBalance>({ wei: null, refreshedAt: 0 });

  useEffect(() => {
    let cancelled = false;
    const provider = getProvider();
    if (!provider) return;

    const refresh = async (): Promise<void> => {
      try {
        const wei = await provider.getBalance(client.wallet.address);
        if (!cancelled) setBal({ wei, refreshedAt: Date.now() });
      } catch {
        // Non-fatal — keep the last known balance, surface no console noise.
      }
    };

    void refresh();

    // Refresh after every confirmed tx so the chip is up-to-date before the
    // user can click the next button.
    const unsub = subscribeTxLog(() => {
      void refresh();
    });

    // Low-frequency idle poll, gated on tab visibility.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);

    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(interval);
    };
  }, []);

  return bal;
}

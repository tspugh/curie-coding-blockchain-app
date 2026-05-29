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

  // Track the signer address so profile-switch (UNIT-7a) re-fires this effect
  // and the chip flips to the new wallet's balance immediately, not after the
  // next 30s idle poll (closes tick-25 LOW 4).
  const address = client.wallet.address;

  useEffect(() => {
    let cancelled = false;
    const provider = getProvider();
    if (!provider) {
      // Reset on profile switch into a simulated client (no provider).
      setBal({ wei: null, refreshedAt: 0 });
      return;
    }

    // Clear stale balance from the previous signer while the new one loads.
    setBal({ wei: null, refreshedAt: 0 });

    const refresh = async (): Promise<void> => {
      try {
        const wei = await provider.getBalance(address);
        if (!cancelled) setBal({ wei, refreshedAt: Date.now() });
      } catch {
        // Non-fatal — keep the last known balance, surface no console noise.
      }
    };

    void refresh();

    const unsub = subscribeTxLog(() => {
      void refresh();
    });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);

    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(interval);
    };
  }, [address]);

  return bal;
}

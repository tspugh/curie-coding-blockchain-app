/**
 * Settings view: active profile picker + wallet info panel.
 *
 * NO fake data. NO hardcoded addresses or balances. NO Agent registry panel
 * (no real on-chain AgentRegistry surface yet — omitted per spec tick 22).
 * NO non-functional buttons (Switch to real, Faucet, Copy address) — left for
 * UNIT-SettingsScreen-actions.
 *
 * Data sources (inline):
 *   - Profile list:     client.profiles.listProfiles()
 *   - Active profile:   activeProfileId prop (lifted state in App.tsx)
 *   - Wallet address:   client.wallet.address
 *   - Wallet mode:      client.wallet.mode
 *   - Balance:          <WalletBalance /> component (live hook, real mode only)
 *   - Agent fee:        VITE_AGENT_FEE_WEI env var (default 330000000000000000 wei)
 *   - Chain ID:         SOMNIA_TESTNET.chainId (50312)
 *   - RPC host:         extracted from SOMNIA_TESTNET.rpcUrl
 */
import { SOMNIA_TESTNET } from "@lib";
import { client } from "../client.js";
import { formatStt, formatSttCompact } from "../format.js";
import { useWalletBalance } from "../hooks/useWalletBalance.js";

const AGENT_FEE_WEI = BigInt(
  import.meta.env.VITE_AGENT_FEE_WEI ?? "330000000000000000",
);

/** "https://api.infra.testnet.somnia.network/" → "api.infra.testnet.somnia.network" */
function rpcHost(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const CHAIN_ID = SOMNIA_TESTNET.chainId;
const RPC_DISPLAY = rpcHost(SOMNIA_TESTNET.rpcUrl);
const AGENT_FEE_STT = formatSttCompact(AGENT_FEE_WEI);

interface SettingsProps {
  readonly activeProfileId: string;
  readonly onProfileChange: (id: string) => void;
  readonly onBack: () => void;
}

export function Settings({
  activeProfileId,
  onProfileChange,
  onBack,
}: SettingsProps) {
  const profiles = client.profiles.listProfiles();
  const isReal = client.wallet.mode === "real";
  const { wei: balanceWei } = useWalletBalance();

  return (
    <section className="view settings">
      <div className="view-head">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <h1>Settings &amp; wallet</h1>
      </div>

      {/* ── Active profile panel ── */}
      <div className="settings-panel">
        <div className="section-label">Active profile</div>
        <p className="hint">
          In production this is your assigned org role; the picker is a demo
          affordance.
        </p>
        <div className="profile-card-grid">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={activeProfileId === p.id}
              className={`profile-card${activeProfileId === p.id ? " is-active" : ""}`}
              onClick={() => onProfileChange(p.id)}
            >
              <div className="profile-card-head">
                <span className="profile-card-label">{p.label}</span>
                <span className="profile-card-party">
                  party {p.partyId.toString()}
                </span>
              </div>
              <div className="profile-card-sub">{p.id}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Wallet panel ── */}
      <div className="settings-panel">
        <div className="section-label">Wallet</div>
        <dl className="fact-list">
          <div className="fact-row">
            <dt>Address</dt>
            <dd>
              <code data-testid="settings-wallet-address">
                {client.wallet.address}
              </code>
            </dd>
          </div>
          <div className="fact-row">
            <dt>Mode</dt>
            <dd>
              <span
                className={`pill no-dot ${isReal ? "tone-ok" : "tone-warn"}`}
                data-testid="settings-wallet-mode"
              >
                {isReal ? "real" : "simulated"}
              </span>
            </dd>
          </div>
          <div className="fact-row">
            <dt>Balance</dt>
            {/* Source: useWalletBalance hook. Null in simulated mode (no provider). */}
            <dd>
              {balanceWei !== null ? (
                <code>{formatStt(balanceWei)} STT</code>
              ) : (
                <span className="dim">—</span>
              )}
            </dd>
          </div>
          <div className="fact-row">
            <dt>Agent fee</dt>
            {/* Source: VITE_AGENT_FEE_WEI (build-time env var). */}
            <dd>
              <code>{AGENT_FEE_STT} STT per adjudication</code>
            </dd>
          </div>
          <div className="fact-row">
            <dt>Network</dt>
            {/* Source: SOMNIA_TESTNET.chainId from src/config/networks.ts. */}
            <dd>
              <code>Somnia testnet · chain {CHAIN_ID}</code>
            </dd>
          </div>
          <div className="fact-row">
            <dt>RPC</dt>
            {/* Source: host portion of SOMNIA_TESTNET.rpcUrl. */}
            <dd>
              <code>{RPC_DISPLAY}</code>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

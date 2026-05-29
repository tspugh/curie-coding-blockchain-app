/**
 * The insurer (payer) party actor (SPEC-0001 §4, revised 2026-05-27). Binds a
 * {@link PartyAgent} to the "insurer" profile — the side that engages a filed
 * request by attaching its governing policy (R5), and may accept/appeal a ruling
 * or settle. The necessity ruling is contract-native; the insurer is only a party.
 *
 * The filename is retained from the pre-pivot "payer" naming; the exported factory
 * is `createInsurerAgent`, with `createPayerAgent` kept as a deprecated alias.
 */
import { type AgentClient, PartyAgent } from "./party-agent.js";

/**
 * Build an insurer {@link PartyAgent} from an app client. Uses the "insurer"
 * profile if present, else the second registered profile (falling back to the
 * first). Accepts an optional `addressOverride` so multi-wallet flows (SPEC-0004
 * R2b: `providerAddr != insurerAddr` per request) can bind the insurer to a
 * distinct address without spinning up a second client + backend.
 */
export function createInsurerAgent(
  client: AgentClient,
  options: { readonly addressOverride?: string } = {},
): PartyAgent {
  const profiles = client.profiles.listProfiles();
  const profile = client.profiles.getProfile("insurer") ?? profiles[1] ?? profiles[0];
  if (!profile) throw new Error("no profile available for the insurer agent");
  return new PartyAgent({
    negotiation: client.negotiation,
    content: client.content,
    partyId: profile.partyId,
    address: options.addressOverride ?? client.wallet.address,
    label: profile.label,
  });
}

/** @deprecated Use {@link createInsurerAgent}. Retained for the pre-pivot name. */
export const createPayerAgent = createInsurerAgent;

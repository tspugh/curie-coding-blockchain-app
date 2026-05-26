/**
 * The provider (prescriber) party actor (SPEC-0001 §4). Binds a {@link PartyAgent}
 * to the "provider" profile — the side that requests coverage, opens the contract,
 * and typically proposes the higher price and raises the dispute.
 */
import { type AgentClient, PartyAgent } from "./party-agent.js";

/**
 * Build a provider {@link PartyAgent} from an app client. Uses the "provider"
 * profile if present, else the first registered profile.
 */
export function createProviderAgent(client: AgentClient): PartyAgent {
  const profile = client.profiles.getProfile("provider") ?? client.profiles.listProfiles()[0];
  if (!profile) throw new Error("no profile available for the provider agent");
  return new PartyAgent({
    negotiation: client.negotiation,
    content: client.content,
    partyId: profile.partyId,
    label: profile.label,
  });
}

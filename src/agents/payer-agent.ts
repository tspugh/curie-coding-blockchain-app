/**
 * The payer (insurer) party actor (SPEC-0001 §4). Binds a {@link PartyAgent} to
 * the "payer" profile — the side that responds with its own position and may
 * appeal/settle. The AI ruling is contract-native; the payer is only a party.
 */
import { type AgentClient, PartyAgent } from "./party-agent.js";

/**
 * Build a payer {@link PartyAgent} from an app client. Uses the "payer" profile
 * if present, else the second registered profile (falling back to the first).
 */
export function createPayerAgent(client: AgentClient): PartyAgent {
  const profiles = client.profiles.listProfiles();
  const profile = client.profiles.getProfile("payer") ?? profiles[1] ?? profiles[0];
  if (!profile) throw new Error("no profile available for the payer agent");
  return new PartyAgent({
    negotiation: client.negotiation,
    content: client.content,
    partyId: profile.partyId,
    label: profile.label,
  });
}

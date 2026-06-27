import usaSpain from "@/data/agent-matches/usa-spain.json";
import type { AgentMatch } from "./types";

/** Pre-computed MiroFish agent-played matches (cached transcripts). */
export const AGENT_MATCHES: Record<string, AgentMatch> = {
  "usa-spain": usaSpain as AgentMatch,
};

export function getAgentMatch(key: string): AgentMatch | null {
  return AGENT_MATCHES[key] ?? null;
}

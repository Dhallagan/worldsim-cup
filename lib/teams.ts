import rawTeams from "@/data/teams.json";
import type { PathRound, Team } from "./types";

export const TEAMS: Team[] = rawTeams as Team[];

const byId = new Map(TEAMS.map((t) => [t.id, t]));

export function getTeam(id: string): Team {
  const team = byId.get(id);
  if (!team) throw new Error(`Unknown team: ${id}`);
  return team;
}

export const USA = getTeam("usa");

/**
 * USA's fixed gauntlet to the title — the @Novig tweet path.
 * Round of 32 → Round of 16 → Quarterfinal → Semifinal → Final.
 */
export const PATH: PathRound[] = [
  { round: "r32", label: "Round of 32", short: "R32", opponentId: "bosnia" },
  { round: "r16", label: "Round of 16", short: "R16", opponentId: "belgium" },
  { round: "qf", label: "Quarterfinal", short: "QF", opponentId: "spain" },
  { round: "sf", label: "Semifinal", short: "SF", opponentId: "france" },
  { round: "final", label: "Final", short: "F", opponentId: "argentina" },
];

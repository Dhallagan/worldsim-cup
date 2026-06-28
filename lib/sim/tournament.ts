import { getTeam, TEAMS } from "@/lib/teams";
import type {
  MatchEvent,
  RoundId,
  Team,
  TournamentMatch,
  TournamentRun,
  TournamentStanding,
  TournamentTopScorer,
} from "@/lib/types";
import { mulberry32, poisson, weightedPick } from "./rng";

const GROUPS: Record<"A" | "B", string[]> = {
  A: ["usa", "spain", "bosnia"],
  B: ["argentina", "france", "belgium"],
};

const ROUND_BY_STAGE: Record<TournamentMatch["stage"], RoundId> = {
  Group: "r32",
  Semifinal: "sf",
  Final: "final",
};

function expectedGoals(attacker: Team, defender: Team, knockout: boolean): number {
  const ratio = attacker.rating.attack / defender.rating.defense;
  const stageLift = knockout ? 1.06 : 0.96;
  return 1.28 * stageLift * Math.pow(ratio, 2.12);
}

function scorerWeights(team: Team): { name: string; w: number }[] {
  return team.players
    .filter((player) => player.pos !== "GK")
    .map((player) => ({
      name: player.name,
      w: Math.pow(Math.max(1, player.shooting), 2),
    }));
}

function pickScorer(team: Team, rng: () => number): string {
  const weights = scorerWeights(team);
  if (weights.length === 0) return team.name;
  const index = weightedPick(
    weights.map((entry) => entry.w),
    rng,
  );
  return weights[index].name;
}

function pickKeeper(team: Team): string {
  return team.players.find((player) => player.pos === "GK" && player.starter)?.name ?? team.players[0].name;
}

function homeWinOnPens(home: Team, away: Team, rng: () => number): boolean {
  const homeEdge =
    (home.rating.overall + 100) /
    (home.rating.overall + away.rating.overall + 200);
  return rng() < homeEdge;
}

function simulateTournamentMatch(
  id: string,
  home: Team,
  away: Team,
  stage: TournamentMatch["stage"],
  seed: number,
  group?: "A" | "B",
): TournamentMatch {
  const rng = mulberry32(seed);
  const knockout = stage !== "Group";
  let homeGoals = poisson(expectedGoals(home, away, knockout), rng);
  let awayGoals = poisson(expectedGoals(away, home, knockout), rng);
  let decided: "reg" | "pens" = "reg";
  let winnerId: string | null = null;

  if (homeGoals > awayGoals) winnerId = home.id;
  if (awayGoals > homeGoals) winnerId = away.id;
  if (knockout && homeGoals === awayGoals) {
    decided = "pens";
    winnerId = homeWinOnPens(home, away, rng) ? home.id : away.id;
  }

  const goalEvents: MatchEvent[] = [];
  for (let i = 0; i < homeGoals; i += 1) {
    const player = pickScorer(home, rng);
    goalEvents.push({
      minute: 4 + Math.floor(rng() * 84),
      type: "goal",
      teamId: home.id,
      player,
      text: `GOAL — ${player} (${home.code})`,
    });
  }
  for (let i = 0; i < awayGoals; i += 1) {
    const player = pickScorer(away, rng);
    goalEvents.push({
      minute: 4 + Math.floor(rng() * 84),
      type: "goal",
      teamId: away.id,
      player,
      text: `GOAL — ${player} (${away.code})`,
    });
  }

  const flavor: MatchEvent[] = Array.from({ length: 4 + Math.floor(rng() * 4) }, () => {
    const team = rng() < 0.5 ? home : away;
    const other = team.id === home.id ? away : home;
    const roll = rng();
    if (roll < 0.46) {
      return {
        minute: 8 + Math.floor(rng() * 78),
        type: "chance" as const,
        teamId: team.id,
        player: pickScorer(team, rng),
        text: `Chance — ${team.code} flash one across goal`,
      };
    }
    if (roll < 0.78) {
      return {
        minute: 8 + Math.floor(rng() * 78),
        type: "save" as const,
        teamId: other.id,
        player: pickKeeper(other),
        text: `Big save — ${pickKeeper(other)} keeps ${other.code} alive`,
      };
    }
    return {
      minute: 8 + Math.floor(rng() * 78),
      type: "card" as const,
      teamId: team.id,
      text: `Yellow card — ${team.code}`,
    };
  });

  const events: MatchEvent[] = [
    {
      minute: 0,
      type: "kickoff" as const,
      teamId: home.id,
      text: `${stage} kickoff — ${home.code} vs ${away.code}`,
    },
    ...goalEvents,
    ...flavor,
  ].sort((a, b) => a.minute - b.minute);

  if (decided === "pens" && winnerId) {
    const winner = getTeam(winnerId);
    events.push({
      minute: 90,
      type: "save",
      teamId: winnerId,
      text: `Penalty shootout — ${winner.code} advance`,
    });
  }

  events.push({
    minute: 90,
    type: "fulltime",
    teamId: winnerId ?? home.id,
    text: `Full time: ${home.code} ${homeGoals}–${awayGoals} ${away.code}${
      decided === "pens" ? " (pens)" : ""
    }`,
  });

  return {
    id,
    stage,
    group,
    round: ROUND_BY_STAGE[stage],
    homeId: home.id,
    awayId: away.id,
    homeGoals,
    awayGoals,
    usaWon: winnerId === home.id,
    decided,
    winnerId,
    events,
  };
}

function emptyStanding(teamId: string): TournamentStanding {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

function applyStanding(standing: TournamentStanding, goalsFor: number, goalsAgainst: number) {
  standing.played += 1;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    standing.won += 1;
    standing.points += 3;
  } else if (goalsFor === goalsAgainst) {
    standing.drawn += 1;
    standing.points += 1;
  } else {
    standing.lost += 1;
  }
}

function sortStandings(standings: TournamentStanding[]): TournamentStanding[] {
  return [...standings].sort((a, b) => {
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    return b.points - a.points || gdB - gdA || b.goalsFor - a.goalsFor;
  });
}

function topScorers(matches: TournamentMatch[]): TournamentTopScorer[] {
  const byKey = new Map<string, TournamentTopScorer>();
  for (const match of matches) {
    for (const event of match.events) {
      if (event.type !== "goal" || !event.player) continue;
      const key = `${event.teamId}:${event.player}`;
      const current = byKey.get(key) ?? {
        player: event.player,
        teamId: event.teamId,
        goals: 0,
      };
      current.goals += 1;
      byKey.set(key, current);
    }
  }
  return [...byKey.values()].sort((a, b) => b.goals - a.goals).slice(0, 6);
}

export function simulateTournament(seed = 20260628): TournamentRun {
  const allIds = new Set(TEAMS.map((team) => team.id));
  const groups = {
    A: GROUPS.A.filter((id) => allIds.has(id)),
    B: GROUPS.B.filter((id) => allIds.has(id)),
  };
  const matches: TournamentMatch[] = [];
  const standings = {
    A: groups.A.map(emptyStanding),
    B: groups.B.map(emptyStanding),
  };
  const standingById = new Map(
    [...standings.A, ...standings.B].map((standing) => [standing.teamId, standing]),
  );

  let index = 0;
  for (const groupName of ["A", "B"] as const) {
    const teamIds = groups[groupName];
    for (let i = 0; i < teamIds.length; i += 1) {
      for (let j = i + 1; j < teamIds.length; j += 1) {
        const match = simulateTournamentMatch(
          `group-${groupName}-${i}-${j}`,
          getTeam(teamIds[i]),
          getTeam(teamIds[j]),
          "Group",
          seed + index * 997,
          groupName,
        );
        matches.push(match);
        applyStanding(standingById.get(match.homeId)!, match.homeGoals, match.awayGoals);
        applyStanding(standingById.get(match.awayId)!, match.awayGoals, match.homeGoals);
        index += 1;
      }
    }
  }

  const sortedA = sortStandings(standings.A);
  const sortedB = sortStandings(standings.B);
  const semifinalOne = simulateTournamentMatch(
    "semifinal-1",
    getTeam(sortedA[0].teamId),
    getTeam(sortedB[1].teamId),
    "Semifinal",
    seed + 7001,
  );
  const semifinalTwo = simulateTournamentMatch(
    "semifinal-2",
    getTeam(sortedB[0].teamId),
    getTeam(sortedA[1].teamId),
    "Semifinal",
    seed + 7002,
  );
  const final = simulateTournamentMatch(
    "final",
    getTeam(semifinalOne.winnerId!),
    getTeam(semifinalTwo.winnerId!),
    "Final",
    seed + 9001,
  );

  return {
    id: `mirofish-${seed}`,
    name: "MiroFish Cup",
    teams: [...groups.A, ...groups.B],
    groups,
    standings: {
      A: sortedA,
      B: sortedB,
    },
    matches: [...matches, semifinalOne, semifinalTwo, final],
    semifinals: [semifinalOne, semifinalTwo],
    final,
    championId: final.winnerId!,
    topScorers: topScorers([...matches, semifinalOne, semifinalTwo, final]),
  };
}

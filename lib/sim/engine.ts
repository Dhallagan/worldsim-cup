import { PATH, USA, getTeam } from "@/lib/teams";
import type {
  MatchEvent,
  MatchResult,
  Playthrough,
  RoundId,
  Team,
} from "@/lib/types";
import { mulberry32, poisson, weightedPick } from "./rng";

const BASE_XG = 1.35;
const SENSITIVITY = 2.2;

function expectedGoals(attacker: Team, defender: Team): number {
  const ratio = attacker.rating.attack / defender.rating.defense;
  return BASE_XG * Math.pow(ratio, SENSITIVITY);
}

/** Attacking players weighted by finishing, for picking scorers. */
function scorerWeights(team: Team): { name: string; w: number }[] {
  return team.players
    .filter((p) => p.pos !== "GK")
    .map((p) => ({
      name: p.name,
      w: Math.pow(Math.max(1, p.shooting), 2),
    }));
}

function pickScorer(team: Team, rng: () => number): string {
  const ws = scorerWeights(team);
  if (ws.length === 0) return team.name;
  const i = weightedPick(
    ws.map((x) => x.w),
    rng,
  );
  return ws[i].name;
}

/**
 * Simulate a single knockout match. USA is always `home`.
 * Returns regulation goals plus a decided winner (penalties break ties).
 */
export function simulateMatch(
  home: Team,
  away: Team,
  round: RoundId,
  seed: number,
): MatchResult {
  const rng = mulberry32(seed);
  const xgHome = expectedGoals(home, away);
  const xgAway = expectedGoals(away, home);

  const homeGoals = poisson(xgHome, rng);
  const awayGoals = poisson(xgAway, rng);

  // --- Goals (rng for minute + scorer) ---
  const body: MatchEvent[] = [];
  for (let i = 0; i < homeGoals; i++) {
    const scorer = pickScorer(home, rng);
    body.push({
      minute: 1 + Math.floor(rng() * 90),
      type: "goal",
      teamId: home.id,
      player: scorer,
      text: `GOAL — ${scorer} (${home.code})`,
    });
  }
  for (let i = 0; i < awayGoals; i++) {
    const scorer = pickScorer(away, rng);
    body.push({
      minute: 1 + Math.floor(rng() * 90),
      type: "goal",
      teamId: away.id,
      player: scorer,
      text: `GOAL — ${scorer} (${away.code})`,
    });
  }

  // --- Winner (penalties break ties) ---
  let usaWon: boolean;
  let decided: "reg" | "pens" = "reg";
  if (homeGoals !== awayGoals) {
    usaWon = homeGoals > awayGoals;
  } else {
    decided = "pens";
    const homeEdge =
      (home.rating.overall + 100) /
      (home.rating.overall + away.rating.overall + 200);
    usaWon = rng() < homeEdge;
  }

  // --- Flavor events (cosmetic; drawn last so they don't shift the result) ---
  const flavorCount = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < flavorCount; i++) {
    const minute = 1 + Math.floor(rng() * 90);
    const forHome = rng() < 0.5;
    const team = forHome ? home : away;
    const keeper = forHome ? away : home;
    const roll = rng();
    if (roll < 0.5) {
      body.push({
        minute,
        type: "chance",
        teamId: team.id,
        player: pickScorer(team, rng),
        text: `Chance — ${team.code} go close`,
      });
    } else if (roll < 0.85) {
      body.push({
        minute,
        type: "save",
        teamId: keeper.id,
        text: `Big save keeps ${keeper.code} level`,
      });
    } else {
      body.push({
        minute,
        type: "card",
        teamId: team.id,
        text: `Yellow card — ${team.code}`,
      });
    }
  }

  body.sort((a, b) => a.minute - b.minute);

  const events: MatchEvent[] = [
    { minute: 0, type: "kickoff", teamId: home.id, text: "Kick-off" },
    ...body,
  ];
  if (decided === "pens") {
    events.push({
      minute: 90,
      type: "save",
      teamId: usaWon ? home.id : away.id,
      text: `Penalty shootout — ${(usaWon ? home : away).code} advance`,
    });
  }
  events.push({
    minute: 90,
    type: "fulltime",
    teamId: home.id,
    text: `Full time: ${home.code} ${homeGoals}–${awayGoals} ${away.code}${
      decided === "pens" ? " (pens)" : ""
    }`,
  });

  return {
    round,
    homeId: home.id,
    awayId: away.id,
    homeGoals,
    awayGoals,
    usaWon,
    decided,
    events,
  };
}

/**
 * Run USA through the full gauntlet with one seed. Stops when USA is knocked out.
 * Each round derives a distinct sub-seed so rounds are independent but reproducible.
 */
export function runPlaythrough(seed: number): Playthrough {
  const results: MatchResult[] = [];
  let eliminatedAt: RoundId | null = null;

  for (let i = 0; i < PATH.length; i++) {
    const step = PATH[i];
    const opp = getTeam(step.opponentId);
    const matchSeed = (seed + i * 0x9e3779b1) >>> 0;
    const res = simulateMatch(USA, opp, step.round, matchSeed);
    results.push(res);
    if (!res.usaWon) {
      eliminatedAt = step.round;
      break;
    }
  }

  return {
    seed,
    results,
    champion: eliminatedAt === null,
    eliminatedAt,
  };
}

/**
 * Find the first seed at/after `start` where USA wins all five — used for the
 * headline demo run so the trophy lift is guaranteed and reproducible.
 */
export function findChampionRun(start = 1, maxTries = 5000): Playthrough {
  for (let s = start; s < start + maxTries; s++) {
    const run = runPlaythrough(s);
    if (run.champion) return run;
  }
  // Fallback: return the best run found (shouldn't happen with these ratings).
  return runPlaythrough(start);
}

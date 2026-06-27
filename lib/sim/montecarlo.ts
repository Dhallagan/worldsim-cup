import { PATH, USA, getTeam } from "@/lib/teams";
import type { OddsReport, RoundOdds } from "@/lib/types";
import { simulateMatch } from "./engine";

function simSeed(round: number, run: number): number {
  return (round * 0x9e3779b1 + run * 2654435761 + 1) >>> 0;
}

/**
 * Monte Carlo USA's gauntlet. Each round is simulated `runs` times to get the
 * conditional probability USA beats that opponent; cumulative = product of
 * rounds; title odds = product of all five. Deterministic (fixed seed stream).
 */
export function runMonteCarlo(runs = 2000): OddsReport {
  const rounds: RoundOdds[] = [];
  let cumulative = 1;

  for (let i = 0; i < PATH.length; i++) {
    const step = PATH[i];
    const opp = getTeam(step.opponentId);

    let wins = 0;
    let homeGoals = 0;
    let awayGoals = 0;

    for (let r = 0; r < runs; r++) {
      const res = simulateMatch(USA, opp, step.round, simSeed(i, r));
      if (res.usaWon) wins++;
      homeGoals += res.homeGoals;
      awayGoals += res.awayGoals;
    }

    const winPct = wins / runs;
    cumulative *= winPct;

    rounds.push({
      round: step.round,
      opponentId: opp.id,
      winPct,
      cumulativePct: cumulative,
      avgScore: `${USA.code} ${Math.round(homeGoals / runs)}–${Math.round(
        awayGoals / runs,
      )} ${opp.code}`,
    });
  }

  return { rounds, titlePct: cumulative, runs };
}

import { generateText } from "ai";
import { getFastModel, hasAI, withTimeout } from "./ai";
import { getTeam } from "./teams";
import type { OddsReport } from "./types";

function pct(n: number) {
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
}

function templateReport(odds: OddsReport): string {
  const hardest = [...odds.rounds].sort((a, b) => a.winPct - b.winPct)[0];
  const opp = getTeam(hardest.opponentId);
  return (
    `The model gives the USA a ${pct(odds.titlePct)} shot at lifting the trophy across ${odds.runs.toLocaleString()} ` +
    `simulations per round. The biggest wall is ${opp.name} (${pct(hardest.winPct)} to win that tie). ` +
    `Survive the gauntlet and it's history — but the math says this is a long shot worth dreaming on.`
  );
}

/**
 * MiroFish ReportAgent — reads the Monte Carlo logs and writes the prediction.
 * This is the "Monte Carlo as an agent": the agent owns the analysis, the
 * deterministic tool owns the math. Falls back to a template with no key.
 */
export async function reportAgent(odds: OddsReport): Promise<string> {
  if (!hasAI()) return templateReport(odds);
  try {
    const model = getFastModel()!;
    const rounds = odds.rounds
      .map(
        (r) =>
          `${getTeam(r.opponentId).name}: ${pct(r.winPct)} to win, ${pct(
            r.cumulativePct,
          )} still alive`,
      )
      .join("; ");
    const { text } = await withTimeout(
      generateText({
        model,
        prompt:
          "You are MiroFish's ReportAgent analyzing a Monte Carlo simulation of the USA's World Cup knockout run. " +
          "Write a sharp, 2-3 sentence broadcast-style verdict on the USA's title chances. Name the toughest match. " +
          "Be vivid but grounded in the numbers. Do not use markdown.\n\n" +
          `Title odds: ${pct(odds.titlePct)} over ${odds.runs} sims/round.\nPer round: ${rounds}.`,
      }),
      12000,
    );
    return text.trim() || templateReport(odds);
  } catch {
    return templateReport(odds);
  }
}

import { hasAI } from "@/lib/ai";
import { generatePersonas } from "@/lib/personas";
import { persistRun } from "@/lib/persist";
import { reportAgent } from "@/lib/report";
import { sendRecap } from "@/lib/recap";
import { findChampionRun } from "@/lib/sim/engine";
import { runMonteCarlo } from "@/lib/sim/montecarlo";
import { PATH, TEAMS } from "@/lib/teams";
import type { AgentEvent } from "@/lib/types";

export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Slice 4 — the orchestrator agent. Runs MiroFish's five-stage lifecycle and
 * streams progress as NDJSON. Deterministic tools (Monte Carlo, playthrough)
 * own the math; Claude owns the persona + report narration (scripted fallback).
 */
export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

      try {
        const playerCount = TEAMS.reduce((n, t) => n + t.players.length, 0);
        const mode = hasAI() ? "Claude" : "scripted";

        // Stage 1 — Graph Building
        send({ t: "stage", stage: "graph", label: "Graph Building" });
        send({
          t: "reason",
          text: `Ingesting the seed (USA's bracket path) and extracting entities. Narration engine: ${mode}.`,
        });
        send({ t: "tool", name: "buildKnowledgeGraph", status: "call", detail: "GraphRAG over teams, players, fixtures" });
        await sleep(450);
        send({
          t: "tool",
          name: "buildKnowledgeGraph",
          status: "result",
          detail: `${TEAMS.length} nations · ${playerCount} players · ${PATH.length} rounds`,
        });

        // Stage 2 — Environment Setup (player agent personas)
        send({ t: "stage", stage: "env", label: "Environment Setup" });
        send({ t: "reason", text: "Spinning up autonomous player agents with personas seeded from attributes…" });
        send({ t: "tool", name: "generatePersonas", status: "call", detail: `${playerCount} player agents` });
        const personas = await generatePersonas();
        send({ t: "personas", personas });
        send({ t: "tool", name: "generatePersonas", status: "result", detail: `${personas.length} agents online` });

        // Stage 3 — Simulation Execution
        send({ t: "stage", stage: "sim", label: "Simulation Execution" });
        send({ t: "reason", text: "Running 2,000 Monte Carlo simulations per round across the swarm…" });
        send({ t: "tool", name: "runMonteCarlo", status: "call", detail: "2,000 runs / round" });
        await sleep(300);
        const odds = runMonteCarlo(2000);
        send({ t: "odds", report: odds });
        send({
          t: "tool",
          name: "runMonteCarlo",
          status: "result",
          detail: `USA title odds ${(odds.titlePct * 100).toFixed(1)}%`,
        });

        send({ t: "tool", name: "simulatePlaythrough", status: "call", detail: "featured agent-driven run" });
        const run = findChampionRun(7);
        send({ t: "play", run });
        send({
          t: "tool",
          name: "simulatePlaythrough",
          status: "result",
          detail: run.champion ? "USA win the cup 🏆" : "USA eliminated",
        });

        // Stage 4 — Report Generation (the ReportAgent / "Monte Carlo as an agent")
        send({ t: "stage", stage: "report", label: "Report Generation" });
        send({ t: "reason", text: "ReportAgent reading the simulation logs to write the verdict…" });
        send({ t: "tool", name: "reportAgent", status: "call", detail: "analyzing logs" });
        const summary = await reportAgent(odds);
        send({ t: "report", text: summary });
        send({ t: "tool", name: "reportAgent", status: "result", detail: "verdict ready" });

        // Persist + recap (best-effort; surfaced in the console)
        send({ t: "tool", name: "saveToSupabase", status: "call", detail: "persisting run" });
        const saved = await persistRun(odds, run, summary);
        send({
          t: "tool",
          name: "saveToSupabase",
          status: "result",
          detail: saved.ok ? `saved row ${saved.id?.slice(0, 8)}` : `skipped — ${saved.error}`,
        });

        send({ t: "tool", name: "sendRecap", status: "call", detail: "emailing the verdict" });
        const mailed = await sendRecap(odds, summary);
        send({
          t: "tool",
          name: "sendRecap",
          status: "result",
          detail: mailed.ok ? `emailed ${mailed.to}` : `skipped — ${mailed.error}`,
        });

        // Stage 5 — Done
        send({ t: "stage", stage: "done", label: "Complete" });
      } catch (err) {
        send({
          t: "reason",
          text: `Agent error: ${err instanceof Error ? err.message : "unknown"}`,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

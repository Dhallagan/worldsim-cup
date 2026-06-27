import { NextResponse } from "next/server";
import { simulateAgentMatch } from "@/lib/sim/agentMatch";

export const maxDuration = 300;

/**
 * Pre-compute a MiroFish agent-played match.
 *   /api/agent-match?home=usa&away=spain&seed=7
 * Slow (one LLM call per possession) — call once and cache the result.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const home = url.searchParams.get("home") || "usa";
  const away = url.searchParams.get("away") || "spain";
  const seed = Number(url.searchParams.get("seed")) || 7;
  const match = await simulateAgentMatch(home, away, seed);
  return NextResponse.json(match);
}

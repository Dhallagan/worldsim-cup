import { NextResponse } from "next/server";
import { runMonteCarlo } from "@/lib/sim/montecarlo";

/**
 * Slice 3 — Monte Carlo odds for USA's gauntlet.
 *   /api/odds            → 2,000 runs per round
 *   /api/odds?runs=5000  → custom sample size
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const runs = Math.min(20000, Math.max(100, Number(url.searchParams.get("runs")) || 2000));
  return NextResponse.json(runMonteCarlo(runs));
}

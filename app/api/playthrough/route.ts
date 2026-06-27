import { NextResponse } from "next/server";
import { findChampionRun, runPlaythrough } from "@/lib/sim/engine";

/**
 * Slice 2 — one playthrough of USA's gauntlet.
 *   /api/playthrough            → headline run (USA wins it all, reproducible)
 *   /api/playthrough?seed=123   → a specific seed (may end in elimination)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const seedParam = url.searchParams.get("seed");

  const run =
    seedParam !== null
      ? runPlaythrough(Number(seedParam) || 1)
      : findChampionRun(7);

  return NextResponse.json(run);
}

import { NextResponse } from "next/server";
import { simulateTournament } from "@/lib/sim/tournament";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const seed = Number(url.searchParams.get("seed")) || 20260628;
  return NextResponse.json(simulateTournament(seed));
}

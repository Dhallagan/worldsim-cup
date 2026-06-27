import { createSupabaseAdmin, hasSupabaseConfig } from "./supabase";
import type { OddsReport, Playthrough } from "./types";

export interface PersistResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Best-effort persistence of a swarm run to Supabase. Never throws — returns a
 * status the agent surfaces in the console. Run supabase/worldsim.sql once to
 * create the `sim_runs` table.
 */
export async function persistRun(
  odds: OddsReport,
  run: Playthrough,
  report: string,
): Promise<PersistResult> {
  if (!hasSupabaseConfig()) return { ok: false, error: "Supabase not configured" };
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("sim_runs")
      .insert({
        title_pct: odds.titlePct,
        runs: odds.runs,
        champion: run.champion,
        rounds: odds.rounds,
        playthrough: run,
        report,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "insert failed" };
  }
}

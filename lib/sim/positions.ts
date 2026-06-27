import type { Player, Team } from "@/lib/types";

/** Pitch is 100 (length) x 64 (width). Home attacks → +x, away attacks → -x. */
export interface Spot {
  x: number;
  y: number;
  number: number;
  name: string;
  pos: string;
}

type Line = "GK" | "DEF" | "MID" | "ATT";

function lineOf(pos: string): Line {
  if (pos === "GK") return "GK";
  if (["CB", "LB", "RB", "RWB", "LWB", "LCB", "RCB"].includes(pos)) return "DEF";
  if (["CDM", "DM", "CM", "CAM", "LM", "RM"].includes(pos)) return "MID";
  return "ATT";
}

const LINE_X: Record<Line, number> = { GK: 7, DEF: 26, MID: 48, ATT: 72 };

function starters(team: Team): Player[] {
  const s = team.players.filter((p) => p.starter);
  return (s.length >= 7 ? s : team.players).slice(0, 11);
}

/**
 * Lay a team out in lines (GK/DEF/MID/ATT), spreading each line across the width.
 * `side` flips the half (and mirrors width) so the two teams face each other.
 */
export function buildFormation(
  team: Team,
  side: "home" | "away",
): Map<string, Spot> {
  const players = starters(team);
  const lines: Record<Line, Player[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const p of players) lines[lineOf(p.pos)].push(p);

  const spots = new Map<string, Spot>();
  let number = 1;

  (["GK", "DEF", "MID", "ATT"] as Line[]).forEach((line) => {
    const group = lines[line];
    const n = group.length;
    group.forEach((p, i) => {
      // Even spread across the width, with margins.
      const t = n === 1 ? 0.5 : i / (n - 1);
      let y = 10 + t * 44; // 10..54
      let x = LINE_X[line];
      if (side === "away") {
        x = 100 - x;
        y = 64 - y;
      }
      spots.set(p.id, {
        x,
        y,
        number: p.pos === "GK" ? 1 : ++number,
        name: p.name,
        pos: p.pos,
      });
    });
  });

  return spots;
}

/** The goal a team attacks toward. */
export function attackingGoal(side: "home" | "away"): { x: number; y: number } {
  return side === "home" ? { x: 100, y: 32 } : { x: 0, y: 32 };
}

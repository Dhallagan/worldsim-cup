import type { Spot } from "./positions";

export type Side = "home" | "away";
export type MoveSpot = Spot & { side: Side };

type Pt = { x: number; y: number };
type Line = "GK" | "DEF" | "MID" | "ATT";

function lineOf(pos: string): Line {
  if (pos === "GK") return "GK";
  if (["CB", "LB", "RB", "RWB", "LWB"].includes(pos)) return "DEF";
  if (["CDM", "DM", "CM", "CAM", "LM", "RM"].includes(pos)) return "MID";
  return "ATT";
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// depth = how far toward this team's attacking goal (0 = own goal, 100 = opp goal)
const depthOf = (x: number, side: Side) => (side === "home" ? x : 100 - x);
const xFromDepth = (d: number, side: Side) => (side === "home" ? d : 100 - d);

function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Where every player wants to be — role-aware, not a blob toward the ball.
 * Defenders hold a line + mark, midfielders sit between the lines and support,
 * forwards make off-ball runs, fullbacks overlap, the nearest man presses.
 * `time` (seconds) drives subtle off-ball runs so the shape breathes.
 */
export function computeTargets(
  spots: Map<string, MoveSpot>,
  ball: Pt,
  possSide: Side,
  time: number,
): Map<string, Pt> {
  // nearest defender (defending side) to the ball = the presser
  let pressId: string | null = null;
  let pd = Infinity;
  spots.forEach((s, id) => {
    if (s.side !== possSide && lineOf(s.pos) !== "GK") {
      const d = (s.x - ball.x) ** 2 + (s.y - ball.y) ** 2;
      if (d < pd) {
        pd = d;
        pressId = id;
      }
    }
  });

  const out = new Map<string, Pt>();

  spots.forEach((s, id) => {
    const side = s.side;
    const attacking = possSide === side;
    const L = lineOf(s.pos);
    const baseDepth = depthOf(s.x, side);
    const ballDepth = depthOf(ball.x, side);
    const h = hash01(id);
    const wander = (amp: number) => amp * Math.sin(time * 0.8 + h * 6.283);

    let depth = baseDepth;
    let y = s.y;

    if (L === "GK") {
      depth = clamp(6 + Math.max(0, ballDepth - 40) * 0.12, 5, 16);
      y = 32 + (ball.y - 32) * 0.35;
    } else if (L === "DEF") {
      depth = attacking
        ? clamp(ballDepth - 22, 20, 54)
        : clamp(ballDepth - 12, 10, 46);
      y = s.y * 0.74 + ball.y * 0.26;
      // overlapping fullback: ball wide on my flank & we attack → bomb on
      const isFB = s.pos === "LB" || s.pos === "RB";
      if (attacking && isFB && Math.abs(ball.y - s.y) < 20) {
        depth = clamp(ballDepth + 6 + wander(4), 30, 82);
        y = s.y * 0.55 + ball.y * 0.45;
      }
    } else if (L === "MID") {
      depth = attacking
        ? clamp(ballDepth - 2 + wander(7), 28, 80)
        : clamp(ballDepth - 4, 16, 60);
      y = s.y * 0.66 + ball.y * 0.34 + wander(4);
    } else {
      // forwards: stretch the last line & make runs when attacking
      const wide = s.pos === "LW" || s.pos === "RW";
      depth = attacking
        ? clamp(ballDepth + 12 + wander(9), 50, 93)
        : clamp(ballDepth + 4, 40, 80);
      y = wide
        ? s.y * 0.82 + ball.y * 0.18 // wingers hold width
        : s.y * 0.58 + ball.y * 0.42 + wander(7);
    }

    out.set(id, {
      x: clamp(xFromDepth(depth, side), 3, 97),
      y: clamp(y, 4, 60),
    });
  });

  // the presser steps onto the ball
  if (pressId) out.set(pressId, { x: ball.x, y: ball.y });

  return out;
}

export { lineOf };

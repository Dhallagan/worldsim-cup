"use client";

import { useEffect, useMemo, useRef } from "react";
import { getTeam } from "@/lib/teams";
import { attackingGoal, buildFormation, type Spot } from "@/lib/sim/positions";
import { computeTargets, type MoveSpot } from "@/lib/sim/movement";
import type { AgentMatch, AgentMatchEvent } from "@/lib/types";

const W = 480;
const H = 307;
const M = 16;
const tx = (px: number) => M + (px / 100) * (W - 2 * M);
const ty = (py: number) => M + (py / 64) * (H - 2 * M);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function durFor(type: AgentMatchEvent["type"]): number {
  switch (type) {
    case "goal": return 1900;
    case "shot": return 1000;
    case "save": return 1000;
    case "kickoff": return 700;
    case "fulltime": return 3000;
    default: return 720;
  }
}

interface Step {
  e: AgentMatchEvent;
  actorId?: string;
  isShot: boolean;
  goal?: { x: number; y: number };
  dribbleAdvance: number;
  dur: number;
}

export interface PitchState {
  minute: number;
  h: number;
  a: number;
  text: string;
  intent: string;
  type: AgentMatchEvent["type"];
  done: boolean;
}

export default function Pitch({
  match,
  loop = false,
  onState,
}: {
  match: AgentMatch;
  loop?: boolean;
  onState?: (s: PitchState) => void;
}) {
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(onState);
  useEffect(() => {
    stateRef.current = onState;
  }, [onState]);

  const { spots, steps, attrs } = useMemo(() => {
    const hf = buildFormation(home, "home");
    const af = buildFormation(away, "away");
    const all = new Map<string, MoveSpot>();
    hf.forEach((s: Spot, id) => all.set(id, { ...s, side: "home" }));
    af.forEach((s: Spot, id) => all.set(id, { ...s, side: "away" }));

    const attrs = new Map<string, { pace: number; stamina: number }>();
    for (const t of [home, away])
      for (const p of t.players)
        attrs.set(p.id, { pace: p.pace ?? 70, stamina: p.stamina ?? 75 });

    const steps: Step[] = match.events.map((e) => {
      const isShot = e.type === "shot" || e.type === "goal";
      const dribbleAdvance =
        e.type === "dribble" ? 11 : e.type === "pass" ? 3 : 0;
      return {
        e,
        actorId: e.playerId,
        isShot,
        goal: isShot ? attackingGoal(e.teamId === home.id ? "home" : "away") : undefined,
        dribbleAdvance,
        dur: durFor(e.type),
      };
    });
    return { spots: all, steps, attrs };
  }, [match, home, away]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    type P = { x: number; y: number };
    let idx = 0;
    let t = 0;
    let last = 0;
    let raf = 0;
    let stopped = false;

    const live = new Map<string, P>();
    const stam = new Map<string, number>();
    const reset = () => {
      spots.forEach((s, id) => {
        live.set(id, { x: s.x, y: s.y });
        stam.set(id, attrs.get(id)?.stamina ?? 75);
      });
    };
    reset();

    let ball: P = { x: 50, y: 32 };
    let possSide: "home" | "away" = "home";
    let anchor: P = { x: 50, y: 32 };

    function onEnter(i: number) {
      const st = steps[i];
      possSide = st.e.teamId === home.id ? "home" : "away";
      const a = st.actorId ? live.get(st.actorId) : undefined;
      anchor = a ? { ...a } : { x: 50, y: 32 };
      stateRef.current?.({
        minute: st.e.minute, h: st.e.homeGoals, a: st.e.awayGoals,
        text: st.e.text, intent: st.e.intent ?? "", type: st.e.type, done: false,
      });
    }
    onEnter(0);

    function drawPitch() {
      ctx.fillStyle = "#2f7a37";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#2f7a37" : "#2b7033";
        ctx.fillRect(M + (i / 9) * (W - 2 * M), M, (W - 2 * M) / 9 + 1, H - 2 * M);
      }
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(M, M, W - 2 * M, H - 2 * M);
      ctx.beginPath();
      ctx.moveTo(tx(50), ty(0));
      ctx.lineTo(tx(50), ty(64));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx(50), ty(32), 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.fillRect(tx(50) - 1, ty(32) - 1, 2, 2);
      const box = (left: boolean) => {
        ctx.strokeRect(left ? M : W - M - 52, ty(18), 52, ty(46) - ty(18));
        ctx.strokeRect(left ? M : W - M - 22, ty(26), 22, ty(38) - ty(26));
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.fillRect(left ? M - 4 : W - M, ty(28), 4, ty(36) - ty(28));
      };
      box(true);
      box(false);
    }

    function drawSprite(x: number, y: number, kit: string, number: number, active: boolean) {
      const r = (a: number, b: number, w: number, h: number, c: string) => {
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x + a), Math.round(y + b), w, h);
      };
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = "rgba(255,235,90,.95)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y + 1, 6.5, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      r(-2, -3, 1.6, 4, "#fff");
      r(0.6, -3, 1.6, 4, "#fff");
      r(-2.4, -5, 5, 3, "#e9eef5");
      r(-2.6, -9, 5.2, 5, kit);
      r(-3.6, -8.5, 1.2, 3.6, kit);
      r(2.4, -8.5, 1.2, 3.6, kit);
      ctx.fillStyle = "#e8b88f";
      ctx.beginPath();
      ctx.arc(x, y - 10.5, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.font = "5px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(number), x, y - 12.5);
    }

    function frame(ts: number) {
      if (stopped) return;
      if (!last) last = ts;
      const dt = Math.min(48, ts - last);
      last = ts;
      const cur = steps[idx];
      t += dt / cur.dur;

      if (t >= 1) {
        t = 0;
        idx++;
        if (idx >= steps.length) {
          if (loop) {
            idx = 0;
            reset();
            ball = { x: 50, y: 32 };
            onEnter(0);
          } else {
            stopped = true;
            const e = steps[steps.length - 1].e;
            stateRef.current?.({
              minute: e.minute, h: e.homeGoals, a: e.awayGoals,
              text: e.text, intent: e.intent ?? "", type: e.type, done: true,
            });
            return;
          }
        } else {
          onEnter(idx);
        }
      }

      const step = steps[idx];
      const timeSec = ts / 1000;

      // role-based shape targets, then override the ball-carrier
      const targets = computeTargets(spots, ball, possSide, timeSec);
      if (step.actorId && spots.get(step.actorId)?.side === possSide) {
        const side = possSide;
        const dir = side === "home" ? 1 : -1;
        targets.set(step.actorId, {
          x: Math.max(4, Math.min(96, anchor.x + dir * step.dribbleAdvance * ease(t))),
          y: anchor.y,
        });
      }

      // steer everyone toward target; speed scaled by pace + stamina
      const speedScale = (dt / 16) * 1.25;
      live.forEach((p, id) => {
        const tg = targets.get(id)!;
        const a = attrs.get(id)!;
        const s = stam.get(id) ?? 75;
        const base = speedScale * (0.6 + 0.4 * (a.pace / 99)) * (0.55 + 0.45 * (s / 100));
        const dx = tg.x - p.x;
        const dy = tg.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01) {
          const stepLen = Math.min(d, base);
          p.x += (dx / d) * stepLen;
          p.y += (dy / d) * stepLen;
          stam.set(id, Math.max(34, s - stepLen * 0.05));
        }
      });

      // ball: fly to goal on a shot, else stick to the carrier
      const bt = step.isShot && step.goal
        ? step.goal
        : step.actorId
          ? live.get(step.actorId) ?? ball
          : ball;
      const bdx = bt.x - ball.x;
      const bdy = bt.y - ball.y;
      const bd = Math.hypot(bdx, bdy);
      if (bd > 0.01) {
        const bstep = Math.min(bd, speedScale * 5);
        ball.x += (bdx / bd) * bstep;
        ball.y += (bdy / bd) * bstep;
      }

      drawPitch();
      if (cur.e.type === "goal" && Math.floor(ts / 120) % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.fillRect(0, 0, W, H);
      }
      const ordered = Array.from(live.entries()).sort((a, b) => a[1].y - b[1].y);
      for (const [id, p] of ordered) {
        const s = spots.get(id)!;
        drawSprite(
          tx(p.x), ty(p.y),
          s.side === "away" ? away.color : home.color,
          s.number, id === cur.actorId,
        );
      }
      ctx.beginPath();
      ctx.arc(tx(ball.x), ty(ball.y), 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#111";
      ctx.stroke();

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [steps, spots, attrs, home.color, away.color, home.id, away.id, loop]);

  return (
    <div className="pitch-screen">
      <canvas ref={canvasRef} width={W} height={H} className="pitch-canvas" />
      <div className="pitch-scan" />
    </div>
  );
}

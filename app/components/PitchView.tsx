"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getTeam } from "@/lib/teams";
import { attackingGoal, buildFormation, type Spot } from "@/lib/sim/positions";
import type { AgentMatch, AgentMatchEvent } from "@/lib/types";

// Low internal resolution → scaled up + pixelated for the 1998 look.
const W = 480;
const H = 307;
const M = 16;
const tx = (px: number) => M + (px / 100) * (W - 2 * M);
const ty = (py: number) => M + (py / 64) * (H - 2 * M);

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function durFor(type: AgentMatchEvent["type"]): number {
  switch (type) {
    case "goal": return 1800;
    case "shot": return 950;
    case "save": return 950;
    case "kickoff": return 600;
    case "fulltime": return 3200;
    default: return 640;
  }
}

interface Step {
  e: AgentMatchEvent;
  ball: { x: number; y: number };
  actorId?: string;
  dur: number;
}

export default function PitchView({
  match,
  onClose,
}: {
  match: AgentMatch;
  onClose: () => void;
}) {
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { spots, steps } = useMemo(() => {
    const hf = buildFormation(home, "home");
    const af = buildFormation(away, "away");
    const all = new Map<string, Spot & { side: "home" | "away" }>();
    hf.forEach((s, id) => all.set(id, { ...s, side: "home" }));
    af.forEach((s, id) => all.set(id, { ...s, side: "away" }));

    const steps: Step[] = match.events.map((e) => {
      let ball = { x: 50, y: 32 };
      if (e.type === "goal" || e.type === "shot") {
        ball = attackingGoal(e.teamId === home.id ? "home" : "away");
      } else if (e.playerId && all.has(e.playerId)) {
        const s = all.get(e.playerId)!;
        ball = { x: s.x, y: s.y };
      }
      return { e, ball, actorId: e.playerId, dur: durFor(e.type) };
    });
    return { spots: all, steps };
  }, [match, home, away]);

  const [hud, setHud] = useState({
    minute: 0,
    h: 0,
    a: 0,
    text: "Kick-off",
    intent: "",
    type: "kickoff" as AgentMatchEvent["type"],
    goalFlash: false,
  });
  const [done, setDone] = useState(false);
  const [nonce, setNonce] = useState(0); // restart trigger

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    let idx = 0;
    let t = 0;
    let last = 0;
    let raf = 0;
    let stopped = false;
    setDone(false);

    type P = { x: number; y: number };
    const live = new Map<string, P>();
    const targets = new Map<string, P>();
    spots.forEach((s, id) => {
      live.set(id, { x: s.x, y: s.y });
      targets.set(id, { x: s.x, y: s.y });
    });

    // Where every player wants to be this possession: the team shape slides
    // toward the ball, the carrier is on it, the nearest defender presses.
    function computeTargets(step: Step, prevBall: P) {
      const e = step.e;
      const possSide = e.teamId === home.id ? "home" : "away";
      const bx = step.ball.x;
      const by = step.ball.y;

      let pressId: string | null = null;
      let pressDist = Infinity;
      spots.forEach((s, id) => {
        if (s.side !== possSide) {
          const d = (s.x - bx) ** 2 + (s.y - by) ** 2;
          if (d < pressDist) {
            pressDist = d;
            pressId = id;
          }
        }
      });

      spots.forEach((s, id) => {
        const isPoss = s.side === possSide;
        const tgt = targets.get(id)!;
        tgt.x = isPoss ? s.x * 0.55 + bx * 0.45 : s.x * 0.64 + bx * 0.36;
        tgt.y = s.y * 0.76 + by * 0.24;
      });
      if (step.actorId) {
        const at =
          e.type === "shot" || e.type === "goal" ? prevBall : { x: bx, y: by };
        const tg = targets.get(step.actorId);
        if (tg) {
          tg.x = at.x;
          tg.y = at.y;
        }
      }
      if (pressId && e.type !== "goal") {
        const tg = targets.get(pressId)!;
        tg.x = bx * 0.8 + tg.x * 0.2;
        tg.y = by;
      }
      targets.forEach((v) => {
        v.x = Math.max(3, Math.min(97, v.x));
        v.y = Math.max(4, Math.min(60, v.y));
      });
    }
    computeTargets(steps[0], { x: 50, y: 32 });

    function drawPitch() {
      // grass + mowing stripes
      ctx.fillStyle = "#2f7a37";
      ctx.fillRect(0, 0, W, H);
      const stripes = 9;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#2f7a37" : "#2b7033";
        const x0 = M + (i / stripes) * (W - 2 * M);
        ctx.fillRect(x0, M, (W - 2 * M) / stripes + 1, H - 2 * M);
      }
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(M, M, W - 2 * M, H - 2 * M);
      // halfway + circle
      ctx.beginPath();
      ctx.moveTo(tx(50), ty(0));
      ctx.lineTo(tx(50), ty(64));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx(50), ty(32), 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.fillRect(tx(50) - 1, ty(32) - 1, 2, 2);
      // penalty boxes + goals
      const box = (left: boolean) => {
        const bx = left ? M : W - M - 52;
        ctx.strokeRect(bx, ty(18), 52, ty(46) - ty(18));
        const sx = left ? M : W - M - 22;
        ctx.strokeRect(sx, ty(26), 22, ty(38) - ty(26));
        const gx = left ? M - 4 : W - M;
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.fillRect(gx, ty(28), 4, ty(36) - ty(28));
      };
      box(true);
      box(false);
    }

    // A tiny pixel footballer drawn at ground point (x,y).
    function drawSprite(
      x: number,
      y: number,
      kit: string,
      number: number,
      active: boolean,
    ) {
      const r = (a: number, b: number, w: number, h: number, c: string) => {
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x + a), Math.round(y + b), w, h);
      };
      // shadow
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
      r(-2, -3, 1.6, 4, "#fff"); // left sock/leg
      r(0.6, -3, 1.6, 4, "#fff"); // right sock/leg
      r(-2.4, -5, 5, 3, "#e9eef5"); // shorts
      r(-2.6, -9, 5.2, 5, kit); // jersey
      r(-3.6, -8.5, 1.2, 3.6, kit); // left arm
      r(2.4, -8.5, 1.2, 3.6, kit); // right arm
      // head
      ctx.fillStyle = "#e8b88f";
      ctx.beginPath();
      ctx.arc(x, y - 10.5, 1.9, 0, Math.PI * 2);
      ctx.fill();
      // number tag
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.font = "5px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(number), x, y - 12.5);
    }

    function drawPlayers(actorId?: string) {
      // draw far players first for a touch of depth (sort by live y)
      const ordered = Array.from(live.entries()).sort(
        (a, b) => a[1].y - b[1].y,
      );
      for (const [id, p] of ordered) {
        const s = spots.get(id)!;
        drawSprite(
          tx(p.x),
          ty(p.y),
          s.side === "away" ? away.color : home.color,
          s.number,
          id === actorId,
        );
      }
    }

    function drawBall(p: { x: number; y: number }) {
      const x = tx(p.x);
      const y = ty(p.y);
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#111";
      ctx.stroke();
    }

    function frame(ts: number) {
      if (stopped) return;
      if (!last) last = ts;
      const cur = steps[idx];
      const prevBall = idx > 0 ? steps[idx - 1].ball : { x: 50, y: 32 };
      t += (ts - last) / cur.dur;
      last = ts;

      if (t >= 1) {
        t = 0;
        idx++;
        if (idx >= steps.length) {
          stopped = true;
          setDone(true);
          return;
        }
        const ne = steps[idx].e;
        computeTargets(steps[idx], steps[idx - 1].ball);
        setHud({
          minute: ne.minute,
          h: ne.homeGoals,
          a: ne.awayGoals,
          text: ne.text,
          intent: ne.intent ?? "",
          type: ne.type,
          goalFlash: ne.type === "goal",
        });
      }

      // ease every player toward their target (with a max stride)
      const maxStride = 1.1;
      live.forEach((p, id) => {
        const tg = targets.get(id)!;
        let dx = (tg.x - p.x) * 0.12;
        let dy = (tg.y - p.y) * 0.12;
        const mag = Math.hypot(dx, dy);
        if (mag > maxStride) {
          dx = (dx / mag) * maxStride;
          dy = (dy / mag) * maxStride;
        }
        p.x += dx;
        p.y += dy;
      });

      const k = ease(Math.min(1, t));
      const ball = {
        x: prevBall.x + (cur.ball.x - prevBall.x) * k,
        y: prevBall.y + (cur.ball.y - prevBall.y) * k,
      };

      drawPitch();
      if (cur.e.type === "goal" && Math.floor(ts / 120) % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.fillRect(0, 0, W, H);
      }
      drawPlayers(cur.actorId);
      drawBall(ball);

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [steps, spots, home.id, home.color, away.color, nonce]);

  return (
    <div className="pv-backdrop" onClick={onClose}>
      <div className="pv-card" onClick={(e) => e.stopPropagation()}>
        <button className="pv-close" onClick={onClose}>
          ✕
        </button>

        <div className="pv-hud">
          <span className="pv-team">
            {home.flag} {home.code}
          </span>
          <span className="pv-score">
            {hud.h}-{hud.a}
          </span>
          <span className="pv-team">
            {away.code} {away.flag}
          </span>
          <span className="pv-clock">{hud.minute}&apos;</span>
        </div>

        <div className={`pv-stage ${hud.goalFlash ? "goal" : ""}`}>
          <canvas ref={canvasRef} width={W} height={H} className="pv-canvas" />
          <div className="pv-scanlines" />
          <div className="pv-watermark">MiroFish FC &apos;98</div>
          {hud.type === "goal" && <div className="pv-goal">GOAL!!!</div>}
          {done && (
            <div className="pv-done">
              <div className="pv-final">
                FULL TIME — {home.code} {match.homeGoals}-{match.awayGoals}{" "}
                {away.code}
                {match.decided === "pens" ? " (pens)" : ""}
              </div>
              <button className="pv-replay" onClick={() => setNonce((n) => n + 1)}>
                ▶ Replay
              </button>
            </div>
          )}
        </div>

        <div className="pv-ticker">
          <span className="pv-evt">{hud.text}</span>
          {hud.intent && <span className="pv-intent">💭 {hud.intent}</span>}
        </div>
        <div className="pv-foot">
          {match.agentCalls} agent decisions · every move chosen by a player agent
        </div>
      </div>
    </div>
  );
}

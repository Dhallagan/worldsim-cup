"use client";

import { useState } from "react";
import Pitch, { type PitchState } from "./Pitch";
import { getTeam } from "@/lib/teams";
import type { AgentMatch } from "@/lib/types";

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
}

export default function BroadcastHero({
  match,
  titlePct,
  stage = "Quarterfinal",
  onExpand,
}: {
  match: AgentMatch;
  titlePct?: number | null;
  stage?: string;
  onExpand?: () => void;
}) {
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  const [s, setS] = useState<PitchState>({
    minute: 0,
    h: 0,
    a: 0,
    text: "Kick-off",
    intent: "",
    type: "kickoff",
    done: false,
  });

  return (
    <div className="bcast">
      <div className="bcast-frame">
        <Pitch match={match} loop onState={setS} />

        {/* scoreboard bug */}
        <div className="bcast-bug">
          <div className="bug-comp">FIFA WORLD CUP · {stage}</div>
          <div className="bug-row">
            <span className="bug-team" style={{ background: home.color }}>
              {home.flag} {home.code}
            </span>
            <span className="bug-num">
              {s.h}-{s.a}
            </span>
            <span className="bug-team" style={{ background: away.color }}>
              {away.code} {away.flag}
            </span>
            <span className="bug-clock">{s.minute}&apos;</span>
          </div>
        </div>

        <div className="bcast-live">
          <span className="bcast-live-dot" /> LIVE · AGENT SIM
        </div>

        {onExpand && (
          <button className="bcast-expand" onClick={onExpand} title="Fullscreen">
            ⛶
          </button>
        )}

        {/* the probability problem */}
        <div className="bcast-odds">
          <span className="bo-label">USA Title Odds</span>
          <span className="bo-val">{titlePct != null ? fmtPct(titlePct) : "—"}</span>
          <span className="bo-sub">can they win it all?</span>
        </div>

        {/* lower third */}
        <div className="bcast-lower">
          <span className="bl-dot" />
          <span className="bl-text">{s.text}</span>
          {s.intent && <span className="bl-intent">💭 {s.intent}</span>}
        </div>
      </div>

      <div className="bcast-caption">
        ▸ MiroFish agent match — every move decided by a player agent ·{" "}
        {match.agentCalls} decisions
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { getTeam } from "@/lib/teams";
import type { AgentEventType, AgentMatch } from "@/lib/types";

const ICONS: Record<AgentEventType, string> = {
  kickoff: "🟢",
  pass: "➡️",
  dribble: "⚡",
  tackle: "🛑",
  interception: "✋",
  cross: "↗️",
  clear: "🦶",
  shot: "🎯",
  save: "🧤",
  goal: "⚽",
  card: "🟨",
  fulltime: "⏱️",
};

const FINAL_MIN = 90;

export default function AgentMatchReplay({
  match,
  onClose,
}: {
  match: AgentMatch;
  onClose: () => void;
}) {
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  const [clock, setClock] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClock(0);
    const id = setInterval(() => {
      setClock((c) => {
        if (c >= FINAL_MIN) {
          clearInterval(id);
          return FINAL_MIN;
        }
        return c + 1;
      });
    }, 120);
    return () => clearInterval(id);
  }, [match]);

  const live = clock < FINAL_MIN;
  const shown = match.events.filter(
    (e) => e.minute <= clock && e.type !== "fulltime",
  );
  const homeScore = shown.filter(
    (e) => e.type === "goal" && e.teamId === home.id,
  ).length;
  const awayScore = shown.filter(
    (e) => e.type === "goal" && e.teamId === away.id,
  ).length;

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [shown.length]);

  return (
    <div className="am-backdrop" onClick={onClose}>
      <div className="am-card" onClick={(e) => e.stopPropagation()}>
        <button className="am-close" onClick={onClose}>
          ✕
        </button>
        <div className="am-badge">
          <span className="pdot-am" /> MiroFish · agents playing it out
        </div>

        <div className="am-scoreboard">
          <div className="am-team">
            <span className="am-flag">{home.flag}</span>
            <span className="am-code">{home.code}</span>
          </div>
          <div className="am-score">
            <span className="am-goals">
              {homeScore}<span className="am-dash">–</span>{awayScore}
            </span>
            <span className={`am-status ${live ? "live" : "ft"}`}>
              {live
                ? `${clock}'`
                : match.decided === "pens"
                  ? "FT · pens"
                  : "FT"}
            </span>
          </div>
          <div className="am-team">
            <span className="am-flag">{away.flag}</span>
            <span className="am-code">{away.code}</span>
          </div>
        </div>

        <div className="am-feed" ref={feedRef}>
          {shown.map((e, i) => (
            <div key={i} className={`am-event ${e.type}`}>
              <span className="am-min">{e.minute}&apos;</span>
              <span className="am-icon">{ICONS[e.type]}</span>
              <div className="am-body">
                <div className="am-text">{e.text}</div>
                {e.intent && (
                  <div className="am-intent">💭 “{e.intent}”</div>
                )}
              </div>
            </div>
          ))}
          {live && <div className="am-cursor">▍ agents deciding…</div>}
        </div>

        {!live && (
          <div className={`am-result ${match.usaWon ? "win" : "loss"}`}>
            {match.usaWon
              ? `${home.code} advance ✅`
              : `${away.code} go through — ${match.agentCalls} agent decisions played this match`}
          </div>
        )}
      </div>
    </div>
  );
}

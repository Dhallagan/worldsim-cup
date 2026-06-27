"use client";

import { useEffect, useState } from "react";
import { getTeam } from "@/lib/teams";
import type { MatchEvent, MatchResult } from "@/lib/types";

const ICONS: Record<MatchEvent["type"], string> = {
  goal: "⚽",
  chance: "🎯",
  save: "🧤",
  card: "🟨",
  sub: "🔁",
  kickoff: "🟢",
  fulltime: "⏱️",
};

const FINAL_MIN = 90;

export default function LiveMatch({
  result,
  onClose,
  onNext,
  hasNext = false,
  matchLabel,
}: {
  result: MatchResult;
  onClose: () => void;
  onNext?: () => void;
  hasNext?: boolean;
  matchLabel?: string;
}) {
  const home = getTeam(result.homeId);
  const away = getTeam(result.awayId);
  const [clock, setClock] = useState(0);

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
    }, 70);
    return () => clearInterval(id);
  }, [result]);

  const live = clock < FINAL_MIN;
  const shown = result.events.filter(
    (e) => e.minute <= clock && e.type !== "fulltime",
  );
  const goalsBy = (teamId: string) =>
    result.events.filter(
      (e) => e.type === "goal" && e.teamId === teamId && e.minute <= clock,
    ).length;
  const homeScore = goalsBy(home.id);
  const awayScore = goalsBy(away.id);

  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-card" onClick={(e) => e.stopPropagation()}>
        <button className="lm-close" onClick={onClose}>
          ✕
        </button>

        {matchLabel && <div className="lm-tour">{matchLabel}</div>}

        <div className="lm-scoreboard">
          <div className="lm-team">
            <span className="lm-flag">{home.flag}</span>
            <span className="lm-code">{home.code}</span>
          </div>
          <div className="lm-score">
            <span className="lm-goals">
              {homeScore}
              <span className="lm-dash">–</span>
              {awayScore}
            </span>
            <span className={`lm-status ${live ? "live" : "ft"}`}>
              {live ? (
                <>
                  <span className="lm-dot" /> {clock}&apos;
                </>
              ) : result.decided === "pens" ? (
                "FT · pens"
              ) : (
                "FT"
              )}
            </span>
          </div>
          <div className="lm-team">
            <span className="lm-flag">{away.flag}</span>
            <span className="lm-code">{away.code}</span>
          </div>
        </div>

        <div className="lm-feed">
          {[...shown].reverse().map((e, i) => (
            <div key={i} className={`lm-event ${e.type}`}>
              <span className="lm-min">{e.minute}&apos;</span>
              <span className="lm-icon">{ICONS[e.type]}</span>
              <span className="lm-text">{e.text}</span>
            </div>
          ))}
        </div>

        {!live && (
          <div className={`lm-result ${result.usaWon ? "win" : "loss"}`}>
            <span>
              {result.usaWon
                ? `${home.code} advance ✅`
                : `${away.code} go through ❌`}
            </span>
            {onNext && (
              <button className="lm-next" onClick={onNext}>
                {hasNext ? "Next match →" : "Finish ✦"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

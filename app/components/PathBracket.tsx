"use client";

import { PATH, USA, getTeam } from "@/lib/teams";
import type { MatchResult, OddsReport } from "@/lib/types";

function pct(n: number): string {
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
}

export default function PathBracket({
  odds,
  results,
  compact,
  onSelect,
}: {
  odds?: OddsReport | null;
  results?: MatchResult[] | null;
  compact?: boolean;
  onSelect?: (round: string) => void;
}) {
  const oddsByRound = new Map((odds?.rounds ?? []).map((r) => [r.round, r]));
  const resultByRound = new Map((results ?? []).map((r) => [r.round, r]));

  return (
    <div className="path">
      <div className="path-cap">
        <span className="flag">{USA.flag}</span>
        <span className="cap-code">{USA.code}</span>
        <span className="cap-label">Our run</span>
      </div>

      {PATH.map((step) => {
        const opp = getTeam(step.opponentId);
        const ro = oddsByRound.get(step.round);
        const res = resultByRound.get(step.round);
        const scoreline = res
          ? `${res.homeGoals}–${res.awayGoals}`
          : null;

        return (
          <div
            key={step.round}
            className="node usa-edge"
            onClick={() => onSelect?.(step.round)}
          >
            {scoreline && (
              <span
                className={`score-pill ${res!.usaWon ? "win" : "loss"}`}
              >
                {scoreline}
              </span>
            )}
            <span className="node-round">
              {compact ? step.short : step.label}
            </span>
            <div className="node-opp">
              <span className="flag">{opp.flag}</span>
              <div>
                <div className="opp-name">
                  {compact ? opp.code : opp.name}
                </div>
                <div className="opp-rank">FIFA #{opp.rank}</div>
              </div>
            </div>
            <div className="node-foot">
              <span className="odds-label">USA win</span>
              <span className={`odds-val ${ro ? "" : "pending"}`}>
                {ro ? pct(ro.winPct) : "—"}
              </span>
            </div>
            {ro && (
              <div className="survival">
                <div className="survival-track">
                  <div
                    className="survival-fill"
                    style={{ width: `${Math.max(2, ro.cumulativePct * 100)}%` }}
                  />
                </div>
                <span className="survival-label">
                  {pct(ro.cumulativePct)} still alive
                </span>
              </div>
            )}
          </div>
        );
      })}

      <div className="path-cap trophy">
        <span className="flag">🏆</span>
        <span className="cap-code">{odds ? pct(odds.titlePct) : "—"}</span>
        <span className="cap-label">Title odds</span>
      </div>
    </div>
  );
}

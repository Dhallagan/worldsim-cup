"use client";

import { useEffect, useRef, useState } from "react";
import PathBracket from "./PathBracket";
import PlayersTab from "./PlayersTab";
import LiveMatch from "./LiveMatch";
import AgentConsole, { type Line, toLine } from "./AgentConsole";
import { PATH, getTeam } from "@/lib/teams";
import type {
  AgentEvent,
  MatchResult,
  OddsReport,
  Persona,
  Playthrough,
} from "@/lib/types";

const TABS = ["Matches", "Players"] as const;
type Tab = (typeof TABS)[number];

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
}

export default function Dashboard({ userEmail }: { userEmail?: string | null }) {
  const [tab, setTab] = useState<Tab>("Matches");
  const [run, setRun] = useState<Playthrough | null>(null);
  const [odds, setOdds] = useState<OddsReport | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [report, setReport] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [stage, setStage] = useState("");
  const [liveMatch, setLiveMatch] = useState<MatchResult | null>(null);

  // When true, the featured run auto-opens the match sim and plays the whole
  // gauntlet. A ref (read inside the async stream) avoids stale closures.
  const autoTourRef = useRef(false);

  // Quick deterministic odds on mount so the page is never empty.
  useEffect(() => {
    fetch("/api/odds")
      .then((r) => r.json())
      .then((d: OddsReport) => setOdds((cur) => cur ?? d))
      .catch(() => {});
  }, []);

  // Once the swarm produces the featured run, take the user straight to the
  // match sim — open the first match; LiveMatch auto-advances through the rest.
  useEffect(() => {
    if (autoTourRef.current && run?.results.length) {
      setLiveMatch(run.results[0]);
    }
  }, [run]);

  const liveIdx =
    run && liveMatch
      ? run.results.findIndex((x) => x.round === liveMatch.round)
      : -1;
  const hasNextMatch = liveIdx >= 0 && liveIdx < (run?.results.length ?? 0) - 1;

  function closeMatch() {
    autoTourRef.current = false;
    setLiveMatch(null);
  }

  function nextMatch() {
    if (run && hasNextMatch) setLiveMatch(run.results[liveIdx + 1]);
    else closeMatch();
  }

  async function runSwarm() {
    autoTourRef.current = true;
    setRunning(true);
    setConsoleOpen(true);
    setLines([]);
    setStage("");
    setReport(null);
    setRun(null);
    setLiveMatch(null);

    try {
      const res = await fetch("/api/agent", { method: "POST" });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.trim()) continue;
          const e = JSON.parse(part) as AgentEvent;
          dispatch(e);
        }
      }
    } catch {
      setLines((l) => [
        ...l,
        { kind: "reason", text: "Stream interrupted — showing cached results." },
      ]);
    } finally {
      setRunning(false);
    }
  }

  function dispatch(e: AgentEvent) {
    if (e.t === "stage") setStage(e.stage);
    if (e.t === "odds") setOdds(e.report);
    if (e.t === "play") setRun(e.run);
    if (e.t === "personas") setPersonas(e.personas);
    if (e.t === "report") setReport(e.text);
    const line = toLine(e);
    if (line) setLines((l) => [...l, line]);
  }

  return (
    <>
      <header className="appbar">
        <div className="brand">
          <span className="brand-mark">⚽</span>
          WorldSim Cup
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab ${t === tab ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="appbar-right">
          <a className="ghost-btn" href="/deck.html">
            Pitch deck ↗
          </a>
          <button
            className="ghost-btn"
            onClick={() => setConsoleOpen((o) => !o)}
          >
            {consoleOpen ? "Hide agent" : "Show agent"}
          </button>
          {userEmail ? (
            <span className="user-chip">
              <span className="user-avatar">{userEmail[0]?.toUpperCase()}</span>
              {userEmail}
            </span>
          ) : (
            <span className="user-chip">Guest</span>
          )}
        </div>
      </header>

      <main className={`page ${consoleOpen ? "with-console" : ""}`}>
        <section className="hero">
          <div>
            <p className="hero-kicker">FIFA World Cup · Knockout Gauntlet</p>
            <h1>USA&apos;s Road to the Cup</h1>
            <p className="hero-sub">
              Five wins from glory — Bosnia, Belgium, Spain, France, then
              Argentina. A MiroFish swarm of player agents simulates the run to
              find out: can the USA actually win it all?
            </p>
            <button className="cta" onClick={runSwarm} disabled={running}>
              {running
                ? "Swarm running…"
                : run
                  ? "↻ Re-run the swarm"
                  : "▶ Run the swarm"}
            </button>
          </div>
          <div className="hero-odds">
            <div className="label">USA Title Odds</div>
            <div className={`value ${odds ? "" : "pending"}`}>
              {odds ? fmtPct(odds.titlePct) : "—%"}
            </div>
            {odds && (
              <div className="hero-odds-sub">
                from {odds.runs.toLocaleString()} simulations / round
              </div>
            )}
          </div>
        </section>

        {report && (
          <div className="verdict">
            <span className="verdict-tag">Swarm Verdict</span>
            {report}
          </div>
        )}

        {run?.champion && (
          <div className="champion-banner">
            🏆 <strong>USA are World Champions</strong> in the featured run —
            they ran the gauntlet and lifted the cup.
          </div>
        )}
        {run && !run.champion && run.eliminatedAt && (
          <div className="champion-banner out">
            ❌ Featured run: USA knocked out in the{" "}
            <strong>
              {PATH.find((p) => p.round === run.eliminatedAt)?.label}
            </strong>{" "}
            by{" "}
            {getTeam(PATH.find((p) => p.round === run.eliminatedAt)!.opponentId)
              .name}
            .
          </div>
        )}

        {tab === "Matches" && (
          <PathBracket
            odds={odds}
            results={run?.results ?? null}
            compact={consoleOpen}
            onSelect={(round) => {
              const r = run?.results.find((x) => x.round === round);
              if (r) {
                autoTourRef.current = false;
                setLiveMatch(r);
              }
            }}
          />
        )}
        {tab === "Matches" && run && (
          <p className="hint-line">
            Tip: click any match to replay it live with commentary.
          </p>
        )}
        {tab === "Players" && <PlayersTab personas={personas} />}
      </main>

      {liveMatch && (
        <LiveMatch
          result={liveMatch}
          onClose={closeMatch}
          // Tour controls are passed ONLY during a swarm auto-tour. A manual
          // bracket click gets none of these, so it behaves exactly as before.
          {...(autoTourRef.current
            ? {
                hasNext: hasNextMatch,
                onNext: nextMatch,
                matchLabel:
                  liveIdx >= 0
                    ? `Match ${liveIdx + 1} of ${run?.results.length} · the gauntlet`
                    : undefined,
              }
            : {})}
        />
      )}

      <AgentConsole
        open={consoleOpen}
        running={running}
        lines={lines}
        currentStage={stage}
        onClose={() => setConsoleOpen(false)}
      />
    </>
  );
}

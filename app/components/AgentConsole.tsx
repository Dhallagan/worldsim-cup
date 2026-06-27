"use client";

import { useEffect, useRef } from "react";
import type { AgentEvent } from "@/lib/types";

const STAGES = [
  { key: "graph", label: "Graph Building" },
  { key: "env", label: "Environment Setup" },
  { key: "sim", label: "Simulation Execution" },
  { key: "report", label: "Report Generation" },
  { key: "done", label: "Complete" },
];

type Line =
  | { kind: "stage"; stage: string; label: string }
  | { kind: "reason"; text: string }
  | { kind: "tool"; name: string; status: string; detail: string }
  | { kind: "report"; text: string };

export default function AgentConsole({
  open,
  running,
  lines,
  currentStage,
  onClose,
}: {
  open: boolean;
  running: boolean;
  lines: Line[];
  currentStage: string;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  if (!open) return null;
  const stageIdx = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <aside className="console">
      <div className="console-head">
        <div className="console-title">
          <span className={`dot ${running ? "live" : ""}`} />
          MiroFish Swarm Agent
        </div>
        <button className="console-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <ol className="stage-rail">
        {STAGES.map((s, i) => (
          <li
            key={s.key}
            className={`stage-step ${
              i < stageIdx || currentStage === "done"
                ? "done"
                : i === stageIdx
                  ? "active"
                  : ""
            }`}
          >
            <span className="stage-num">{i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>

      <div className="console-log" ref={scrollRef}>
        {lines.map((l, i) => {
          if (l.kind === "stage") {
            return (
              <div key={i} className="log-stage">
                ▸ {l.label}
              </div>
            );
          }
          if (l.kind === "tool") {
            return (
              <div key={i} className={`log-tool ${l.status}`}>
                <span className="tool-name">{l.name}</span>
                <span className="tool-detail">
                  {l.status === "call" ? "…" : "✓"} {l.detail}
                </span>
              </div>
            );
          }
          if (l.kind === "report") {
            return (
              <div key={i} className="log-report">
                📋 {l.text}
              </div>
            );
          }
          return (
            <div key={i} className="log-reason">
              {l.text}
            </div>
          );
        })}
        {running && <div className="log-cursor">▍</div>}
      </div>
    </aside>
  );
}

export type { Line };

/** Convert a raw stream event into a console line (or null if it's data-only). */
export function toLine(e: AgentEvent): Line | null {
  switch (e.t) {
    case "stage":
      return { kind: "stage", stage: e.stage, label: e.label };
    case "reason":
      return { kind: "reason", text: e.text };
    case "tool":
      return { kind: "tool", name: e.name, status: e.status, detail: e.detail };
    case "report":
      return { kind: "report", text: e.text };
    default:
      return null;
  }
}

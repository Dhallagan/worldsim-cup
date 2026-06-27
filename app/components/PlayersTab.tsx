"use client";

import type { Persona } from "@/lib/types";

export default function PlayersTab({ personas }: { personas: Persona[] }) {
  if (personas.length === 0) {
    return (
      <div className="empty-hint">
        Run the swarm to bring the player agents to life — each gets a persona
        seeded from their real attributes.
      </div>
    );
  }

  const sorted = [...personas].sort((a, b) => {
    if (a.teamId === "usa" && b.teamId !== "usa") return -1;
    if (b.teamId === "usa" && a.teamId !== "usa") return 1;
    return b.overall - a.overall;
  });

  return (
    <div className="players-grid">
      {sorted.map((p) => (
        <div
          key={p.id}
          className={`player-card ${p.teamId === "usa" ? "usa" : ""}`}
        >
          <div className="player-top">
            <span className="player-flag">{p.flag}</span>
            <span className="player-ovr">{p.overall}</span>
          </div>
          <div className="player-name">{p.name}</div>
          <div className="player-meta">
            {p.pos} · {p.team}
          </div>
          <div className="player-tagline">{p.tagline}</div>
          <p className="player-personality">{p.personality}</p>
          <div className="player-quote">“{p.trashTalk}”</div>
        </div>
      ))}
    </div>
  );
}

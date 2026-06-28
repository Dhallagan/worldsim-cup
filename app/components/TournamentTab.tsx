"use client";

import { getTeam } from "@/lib/teams";
import type {
  TournamentMatch,
  TournamentRun,
  TournamentStanding,
} from "@/lib/types";

function teamLabel(teamId: string) {
  const team = getTeam(teamId);
  return `${team.flag} ${team.name}`;
}

function scoreline(match: TournamentMatch) {
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  return `${home.code} ${match.homeGoals}-${match.awayGoals} ${away.code}${
    match.decided === "pens" ? "p" : ""
  }`;
}

function StandingTable({
  title,
  rows,
}: {
  title: string;
  rows: TournamentStanding[];
}) {
  return (
    <section className="t-panel">
      <div className="t-panel-head">
        <h2>{title}</h2>
        <span>Top 2 advance</span>
      </div>
      <table className="standings">
        <thead>
          <tr>
            <th>Team</th>
            <th>Pts</th>
            <th>GD</th>
            <th>GF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId}>
              <td>{teamLabel(row.teamId)}</td>
              <td>{row.points}</td>
              <td>{row.goalsFor - row.goalsAgainst}</td>
              <td>{row.goalsFor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MatchCard({
  match,
  onSelect,
}: {
  match: TournamentMatch;
  onSelect: (match: TournamentMatch) => void;
}) {
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  const winner = match.winnerId ? getTeam(match.winnerId) : null;

  return (
    <button className="fixture-card" onClick={() => onSelect(match)}>
      <span className="fixture-stage">
        {match.group ? `Group ${match.group}` : match.stage}
      </span>
      <strong>{scoreline(match)}</strong>
      <span className="fixture-teams">
        {home.flag} {home.name} vs {away.flag} {away.name}
      </span>
      {winner && <span className="fixture-winner">Winner: {winner.code}</span>}
    </button>
  );
}

export default function TournamentTab({
  tournament,
  onSelectMatch,
}: {
  tournament: TournamentRun | null;
  onSelectMatch: (match: TournamentMatch) => void;
}) {
  if (!tournament) {
    return <div className="empty-hint">Building the full MiroFish tournament...</div>;
  }

  const champion = getTeam(tournament.championId);
  const groupMatches = tournament.matches.filter((match) => match.stage === "Group");

  return (
    <div className="tournament">
      <section className="t-hero">
        <div>
          <p className="hero-kicker">Full MiroFish tournament</p>
          <h1>{champion.flag} {champion.name} lift the {tournament.name}</h1>
          <p className="hero-sub">
            Six squads, two groups, semifinals, a final, agent-readable match events,
            player ratings, persistent schema hooks, and replayable broadcasts.
          </p>
        </div>
        <button className="cta" onClick={() => onSelectMatch(tournament.final)}>
          ▶ Replay final
        </button>
      </section>

      <div className="t-grid two">
        <StandingTable title="Group A" rows={tournament.standings.A} />
        <StandingTable title="Group B" rows={tournament.standings.B} />
      </div>

      <div className="t-grid split">
        <section className="t-panel">
          <div className="t-panel-head">
            <h2>Fixtures</h2>
            <span>{tournament.matches.length} matches</span>
          </div>
          <div className="fixture-list">
            {groupMatches.map((match) => (
              <MatchCard key={match.id} match={match} onSelect={onSelectMatch} />
            ))}
          </div>
        </section>

        <section className="t-panel">
          <div className="t-panel-head">
            <h2>Knockout</h2>
            <span>Semis + final</span>
          </div>
          <div className="fixture-list">
            {tournament.semifinals.map((match) => (
              <MatchCard key={match.id} match={match} onSelect={onSelectMatch} />
            ))}
            <MatchCard match={tournament.final} onSelect={onSelectMatch} />
          </div>
        </section>
      </div>

      <section className="t-panel">
        <div className="t-panel-head">
          <h2>Golden Boot</h2>
          <span>from generated event logs</span>
        </div>
        <div className="scorer-list">
          {tournament.topScorers.map((scorer) => {
            const team = getTeam(scorer.teamId);
            return (
              <div key={`${scorer.teamId}-${scorer.player}`}>
                <span>{team.flag} {scorer.player}</span>
                <strong>{scorer.goals}</strong>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

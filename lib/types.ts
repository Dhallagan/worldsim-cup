export interface Player {
  id: string;
  name: string;
  pos: string;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  persona?: string;
}

export interface TeamRating {
  attack: number;
  midfield: number;
  defense: number;
  overall: number;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  flag: string;
  color: string;
  rank: number;
  rating: TeamRating;
  players: Player[];
}

export type RoundId = "r32" | "r16" | "qf" | "sf" | "final";

export interface PathRound {
  round: RoundId;
  label: string;
  short: string;
  opponentId: string;
}

/** A single simulated match event (Slice 2). */
export interface MatchEvent {
  minute: number;
  type: "goal" | "chance" | "card" | "save" | "sub" | "kickoff" | "fulltime";
  teamId: string;
  player?: string;
  text: string;
}

/** Result of one simulated match (Slice 2). */
export interface MatchResult {
  round: RoundId;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  usaWon: boolean;
  decided: "reg" | "pens";
  events: MatchEvent[];
}

/** A full run through USA's gauntlet (Slice 2). */
export interface Playthrough {
  seed: number;
  results: MatchResult[];
  champion: boolean;
  eliminatedAt: RoundId | null;
}

/** A player agent's generated persona (Slice 4). */
export interface Persona {
  id: string;
  name: string;
  team: string;
  teamId: string;
  flag: string;
  pos: string;
  overall: number;
  tagline: string;
  personality: string;
  trashTalk: string;
}

/** NDJSON events streamed by the orchestrator agent (Slice 4). */
export type AgentEvent =
  | { t: "stage"; stage: string; label: string }
  | { t: "reason"; text: string }
  | { t: "tool"; name: string; status: "call" | "result"; detail: string }
  | { t: "odds"; report: OddsReport }
  | { t: "play"; run: Playthrough }
  | { t: "personas"; personas: Persona[] }
  | { t: "report"; text: string };

/** Per-round + cumulative odds (Slice 3). */
export interface RoundOdds {
  round: RoundId;
  opponentId: string;
  winPct: number; // USA win probability this round, 0..1
  cumulativePct: number; // USA still alive through this round, 0..1
  avgScore: string; // most-likely scoreline label, e.g. "USA 1–2 ESP"
}

export interface OddsReport {
  rounds: RoundOdds[];
  titlePct: number; // cumulative probability USA wins it all, 0..1
  runs: number;
  summary?: string; // ReportAgent narration (Slice 4)
}

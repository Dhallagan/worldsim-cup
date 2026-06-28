import { generateObject } from "ai";
import { z } from "zod";
import { getFastModel, hasAI, withTimeout } from "@/lib/ai";
import { getTeam } from "@/lib/teams";
import type {
  AgentDecision,
  AgentMatch,
  AgentMatchEvent,
  PossessionAction,
  Player,
  Team,
  Zone,
} from "@/lib/types";
import { mulberry32 } from "./rng";

const MAX_POSSESSIONS = 70;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const advance = (z: Zone): Zone => (z === "def" ? "mid" : "att");

function starters(team: Team): Player[] {
  const s = team.players.filter((p) => p.starter);
  return s.length >= 7 ? s : team.players;
}
function keeper(team: Team): Player {
  return starters(team).find((p) => p.pos === "GK") ?? starters(team)[0];
}
function byId(team: Team): Map<string, Player> {
  return new Map(team.players.map((p) => [p.id, p]));
}

/** Positions that tend to operate in each third (for picking who's on the ball). */
const ZONE_FIT: Record<Zone, Record<string, number>> = {
  def: { GK: 1, CB: 5, LB: 4, RB: 4, CDM: 3, CM: 1 },
  mid: { CDM: 4, CM: 5, CAM: 4, LB: 2, RB: 2, LW: 2, RW: 2 },
  att: { ST: 5, LW: 4, RW: 4, CAM: 4, CM: 2 },
};

function weightedPlayer(
  pool: Player[],
  weights: Record<string, number>,
  rng: () => number,
  exclude?: string,
): Player {
  const cands = pool.filter((p) => p.id !== exclude && p.pos !== "GK");
  const ws = cands.map((p) => (weights[p.pos] ?? 1) + 0.3);
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < cands.length; i++) {
    r -= ws[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1] ?? pool[0];
}

const pickCarrier = (team: Team, zone: Zone, rng: () => number) =>
  weightedPlayer(starters(team), ZONE_FIT[zone], rng);
const pickDefender = (team: Team, rng: () => number) =>
  weightedPlayer(starters(team), { CB: 5, LB: 4, RB: 4, CDM: 4, CM: 2 }, rng);
const pickStriker = (team: Team, rng: () => number) =>
  weightedPlayer(starters(team), { ST: 5, LW: 3, RW: 3, CAM: 2 }, rng);

const ALLOWED: Record<Zone, PossessionAction[]> = {
  def: ["pass", "clear", "longball", "dribble"],
  mid: ["pass", "dribble", "longball"],
  att: ["shoot", "pass", "cross", "dribble"],
};

/** Heuristic decision when there's no model / a call times out. */
function heuristicDecision(
  carrier: Player,
  zone: Zone,
  mates: Player[],
  rng: () => number,
): AgentDecision {
  const target = mates[Math.floor(rng() * mates.length)];
  if (zone === "att") {
    if (carrier.shooting > 78 && rng() < 0.55)
      return { action: "shoot", intent: "I'll have a go!" };
    if (["LW", "RW", "LB", "RB"].includes(carrier.pos) && rng() < 0.5)
      return { action: "cross", intent: "Whip it in." };
    return { action: "pass", targetId: target?.id, intent: "Find the killer ball." };
  }
  if (zone === "def" && rng() < 0.2)
    return { action: "clear", intent: "Get it clear." };
  if (carrier.dribbling > 82 && rng() < 0.3)
    return { action: "dribble", intent: "Take him on." };
  return { action: "pass", targetId: target?.id, intent: "Keep it moving." };
}

async function decideAction(
  carrier: Player,
  zone: Zone,
  attackTeam: Team,
  defenderName: string,
  score: string,
  minute: number,
  rng: () => number,
): Promise<{ decision: AgentDecision; usedLLM: boolean }> {
  const mates = starters(attackTeam)
    .filter((p) => p.id !== carrier.id && p.pos !== "GK")
    .sort(() => rng() - 0.5)
    .slice(0, 5);
  const allowed = ALLOWED[zone];

  if (!hasAI()) return { decision: heuristicDecision(carrier, zone, mates, rng), usedLLM: false };

  try {
    const model = getFastModel()!;
    const { object } = await withTimeout(
      generateObject({
        model,
        schema: z.object({
          action: z.enum(allowed as [PossessionAction, ...PossessionAction[]]),
          targetId: z.string().optional(),
          intent: z.string(),
        }),
        prompt:
          `You are ${carrier.name}, a ${carrier.pos} for ${attackTeam.name}. ` +
          `Attributes — pace ${carrier.pace}, shooting ${carrier.shooting}, passing ${carrier.passing}, dribbling ${carrier.dribbling}. ` +
          `You have the ball in the ${zone === "att" ? "attacking" : zone === "mid" ? "middle" : "defensive"} third. ` +
          `Minute ${minute}, score ${score}. ${defenderName} is closing you down.\n` +
          `Teammates you can pass to: ${mates.map((m) => `${m.name} (${m.pos}, id=${m.id})`).join(", ")}.\n` +
          `Choose ONE action from [${allowed.join(", ")}] that fits your position, attributes, and the situation. ` +
          `If passing, set targetId to a teammate id. Give a punchy first-person intent (max 8 words).`,
      }),
      8000,
    );
    return {
      decision: {
        action: object.action,
        targetId: object.targetId,
        intent: object.intent?.slice(0, 60) || "…",
      },
      usedLLM: true,
    };
  } catch {
    return { decision: heuristicDecision(carrier, zone, mates, rng), usedLLM: false };
  }
}

type DefStance = "press" | "contain" | "intercept" | "foul";
const DEF_STANCES: DefStance[] = ["press", "contain", "intercept", "foul"];

function heuristicDefense(
  action: PossessionAction,
  defender: Player,
  rng: () => number,
): { stance: DefStance; intent: string } {
  if (action === "shoot" || action === "cross")
    return { stance: "contain", intent: "Block the shot!" };
  if (action === "pass")
    return rng() < 0.5
      ? { stance: "intercept", intent: "Read the pass." }
      : { stance: "contain", intent: "Hold my shape." };
  if (defender.defending > 80 && rng() < 0.6)
    return { stance: "press", intent: "Step in and win it." };
  return rng() < 0.2
    ? { stance: "foul", intent: "Take one for the team." }
    : { stance: "press", intent: "Jockey and press." };
}

/** The defending agent decides how to stop the carrier — the other side of the contest. */
async function decideDefense(
  defender: Player,
  carrier: Player,
  action: PossessionAction,
  defTeam: Team,
  zone: Zone,
  rng: () => number,
): Promise<{ decision: { stance: DefStance; intent: string }; usedLLM: boolean }> {
  if (!hasAI())
    return { decision: heuristicDefense(action, defender, rng), usedLLM: false };
  try {
    const model = getFastModel()!;
    const { object } = await withTimeout(
      generateObject({
        model,
        schema: z.object({
          stance: z.enum(DEF_STANCES as [DefStance, ...DefStance[]]),
          intent: z.string(),
        }),
        prompt:
          `You are ${defender.name}, a ${defender.pos} for ${defTeam.name} (defending ${defender.defending}, pace ${defender.pace}, physical ${defender.physical}). ` +
          `${carrier.name} has the ball in your ${zone === "att" ? "attacking" : zone === "mid" ? "middle" : "defensive"} third and is attempting a ${action}. ` +
          `Choose how to defend: press (commit to win it), contain (jockey, hold shape), intercept (read the pass), or foul (cynical stop). ` +
          `Pick what fits the danger and your attributes. Short first-person intent (max 8 words).`,
      }),
      8000,
    );
    return {
      decision: { stance: object.stance, intent: object.intent?.slice(0, 60) || "…" },
      usedLLM: true,
    };
  } catch {
    return { decision: heuristicDefense(action, defender, rng), usedLLM: false };
  }
}

interface Resolution {
  events: Omit<AgentMatchEvent, "minute" | "homeGoals" | "awayGoals">[];
  goalFor: "atk" | null;
  turnover: boolean;
  nextZone: Zone;
  nextCarrier: Player;
}

function resolve(
  decision: AgentDecision,
  carrier: Player,
  attackTeam: Team,
  defTeam: Team,
  zone: Zone,
  rng: () => number,
  defender: Player,
  defense: { stance: DefStance; intent: string },
): Resolution {
  const gk = keeper(defTeam);
  const mates = byId(attackTeam);
  const intent = decision.intent;
  const dInt = defense.intent;
  const defBonus =
    defense.stance === "press"
      ? 8
      : defense.stance === "contain"
        ? -3
        : defense.stance === "intercept"
          ? 3
          : 0;

  // Cynical foul: stops the attack but concedes a free kick (attack keeps it).
  if (
    defense.stance === "foul" &&
    (decision.action === "pass" ||
      decision.action === "dribble" ||
      decision.action === "longball" ||
      decision.action === "clear")
  ) {
    const card = rng() < 0.18;
    return {
      events: [
        {
          teamId: defTeam.id,
          zone,
          type: card ? "card" : "tackle",
          playerId: defender.id,
          player: defender.name,
          text: card
            ? `${defender.name} fouls ${carrier.name} — booked`
            : `${defender.name} fouls ${carrier.name}`,
          intent: dInt,
        },
      ],
      goalFor: null,
      turnover: false,
      nextZone: zone,
      nextCarrier: pickCarrier(attackTeam, zone, rng),
    };
  }

  const ev = (
    e: Omit<AgentMatchEvent, "minute" | "homeGoals" | "awayGoals">,
  ) => e;

  const turnoverTo = (): Resolution["nextCarrier"] => pickCarrier(defTeam, "mid", rng);

  switch (decision.action) {
    case "shoot":
    case "cross": {
      const finisher = decision.action === "cross" ? pickStriker(attackTeam, rng) : carrier;
      const penalty = decision.action === "cross" ? 10 : 6;
      const pGoal = sigmoid((finisher.shooting - gk.overall * 0.8 - penalty) / 12);
      const r = rng();
      const shotEv = ev({
        teamId: attackTeam.id,
        zone,
        type: decision.action === "cross" ? "cross" : "shot",
        playerId: finisher.id,
        player: finisher.name,
        text:
          decision.action === "cross"
            ? `${carrier.name} crosses for ${finisher.name}`
            : `${finisher.name} shoots`,
        intent,
      });
      if (r < pGoal) {
        return {
          events: [
            shotEv,
            ev({
              teamId: attackTeam.id,
              zone: "att",
              type: "goal",
              playerId: finisher.id,
              player: finisher.name,
              text: `GOAL! ${finisher.name} (${attackTeam.code}) buries it`,
            }),
          ],
          goalFor: "atk",
          turnover: true,
          nextZone: "mid",
          nextCarrier: pickCarrier(defTeam, "mid", rng),
        };
      }
      if (r < pGoal + 0.4) {
        return {
          events: [
            shotEv,
            ev({
              teamId: defTeam.id,
              zone,
              type: "save",
              playerId: gk.id,
              player: gk.name,
              text: `${gk.name} saves!`,
            }),
          ],
          goalFor: null,
          turnover: true,
          nextZone: "mid",
          nextCarrier: turnoverTo(),
        };
      }
      return {
        events: [{ ...shotEv, text: `${shotEv.text} — off target` }],
        goalFor: null,
        turnover: true,
        nextZone: "mid",
        nextCarrier: turnoverTo(),
      };
    }

    case "dribble": {
      const p = sigmoid(
        ((carrier.dribbling + carrier.pace) / 2 - (defender.defending + defBonus)) / 12 + 0.1,
      );
      if (rng() < p) {
        return {
          events: [
            ev({
              teamId: attackTeam.id,
              zone,
              type: "dribble",
              playerId: carrier.id,
              player: carrier.name,
              text: `${carrier.name} skips past ${defender.name}`,
              intent,
            }),
          ],
          goalFor: null,
          turnover: false,
          // beating a high press springs you forward; contain holds you up
          nextZone: defense.stance === "contain" ? zone : advance(zone),
          nextCarrier: carrier,
        };
      }
      return {
        events: [
          ev({
            teamId: defTeam.id,
            zone,
            type: "tackle",
            playerId: defender.id,
            player: defender.name,
            text: `${defender.name} ${defense.stance === "press" ? "steps in and robs" : "dispossesses"} ${carrier.name}`,
            intent: dInt,
          }),
        ],
        goalFor: null,
        turnover: true,
        nextZone: "mid",
        nextCarrier: defender,
      };
    }

    case "clear": {
      return {
        events: [
          ev({
            teamId: attackTeam.id,
            zone,
            type: "clear",
            playerId: carrier.id,
            player: carrier.name,
            text: `${carrier.name} clears the danger`,
            intent,
          }),
        ],
        goalFor: null,
        turnover: true,
        nextZone: "mid",
        nextCarrier: turnoverTo(),
      };
    }

    case "longball": {
      const target = pickStriker(attackTeam, rng);
      const p = sigmoid((carrier.passing - 72) / 14);
      if (rng() < p) {
        return {
          events: [
            ev({
              teamId: attackTeam.id,
              zone,
              type: "pass",
              playerId: carrier.id,
              player: carrier.name,
              targetId: target.id,
              target: target.name,
              text: `${carrier.name} launches it to ${target.name}`,
              intent,
            }),
          ],
          goalFor: null,
          turnover: false,
          nextZone: "att",
          nextCarrier: target,
        };
      }
      return {
        events: [
          ev({
            teamId: defTeam.id,
            zone,
            type: "interception",
            playerId: defender.id,
            player: defender.name,
            text: `${defender.name} reads the long ball`,
            intent: dInt,
          }),
        ],
        goalFor: null,
        turnover: true,
        nextZone: "mid",
        nextCarrier: defender,
      };
    }

    case "pass":
    default: {
      const target =
        (decision.targetId && mates.get(decision.targetId)) ||
        pickCarrier(attackTeam, advance(zone), rng);
      const p = sigmoid(
        (carrier.passing - (defender.defending + defBonus) * 0.5) / 12 + 0.5,
      );
      if (rng() < p) {
        const forward = rng() < 0.6;
        return {
          events: [
            ev({
              teamId: attackTeam.id,
              zone,
              type: "pass",
              playerId: carrier.id,
              player: carrier.name,
              targetId: target.id,
              target: target.name,
              text: `${carrier.name} finds ${target.name}`,
              intent,
            }),
          ],
          goalFor: null,
          turnover: false,
          nextZone: forward ? advance(zone) : zone,
          nextCarrier: target,
        };
      }
      return {
        events: [
          ev({
            teamId: defTeam.id,
            zone,
            type: "interception",
            playerId: defender.id,
            player: defender.name,
            text: `${defender.name} cuts out the pass`,
            intent: dInt,
          }),
        ],
        goalFor: null,
        turnover: true,
        nextZone: "mid",
        nextCarrier: turnoverTo(),
      };
    }
  }
}

/**
 * Play a full match out, possession by possession, with player agents deciding
 * each action and a resolver settling the outcome from attributes. The agents
 * decide; physics resolves. Slow (one LLM call per possession) — pre-compute it.
 */
export async function simulateAgentMatch(
  homeId: string,
  awayId: string,
  seed = 1,
): Promise<AgentMatch> {
  const home = getTeam(homeId);
  const away = getTeam(awayId);
  const rng = mulberry32(seed);

  let poss: "home" | "away" = rng() < 0.5 ? "home" : "away";
  let zone: Zone = "mid";
  let carrier = pickCarrier(poss === "home" ? home : away, "mid", rng);
  let minute = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  let calls = 0;

  const events: AgentMatchEvent[] = [
    {
      minute: 0,
      teamId: home.id,
      zone: "mid",
      type: "kickoff",
      text: `Kick-off — ${home.name} vs ${away.name}`,
      homeGoals: 0,
      awayGoals: 0,
    },
  ];

  for (let p = 0; p < MAX_POSSESSIONS && minute < 90; p++) {
    const attackTeam = poss === "home" ? home : away;
    const defTeam = poss === "home" ? away : home;
    const defender = pickDefender(defTeam, rng);

    const { decision, usedLLM } = await decideAction(
      carrier,
      zone,
      attackTeam,
      defender.name,
      `${homeGoals}-${awayGoals}`,
      minute,
      rng,
    );
    if (usedLLM) calls++;

    // The defender agent decides how to stop it — two agents per possession.
    const { decision: defDecision, usedLLM: defLLM } = await decideDefense(
      defender,
      carrier,
      decision.action,
      defTeam,
      zone,
      rng,
    );
    if (defLLM) calls++;

    const res = resolve(
      decision,
      carrier,
      attackTeam,
      defTeam,
      zone,
      rng,
      defender,
      defDecision,
    );

    if (res.goalFor === "atk") {
      if (poss === "home") homeGoals++;
      else awayGoals++;
    }

    for (const e of res.events) {
      events.push({ ...e, minute, homeGoals, awayGoals });
    }

    if (res.goalFor === "atk") {
      // conceding team kicks off
      poss = poss === "home" ? "away" : "home";
      zone = "mid";
      carrier = pickCarrier(poss === "home" ? home : away, "mid", rng);
    } else if (res.turnover) {
      poss = poss === "home" ? "away" : "home";
      zone = res.nextZone;
      carrier = res.nextCarrier;
    } else {
      zone = res.nextZone;
      carrier = res.nextCarrier;
    }

    minute += 1 + Math.floor(rng() * 4);
  }

  // Knockout: penalties break ties.
  let usaWon: boolean;
  let decided: "reg" | "pens" = "reg";
  if (homeGoals !== awayGoals) {
    usaWon = homeGoals > awayGoals ? home.id === "usa" : away.id === "usa";
  } else {
    decided = "pens";
    const homeEdge =
      (home.rating.overall + 100) / (home.rating.overall + away.rating.overall + 200);
    const homeWinsPens = rng() < homeEdge;
    usaWon = homeWinsPens ? home.id === "usa" : away.id === "usa";
    events.push({
      minute: 90,
      teamId: homeWinsPens ? home.id : away.id,
      zone: "mid",
      type: "save",
      text: `Penalty shootout — ${(homeWinsPens ? home : away).code} advance`,
      homeGoals,
      awayGoals,
    });
  }

  events.push({
    minute: 90,
    teamId: home.id,
    zone: "mid",
    type: "fulltime",
    text: `Full time: ${home.code} ${homeGoals}–${awayGoals} ${away.code}${
      decided === "pens" ? " (pens)" : ""
    }`,
    homeGoals,
    awayGoals,
  });

  return {
    homeId,
    awayId,
    homeGoals,
    awayGoals,
    usaWon,
    decided,
    events,
    agentCalls: calls,
    seed,
  };
}

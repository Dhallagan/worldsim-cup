import { generateObject } from "ai";
import { z } from "zod";
import { getFastModel, hasAI, withTimeout } from "./ai";
import { TEAMS } from "./teams";
import type { Persona, Player, Team } from "./types";

function topTrait(p: Player): string {
  const traits: [string, number][] = [
    ["pace", p.pace],
    ["finishing", p.shooting],
    ["passing", p.passing],
    ["dribbling", p.dribbling],
    ["defending", p.defending],
    ["physicality", p.physical],
  ];
  return traits.sort((a, b) => b[1] - a[1])[0][0];
}

function templatePersona(p: Player, team: Team): Persona {
  const trait = topTrait(p);
  return {
    id: p.id,
    name: p.name,
    team: team.name,
    teamId: team.id,
    flag: team.flag,
    pos: p.pos,
    overall: p.overall,
    tagline: `${team.code} ${p.pos} · elite ${trait}`,
    personality: `A ${p.overall}-rated ${p.pos} who leans on world-class ${trait}. Calm under the lights, lives for knockout football.`,
    trashTalk:
      p.overall >= 88
        ? "Win the toss, lift the trophy. Next question."
        : "We came to ruin somebody's bracket. Might as well be yours.",
  };
}

const teamSchema = z.object({
  personas: z.array(
    z.object({
      id: z.string(),
      tagline: z.string(),
      personality: z.string(),
      trashTalk: z.string(),
    }),
  ),
});

/** Generate personas for one team (fast model, time-boxed, template fallback). */
async function personasForTeam(team: Team): Promise<Persona[]> {
  const fallback = () => team.players.map((p) => templatePersona(p, team));
  if (!hasAI()) return fallback();

  try {
    const model = getFastModel()!;
    const { object } = await withTimeout(
      generateObject({
        model,
        schema: teamSchema,
        prompt:
          `You are MiroFish's Environment Setup stage. Create vivid agent personas for these ${team.name} ` +
          "World Cup players. For each: a punchy tagline (<=6 words), a 1-2 sentence personality grounded in " +
          "their attributes/position, and one line of in-character trash talk. Broadcast-friendly.\n\n" +
          JSON.stringify(
            team.players.map((p) => ({
              id: p.id,
              name: p.name,
              pos: p.pos,
              attributes: {
                overall: p.overall,
                pace: p.pace,
                shooting: p.shooting,
                passing: p.passing,
                dribbling: p.dribbling,
                defending: p.defending,
                physical: p.physical,
              },
            })),
          ),
      }),
      14000,
    );

    const byId = new Map(object.personas.map((x) => [x.id, x]));
    return team.players.map((p) => {
      const gen = byId.get(p.id);
      if (!gen) return templatePersona(p, team);
      return {
        id: p.id,
        name: p.name,
        team: team.name,
        teamId: team.id,
        flag: team.flag,
        pos: p.pos,
        overall: p.overall,
        tagline: gen.tagline,
        personality: gen.personality,
        trashTalk: gen.trashTalk,
      };
    });
  } catch {
    return fallback();
  }
}

/**
 * Generate player-agent personas across all teams. Teams run in parallel with
 * a fast model so the whole swarm comes online in a few seconds, with a
 * deterministic template fallback so the demo always populates.
 */
export async function generatePersonas(): Promise<Persona[]> {
  const perTeam = await Promise.all(TEAMS.map(personasForTeam));
  return perTeam.flat();
}

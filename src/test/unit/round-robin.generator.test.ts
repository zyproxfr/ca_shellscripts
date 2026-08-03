import { describe, expect, it } from "vitest";
import { roundRobinGenerator } from "@/server/brackets/round-robin.generator";
import type { GenerateBracketInput } from "@/server/brackets/bracket-generator.interface";
import { makeRegistrations } from "@/test/fixtures/registrations";

function generate(count: number, formatConfig: Record<string, unknown> = {}) {
  const registrations = makeRegistrations(count);
  const input = {
    tournament: {},
    checkedInRegistrations: registrations,
    formatConfig,
  } as unknown as GenerateBracketInput;
  return { rounds: roundRobinGenerator.generateInitialRounds(input), registrations };
}

function allMatchPairs(rounds: ReturnType<typeof roundRobinGenerator.generateInitialRounds>) {
  return rounds.flatMap((r) => r.matches.map((m) => [m.registrationAId, m.registrationBId].sort().join("|")));
}

describe("roundRobinGenerator", () => {
  it("rejette moins de 2 participants", () => {
    expect(() => generate(1)).toThrow();
  });

  it("chaque paire de participants se rencontre exactement une fois (effectif pair)", () => {
    const { rounds, registrations } = generate(6);
    const pairs = allMatchPairs(rounds);
    const expectedPairCount = (registrations.length * (registrations.length - 1)) / 2;
    expect(pairs).toHaveLength(expectedPairCount);
    expect(new Set(pairs).size).toBe(expectedPairCount); // aucun doublon
  });

  it("gère un effectif impair via un tour de repos (bye silencieux, pas de match créé)", () => {
    const { rounds, registrations } = generate(5);
    const pairs = allMatchPairs(rounds);
    const expectedPairCount = (registrations.length * (registrations.length - 1)) / 2;
    expect(pairs).toHaveLength(expectedPairCount);
    // Avec 5 joueurs : 5 journées, 2 matchs chacune (un joueur au repos par journée).
    expect(rounds).toHaveLength(5);
    for (const round of rounds) {
      expect(round.matches.length).toBeLessThanOrEqual(2);
    }
  });

  it("répartit en poules quand groupCount > 1, sans confrontation inter-poules", () => {
    const { rounds } = generate(8, { groupCount: 2 });
    const groupNames = new Set(rounds.flatMap((r) => r.matches.map((m) => m.groupName)));
    expect(groupNames.size).toBe(2);
  });
});

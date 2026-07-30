import { describe, expect, it } from "vitest";
import { singleEliminationGenerator } from "@/server/brackets/single-elimination.generator";
import type { GenerateBracketInput } from "@/server/brackets/bracket-generator.interface";
import { makeRegistrations } from "@/test/fixtures/registrations";

function generate(count: number) {
  const registrations = makeRegistrations(count);
  const input = {
    tournament: {},
    checkedInRegistrations: registrations,
    formatConfig: {},
  } as unknown as GenerateBracketInput;
  return { rounds: singleEliminationGenerator.generateInitialRounds(input), registrations };
}

describe("singleEliminationGenerator", () => {
  it("rejette moins de 2 participants", () => {
    expect(() => generate(1).rounds).toThrow();
  });

  it("génère un seul match pour 2 participants, sans bye", () => {
    const { rounds } = generate(2);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]!.matches).toHaveLength(1);
    expect(rounds[0]!.matches[0]!.isBye).toBeFalsy();
    expect(rounds[0]!.phase).toBe("FINAL");
  });

  it("génère un bracket complet en puissance de 2 (8 participants, 3 rounds)", () => {
    const { rounds } = generate(8);
    expect(rounds).toHaveLength(3);
    expect(rounds.map((r) => r.matches.length)).toEqual([4, 2, 1]);
    expect(rounds.every((r) => r.matches.every((m) => !m.isBye))).toBe(true);
    expect(rounds[2]!.phase).toBe("FINAL");
    expect(rounds[1]!.phase).toBe("SEMIFINAL");
    expect(rounds[0]!.phase).toBe("QUARTERFINAL");
  });

  it("gère un effectif non-puissance de 2 avec des byes résolus immédiatement", () => {
    const { rounds } = generate(5);
    // Prochaine puissance de 2 : 8. Byes = 3.
    expect(rounds).toHaveLength(3);
    expect(rounds[0]!.matches).toHaveLength(4);
    const byeMatches = rounds[0]!.matches.filter((m) => m.isBye);
    expect(byeMatches).toHaveLength(3);
    // Chaque bye a exactement un côté rempli.
    for (const m of byeMatches) {
      expect(Boolean(m.registrationAId) !== Boolean(m.registrationBId)).toBe(true);
    }
  });

  it("aucun match du round 1 n'oppose deux byes entre eux", () => {
    const { rounds } = generate(5);
    for (const match of rounds[0]!.matches) {
      expect(match.registrationAId || match.registrationBId).toBeTruthy();
    }
  });

  it("propage les vainqueurs des byes vers le round 2 sans attendre la saisie live", () => {
    const { rounds } = generate(5);
    const round2FilledSlots = rounds[1]!.matches.flatMap((m) => [m.registrationAId, m.registrationBId]).filter(Boolean);
    // Les 3 byes doivent avoir rempli 3 slots du round 2 par avance.
    expect(round2FilledSlots.length).toBeGreaterThanOrEqual(3);
  });

  it("chaque match (hors finale) référence bien un match suivant", () => {
    const { rounds } = generate(8);
    for (const round of rounds.slice(0, -1)) {
      for (const match of round.matches) {
        expect(match.feedsIntoRoundIndex).toBeDefined();
        expect(match.feedsIntoLocalIndex).toBeDefined();
        expect(match.feedsIntoSlot).toBeDefined();
      }
    }
    for (const match of rounds.at(-1)!.matches) {
      expect(match.feedsIntoRoundIndex).toBeUndefined();
    }
  });
});

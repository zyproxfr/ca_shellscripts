import { describe, expect, it } from "vitest";
import { applyCricketThrow, computeCricketLegState, type CricketTurn } from "@/server/scoring/cricket.engine";

const A = "reg-a";
const B = "reg-b";
const IDS: [string, string] = [A, B];

describe("computeCricketLegState", () => {
  it("ferme un numéro après 3 marques", () => {
    const turns: CricketTurn[] = [{ registrationId: A, cricketMarks: { "20": 3 } }];
    const state = computeCricketLegState(turns, IDS);
    expect(state[A]!.marks["20"]).toBe(3);
    expect(state[A]!.score).toBe(0); // fermé pile, pas de marque en trop
  });

  it("les marques au-delà de 3 rapportent des points si l'adversaire n'a pas fermé", () => {
    const turns: CricketTurn[] = [{ registrationId: A, cricketMarks: { "20": 5 } }];
    const state = computeCricketLegState(turns, IDS);
    expect(state[A]!.score).toBe(2 * 20); // 2 marques en trop x valeur du 20
  });

  it("aucun point si l'adversaire a déjà fermé ce numéro", () => {
    const turns: CricketTurn[] = [
      { registrationId: B, cricketMarks: { "20": 3 } },
      { registrationId: A, cricketMarks: { "20": 5 } },
    ];
    const state = computeCricketLegState(turns, IDS);
    expect(state[A]!.score).toBe(0);
  });

  it("BULL vaut 25 points", () => {
    const turns: CricketTurn[] = [{ registrationId: A, cricketMarks: { BULL: 4 } }];
    const state = computeCricketLegState(turns, IDS);
    expect(state[A]!.score).toBe(25);
  });

  it("un joueur est 'closed' seulement quand tous les numéros ont 3 marques", () => {
    const turns: CricketTurn[] = [
      { registrationId: A, cricketMarks: { "20": 3, "19": 3, "18": 3, "17": 3, "16": 3, "15": 3 } },
    ];
    expect(computeCricketLegState(turns, IDS)[A]!.closed).toBe(false);
    const turnsComplete: CricketTurn[] = [
      ...turns,
      { registrationId: A, cricketMarks: { BULL: 3 } },
    ];
    expect(computeCricketLegState(turnsComplete, IDS)[A]!.closed).toBe(true);
  });
});

describe("applyCricketThrow", () => {
  it("rejette un nombre de marques incohérent avec les fléchettes lancées", () => {
    const result = applyCricketThrow([], IDS, A, { cricketMarks: { "20": 9 }, dartsUsed: 1 });
    expect(result.accepted).toBe(false);
  });

  it("rejette un numéro de cricket invalide", () => {
    const result = applyCricketThrow([], IDS, A, { cricketMarks: { "7": 1 }, dartsUsed: 1 });
    expect(result.accepted).toBe(false);
  });

  it("gagne le leg quand tous les numéros sont fermés et le score est au moins égal à l'adversaire", () => {
    const priorTurns: CricketTurn[] = [
      { registrationId: A, cricketMarks: { "20": 3, "19": 3, "18": 3, "17": 3, "16": 3 } },
      { registrationId: B, cricketMarks: {} },
    ];
    const result = applyCricketThrow(priorTurns, IDS, A, { cricketMarks: { "15": 3, BULL: 3 }, dartsUsed: 3 });
    expect(result.legWon).toBe(true);
  });

  it("ne gagne pas si fermé mais score inférieur à l'adversaire", () => {
    const priorTurns: CricketTurn[] = [
      { registrationId: B, cricketMarks: { "20": 5 } }, // B a 40 points d'avance sur le 20
      { registrationId: A, cricketMarks: { "19": 3, "18": 3, "17": 3, "16": 3, "15": 3 } },
    ];
    const result = applyCricketThrow(priorTurns, IDS, A, { cricketMarks: { "20": 3, BULL: 3 }, dartsUsed: 3 });
    // A ferme tout mais n'a que les points du BULL (adversaire a déjà fermé le 20 avant lui)
    expect(result.legWon).toBe(false);
  });
});

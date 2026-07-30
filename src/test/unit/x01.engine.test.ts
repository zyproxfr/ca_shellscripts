import { describe, expect, it } from "vitest";
import { applyX01Throw } from "@/server/scoring/x01.engine";
import type { ScoringRulesConfig } from "@/server/scoring/game-engine.interface";

function rules(outMode: ScoringRulesConfig["outMode"]): ScoringRulesConfig {
  return { gameType: "X501", inMode: "STRAIGHT", outMode };
}

describe("applyX01Throw", () => {
  it("soustrait normalement le score du reste", () => {
    const result = applyX01Throw(501, rules("DOUBLE"), { scoreValue: 100, dartsUsed: 3 });
    expect(result).toMatchObject({ accepted: true, isBust: false, remainingAfter: 401 });
  });

  it("rejette un score hors plage (0-180)", () => {
    expect(applyX01Throw(501, rules("DOUBLE"), { scoreValue: 181, dartsUsed: 3 }).accepted).toBe(false);
    expect(applyX01Throw(501, rules("DOUBLE"), { scoreValue: -1, dartsUsed: 3 }).accepted).toBe(false);
  });

  it("bust si le score devient négatif", () => {
    const result = applyX01Throw(40, rules("DOUBLE"), { scoreValue: 60, dartsUsed: 3 });
    expect(result).toMatchObject({ accepted: true, isBust: true, remainingAfter: 40 });
  });

  it("bust si le reste tombe à 1 en mode DOUBLE (infinissable)", () => {
    const result = applyX01Throw(41, rules("DOUBLE"), { scoreValue: 40, dartsUsed: 3 });
    expect(result).toMatchObject({ isBust: true, remainingAfter: 41 });
  });

  it("ne bust pas à 1 en mode STRAIGHT", () => {
    const result = applyX01Throw(41, rules("STRAIGHT"), { scoreValue: 40, dartsUsed: 3 });
    expect(result).toMatchObject({ isBust: false, remainingAfter: 1 });
  });

  it("checkout valide en mode DOUBLE avec dernière fléchette double", () => {
    const result = applyX01Throw(40, rules("DOUBLE"), { scoreValue: 40, dartsUsed: 1, lastDartWasDouble: true });
    expect(result).toMatchObject({ isCheckout: true, legWon: true, remainingAfter: 0 });
  });

  it("bust (pas de victoire) à 0 sans double en mode DOUBLE", () => {
    const result = applyX01Throw(40, rules("DOUBLE"), { scoreValue: 40, dartsUsed: 3, lastDartWasDouble: false });
    expect(result).toMatchObject({ isBust: true, legWon: false, remainingAfter: 40 });
  });

  it("checkout valide en mode MASTER avec triple", () => {
    const result = applyX01Throw(60, rules("MASTER"), { scoreValue: 60, dartsUsed: 1, lastDartWasTriple: true });
    expect(result).toMatchObject({ isCheckout: true, legWon: true });
  });

  it("checkout toujours valide en mode STRAIGHT sans condition de double/triple", () => {
    const result = applyX01Throw(20, rules("STRAIGHT"), { scoreValue: 20, dartsUsed: 3 });
    expect(result).toMatchObject({ isCheckout: true, legWon: true });
  });

  it("un score de 0 (aucun point marqué) est accepté et ne change rien", () => {
    const result = applyX01Throw(100, rules("DOUBLE"), { scoreValue: 0, dartsUsed: 3 });
    expect(result).toMatchObject({ accepted: true, isBust: false, remainingAfter: 100 });
  });
});

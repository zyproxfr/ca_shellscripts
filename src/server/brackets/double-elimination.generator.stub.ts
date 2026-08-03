import type { BracketGenerator } from "@/server/brackets/bracket-generator.interface";

// Stub : le modèle de données (Tournament.format, Match.nextMatchId/nextMatchSlot)
// supporte déjà ce format. Implémentation complète repoussée à une itération
// suivante — cf. plan produit. Le garde de transition IN_PROGRESS refuse ce format
// avant même d'atteindre ce générateur (voir tournament-state-machine.ts).
export const doubleEliminationGeneratorStub: BracketGenerator = {
  format: "DOUBLE_ELIMINATION",
  generateInitialRounds() {
    throw new Error("Le format Double Élimination n'est pas encore implémenté.");
  },
};

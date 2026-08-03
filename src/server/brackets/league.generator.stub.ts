import type { BracketGenerator } from "@/server/brackets/bracket-generator.interface";

// Stub : voir double-elimination.generator.stub.ts pour le principe. La ligue
// (cumul de points sur plusieurs soirées) nécessite en plus une notion de "saison"
// non modélisée en V1 — repoussé volontairement.
export const leagueGeneratorStub: BracketGenerator = {
  format: "LEAGUE",
  generateInitialRounds() {
    throw new Error("Le format Ligue n'est pas encore implémenté.");
  },
};

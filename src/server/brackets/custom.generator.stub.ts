import type { BracketGenerator } from "@/server/brackets/bracket-generator.interface";

// Stub : le format Custom est prévu pour des besoins non couverts par les formats
// standards (ex: poules + phase finale enchaînées). formatConfig (Json) permettra de
// paramétrer sa génération le moment venu, sans migration de schéma.
export const customGeneratorStub: BracketGenerator = {
  format: "CUSTOM",
  generateInitialRounds() {
    throw new Error("Le format Custom n'est pas encore implémenté.");
  },
};

import type { TournamentFormat } from "@prisma/client";
import type { BracketGenerator } from "@/server/brackets/bracket-generator.interface";
import { roundRobinGenerator } from "@/server/brackets/round-robin.generator";
import { singleEliminationGenerator } from "@/server/brackets/single-elimination.generator";
import { doubleEliminationGeneratorStub } from "@/server/brackets/double-elimination.generator.stub";
import { leagueGeneratorStub } from "@/server/brackets/league.generator.stub";
import { customGeneratorStub } from "@/server/brackets/custom.generator.stub";

export const bracketGeneratorRegistry: Record<TournamentFormat, BracketGenerator> = {
  ROUND_ROBIN: roundRobinGenerator,
  SINGLE_ELIMINATION: singleEliminationGenerator,
  DOUBLE_ELIMINATION: doubleEliminationGeneratorStub,
  LEAGUE: leagueGeneratorStub,
  CUSTOM: customGeneratorStub,
};

export function getBracketGenerator(format: TournamentFormat): BracketGenerator {
  return bracketGeneratorRegistry[format];
}

import type { RoundPhase } from "@prisma/client";
import type { BracketGenerator, GenerateBracketInput, GeneratedMatch, GeneratedRound } from "@/server/brackets/bracket-generator.interface";

function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

// Ordre de seeding standard d'un bracket ([1,8,4,5,2,7,3,6] pour 8 seeds) : place
// les têtes de série de sorte qu'elles ne puissent se rencontrer qu'au dernier moment
// possible, plutôt que de les faire s'affronter dès le premier tour.
function standardSeedOrder(size: number): number[] {
  if (size === 1) return [1];
  const prev = standardSeedOrder(size / 2);
  const result: number[] = [];
  for (const s of prev) {
    result.push(s, size + 1 - s);
  }
  return result;
}

function phaseForRoundSize(matchesInRound: number): RoundPhase {
  switch (matchesInRound) {
    case 1:
      return "FINAL";
    case 2:
      return "SEMIFINAL";
    case 4:
      return "QUARTERFINAL";
    case 8:
      return "ROUND_OF_16";
    case 16:
      return "ROUND_OF_32";
    case 32:
      return "ROUND_OF_64";
    default:
      return "CUSTOM";
  }
}

function nameForPhase(phase: RoundPhase): string {
  const labels: Record<RoundPhase, string> = {
    GROUP_STAGE: "Phase de poules",
    ROUND_OF_64: "32e de finale",
    ROUND_OF_32: "16e de finale",
    ROUND_OF_16: "8e de finale",
    QUARTERFINAL: "Quart de finale",
    SEMIFINAL: "Demi-finale",
    FINAL: "Finale",
    THIRD_PLACE: "Petite finale",
    LEAGUE_ROUND: "Journée de ligue",
    CUSTOM: "Round",
  };
  return labels[phase];
}

export const singleEliminationGenerator: BracketGenerator = {
  format: "SINGLE_ELIMINATION",

  generateInitialRounds(input: GenerateBracketInput): GeneratedRound[] {
    const registrations = orderRegistrations(input.checkedInRegistrations);
    const n = registrations.length;
    if (n < 2) {
      throw new Error("Au moins 2 participants check-in sont requis pour générer le bracket.");
    }

    const bracketSize = nextPowerOfTwo(n);
    const seedOrder = standardSeedOrder(bracketSize);
    // seedOrder[i] = numéro de seed occupant le slot i (0-indexé). Les seeds > n
    // n'ont pas de participant réel : ce sont des exempts (bye).
    const slotToRegistration = seedOrder.map((seedNumber) => (seedNumber <= n ? registrations[seedNumber - 1] : null));

    const totalRounds = Math.log2(bracketSize);
    const rounds: GeneratedRound[] = [];

    // Round 1 : appariement des slots consécutifs, résolution immédiate des byes.
    const firstRoundMatches: GeneratedMatch[] = [];
    for (let i = 0; i < bracketSize / 2; i++) {
      const regA = slotToRegistration[i * 2];
      const regB = slotToRegistration[i * 2 + 1];
      const isBye = !regA || !regB;
      firstRoundMatches.push({
        localIndex: i,
        registrationAId: regA?.id ?? null,
        registrationBId: regB?.id ?? null,
        bracketSlot: i,
        isBye,
        feedsIntoRoundIndex: totalRounds > 1 ? 1 : undefined,
        feedsIntoLocalIndex: totalRounds > 1 ? Math.floor(i / 2) : undefined,
        feedsIntoSlot: totalRounds > 1 ? ((i % 2 === 0 ? 1 : 2) as 1 | 2) : undefined,
      });
    }
    const firstPhase = phaseForRoundSize(firstRoundMatches.length);
    rounds.push({ phase: firstPhase, roundNumber: 1, name: nameForPhase(firstPhase), matches: firstRoundMatches });

    // Rounds suivants : structure vide (remplie au fil de la progression des matchs),
    // sauf pour les slots directement issus d'un bye du round précédent — propagés
    // immédiatement ci-dessous, sans attendre un "vrai" match.
    for (let r = 1; r < totalRounds; r++) {
      const matchesInRound = bracketSize / Math.pow(2, r + 1);
      const matches: GeneratedMatch[] = [];
      for (let i = 0; i < matchesInRound; i++) {
        matches.push({
          localIndex: i,
          registrationAId: null,
          registrationBId: null,
          feedsIntoRoundIndex: r + 1 < totalRounds ? r + 1 : undefined,
          feedsIntoLocalIndex: r + 1 < totalRounds ? Math.floor(i / 2) : undefined,
          feedsIntoSlot: r + 1 < totalRounds ? ((i % 2 === 0 ? 1 : 2) as 1 | 2) : undefined,
        });
      }
      const phase = phaseForRoundSize(matches.length);
      rounds.push({ phase, roundNumber: r + 1, name: nameForPhase(phase), matches });
    }

    // Propage immédiatement les vainqueurs des matchs "bye" du round 1 (et en cascade
    // si deux byes consécutifs se propagent l'un dans l'autre, cas rare mais possible
    // avec de nombreux exempts) vers les rounds suivants, sans attendre la saisie live.
    propagateByes(rounds);

    return rounds;
  },
};

function orderRegistrations(registrations: GenerateBracketInput["checkedInRegistrations"]) {
  return [...registrations].sort((a, b) => {
    if (a.seed != null && b.seed != null) return a.seed - b.seed;
    if (a.seed != null) return -1;
    if (b.seed != null) return 1;
    return a.registeredAt.getTime() - b.registeredAt.getTime();
  });
}

function propagateByes(rounds: GeneratedRound[]) {
  for (let r = 0; r < rounds.length; r++) {
    for (const match of rounds[r]?.matches ?? []) {
      if (!match.isBye) continue;
      const winnerId = match.registrationAId ?? match.registrationBId;
      if (!winnerId) continue;
      if (match.feedsIntoRoundIndex === undefined || match.feedsIntoLocalIndex === undefined) continue;

      const targetRound = rounds[match.feedsIntoRoundIndex];
      const targetMatch = targetRound?.matches[match.feedsIntoLocalIndex];
      if (!targetMatch) continue;
      if (match.feedsIntoSlot === 1) {
        targetMatch.registrationAId = winnerId;
      } else {
        targetMatch.registrationBId = winnerId;
      }
      // Si ce match cible se retrouve lui-même avec un seul côté rempli et que son
      // propre round est déjà entièrement déterminé par des byes, il sera à son tour
      // marqué bye par le service d'insertion (voir bracket-service.ts).
    }
  }
}

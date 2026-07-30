import type { BracketGenerator, GenerateBracketInput, GeneratedMatch, GeneratedRound } from "@/server/brackets/bracket-generator.interface";

type RegistrationLike = GenerateBracketInput["checkedInRegistrations"][number];

// Algorithme du cercle (circle method) : génère un calendrier de journées où chaque
// participant affronte tous les autres exactement une fois, sans répétition.
function circleMethodSchedule(participantIds: (string | null)[]): Array<Array<[string | null, string | null]>> {
  const ids = [...participantIds];
  if (ids.length % 2 !== 0) ids.push(null); // participant fictif = "repos" ce jour-là

  const n = ids.length;
  const journeyCount = n - 1;
  const rounds: Array<Array<[string | null, string | null]>> = [];
  const rotating = ids.slice(1);

  for (let round = 0; round < journeyCount; round++) {
    const pairs: Array<[string | null, string | null]> = [];
    const current = [ids[0] ?? null, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      pairs.push([current[i] ?? null, current[n - 1 - i] ?? null]);
    }
    rounds.push(pairs);
    rotating.unshift(rotating.pop() as string | null);
  }

  return rounds;
}

function splitIntoGroups(registrations: RegistrationLike[], groupCount: number): RegistrationLike[][] {
  const groups: RegistrationLike[][] = Array.from({ length: groupCount }, () => []);
  registrations.forEach((reg, i) => {
    groups[i % groupCount]?.push(reg);
  });
  return groups;
}

export const roundRobinGenerator: BracketGenerator = {
  format: "ROUND_ROBIN",

  generateInitialRounds(input: GenerateBracketInput): GeneratedRound[] {
    const registrations = [...input.checkedInRegistrations].sort(
      (a, b) => a.registeredAt.getTime() - b.registeredAt.getTime(),
    );
    if (registrations.length < 2) {
      throw new Error("Au moins 2 participants check-in sont requis pour générer les poules.");
    }

    const groupCount = Math.max(1, Number(input.formatConfig.groupCount ?? 1));
    const groups = splitIntoGroups(registrations, groupCount);
    const groupNames = groups.map((_, i) => `Poule ${String.fromCharCode(65 + i)}`);

    const schedulesByGroup = groups.map((group) => circleMethodSchedule(group.map((r) => r.id)));
    const maxJourneys = Math.max(...schedulesByGroup.map((s) => s.length));

    const rounds: GeneratedRound[] = [];
    for (let journeyIndex = 0; journeyIndex < maxJourneys; journeyIndex++) {
      const matches: GeneratedMatch[] = [];
      let localIndex = 0;
      schedulesByGroup.forEach((schedule, groupIdx) => {
        const journey = schedule[journeyIndex];
        if (!journey) return; // ce groupe a moins de journées (taille différente)
        for (const [regAId, regBId] of journey) {
          if (!regAId || !regBId) continue; // participant au repos ce jour-là (effectif impair)
          matches.push({
            localIndex: localIndex++,
            registrationAId: regAId,
            registrationBId: regBId,
            groupName: groupNames[groupIdx],
          });
        }
      });

      rounds.push({
        phase: "GROUP_STAGE",
        roundNumber: journeyIndex + 1,
        name: `Poules — Journée ${journeyIndex + 1}`,
        matches,
      });
    }

    return rounds;
  },
};

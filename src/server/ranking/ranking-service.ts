import type { Match, MatchGame, Registration, ScoreEntry, TieBreakRule } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { tieBreakValue } from "@/server/ranking/tie-break";

export interface StandingEntry {
  registrationId: string;
  rank: number;
  points: number;
  wins: number;
  losses: number;
  legsWon: number;
  legsLost: number;
  setsWon: number;
  setsLost: number;
  average: number;
  highestScore: number;
  count180: number;
  count140Plus: number;
  tieBreakScore: number;
}

interface RegStats {
  wins: number;
  losses: number;
  legsWon: number;
  legsLost: number;
  setsWon: number;
  setsLost: number;
  highestScore: number;
  count180: number;
  count140Plus: number;
  totalScoreValue: number;
  totalDarts: number;
}

function emptyStats(): RegStats {
  return {
    wins: 0,
    losses: 0,
    legsWon: 0,
    legsLost: 0,
    setsWon: 0,
    setsLost: 0,
    highestScore: 0,
    count180: 0,
    count140Plus: 0,
    totalScoreValue: 0,
    totalDarts: 0,
  };
}

type MatchWithLegs = Match & { legs: (MatchGame & { scoreEntries: ScoreEntry[] })[] };

function accumulateMatchStats(stats: Map<string, RegStats>, match: MatchWithLegs) {
  const { registrationAId, registrationBId, winnerRegistrationId } = match;
  if (!registrationAId || !registrationBId) return;

  for (const regId of [registrationAId, registrationBId]) {
    if (!stats.has(regId)) stats.set(regId, emptyStats());
  }
  const statsA = stats.get(registrationAId)!;
  const statsB = stats.get(registrationBId)!;

  if (winnerRegistrationId === registrationAId) {
    statsA.wins++;
    statsB.losses++;
  } else if (winnerRegistrationId === registrationBId) {
    statsB.wins++;
    statsA.losses++;
  }

  const completedLegs = match.legs.filter((l) => l.status === "COMPLETED");
  const aLegsWon = completedLegs.filter((l) => l.winnerRegistrationId === registrationAId).length;
  const bLegsWon = completedLegs.filter((l) => l.winnerRegistrationId === registrationBId).length;
  statsA.legsWon += aLegsWon;
  statsA.legsLost += bLegsWon;
  statsB.legsWon += bLegsWon;
  statsB.legsLost += aLegsWon;

  // Un set est gagné par celui qui a gagné le plus de legs dans ce set.
  const setNumbers = new Set(match.legs.map((l) => l.setNumber));
  for (const setNumber of setNumbers) {
    const legsOfSet = completedLegs.filter((l) => l.setNumber === setNumber);
    const aWonSet = legsOfSet.filter((l) => l.winnerRegistrationId === registrationAId).length;
    const bWonSet = legsOfSet.filter((l) => l.winnerRegistrationId === registrationBId).length;
    if (aWonSet > bWonSet) {
      statsA.setsWon++;
      statsB.setsLost++;
    } else if (bWonSet > aWonSet) {
      statsB.setsWon++;
      statsA.setsLost++;
    }
  }

  for (const leg of match.legs) {
    for (const entry of leg.scoreEntries) {
      if (entry.isInvalidated || entry.isBust) continue;
      const s = stats.get(entry.registrationId);
      if (!s) continue;
      s.totalScoreValue += entry.scoreValue;
      s.totalDarts += entry.dartsUsed;
      if (entry.scoreValue > s.highestScore) s.highestScore = entry.scoreValue;
      if (entry.scoreValue === 180) s.count180++;
      else if (entry.scoreValue >= 140) s.count140Plus++;
    }
  }
}

function toStandingEntry(registrationId: string, stats: RegStats, tieBreakRule: TieBreakRule): StandingEntry {
  const average = stats.totalDarts > 0 ? (stats.totalScoreValue / stats.totalDarts) * 3 : 0;
  const legDifference = stats.legsWon - stats.legsLost;
  return {
    registrationId,
    rank: 0,
    points: stats.wins * 2,
    wins: stats.wins,
    losses: stats.losses,
    legsWon: stats.legsWon,
    legsLost: stats.legsLost,
    setsWon: stats.setsWon,
    setsLost: stats.setsLost,
    average: Math.round(average * 100) / 100,
    highestScore: stats.highestScore,
    count180: stats.count180,
    count140Plus: stats.count140Plus,
    tieBreakScore: tieBreakValue(tieBreakRule, { legDifference, average }),
  };
}

/** Classement "round robin" classique : tri par points puis règle de départage. */
function computeRoundRobinStandings(
  registrations: Registration[],
  matches: MatchWithLegs[],
  tieBreakRule: TieBreakRule,
): StandingEntry[] {
  const statsByReg = new Map<string, RegStats>();
  for (const reg of registrations) statsByReg.set(reg.id, emptyStats());
  for (const match of matches) accumulateMatchStats(statsByReg, match);

  const entries = registrations.map((reg) => toStandingEntry(reg.id, statsByReg.get(reg.id) ?? emptyStats(), tieBreakRule));
  entries.sort((a, b) => b.points - a.points || b.tieBreakScore - a.tieBreakScore || a.registrationId.localeCompare(b.registrationId));
  entries.forEach((e, i) => (e.rank = i + 1));
  return entries;
}

/**
 * Classement à élimination directe : le rang est déterminé par le tour le plus
 * loin atteint (champion = 1, finaliste battu = 2, demi-finalistes battus ex-æquo
 * à 3, etc.) — les stats individuelles (moyenne, 180...) restent calculées pareil.
 */
function computeEliminationStandings(
  registrations: Registration[],
  matches: MatchWithLegs[],
  roundsOrdered: { id: string; roundNumber: number }[],
  tieBreakRule: TieBreakRule,
): StandingEntry[] {
  const statsByReg = new Map<string, RegStats>();
  for (const reg of registrations) statsByReg.set(reg.id, emptyStats());
  for (const match of matches) accumulateMatchStats(statsByReg, match);

  const totalRounds = roundsOrdered.length;
  // Tour d'élimination (le plus grand roundNumber où le participant a perdu) ; le
  // champion n'a jamais perdu -> traité à part (profondeur = totalRounds + 1).
  const eliminationRound = new Map<string, number>();
  const roundNumberByRoundId = new Map(roundsOrdered.map((r) => [r.id, r.roundNumber]));
  for (const match of matches) {
    if (!match.loserRegistrationId) continue;
    const roundNumber = roundNumberByRoundId.get(match.roundId) ?? 0;
    const current = eliminationRound.get(match.loserRegistrationId) ?? 0;
    if (roundNumber > current) eliminationRound.set(match.loserRegistrationId, roundNumber);
  }

  const entries = registrations.map((reg) => {
    const entry = toStandingEntry(reg.id, statsByReg.get(reg.id) ?? emptyStats(), tieBreakRule);
    const depth = eliminationRound.has(reg.id) ? eliminationRound.get(reg.id)! : totalRounds + 1;
    return { entry, depth };
  });

  entries.sort((a, b) => b.depth - a.depth || b.entry.tieBreakScore - a.entry.tieBreakScore || a.entry.registrationId.localeCompare(b.entry.registrationId));

  // Rang partagé pour les éliminés au même tour (ex-æquo), à la manière d'un classement sportif.
  let rank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i]!.depth === entries[i - 1]!.depth) {
      entries[i]!.entry.rank = entries[i - 1]!.entry.rank;
    } else {
      entries[i]!.entry.rank = rank;
    }
    rank++;
  }

  return entries.map((e) => e.entry);
}

export async function recomputeStandings(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  const registrations = await prisma.registration.findMany({
    where: { tournamentId, status: { not: "WITHDRAWN" } },
  });
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: { in: ["COMPLETED", "WALKOVER"] } },
    include: { legs: { include: { scoreEntries: { where: { isInvalidated: false } } } } },
  });

  if (tournament.format === "ROUND_ROBIN") {
    const groups = await prisma.group.findMany({ where: { tournamentId }, include: { registrations: true } });
    if (groups.length > 0) {
      for (const group of groups) {
        const groupRegistrationIds = new Set(group.registrations.map((rg) => rg.registrationId));
        const groupRegistrations = registrations.filter((r) => groupRegistrationIds.has(r.id));
        const groupMatches = matches.filter((m) => m.groupId === group.id);
        const standings = computeRoundRobinStandings(groupRegistrations, groupMatches, tournament.tieBreakRule);
        await persistStandings(tournamentId, group.id, standings);
      }
      return;
    }
    const standings = computeRoundRobinStandings(registrations, matches, tournament.tieBreakRule);
    await persistStandings(tournamentId, null, standings);
    return;
  }

  if (tournament.format === "SINGLE_ELIMINATION") {
    const rounds = await prisma.tournamentRound.findMany({
      where: { tournamentId },
      orderBy: { roundNumber: "asc" },
      select: { id: true, roundNumber: true },
    });
    const standings = computeEliminationStandings(registrations, matches, rounds, tournament.tieBreakRule);
    await persistStandings(tournamentId, null, standings);
    return;
  }
}

async function persistStandings(tournamentId: string, groupId: string | null, standings: StandingEntry[]) {
  for (const { registrationId, ...fields } of standings) {
    // Prisma n'autorise pas `null` dans la clé composite du raccourci upsert (limite
    // connue pour les colonnes nullables d'une contrainte @@unique) : on distingue
    // donc explicitement le cas "sans poule" (recherche manuelle) du cas "avec poule".
    if (groupId === null) {
      const existing = await prisma.ranking.findFirst({ where: { tournamentId, groupId: null, registrationId } });
      if (existing) {
        await prisma.ranking.update({ where: { id: existing.id }, data: fields });
      } else {
        await prisma.ranking.create({ data: { tournamentId, groupId: null, registrationId, ...fields } });
      }
      continue;
    }
    await prisma.ranking.upsert({
      where: { tournamentId_groupId_registrationId: { tournamentId, groupId, registrationId } },
      create: { tournamentId, groupId, registrationId, ...fields },
      update: { ...fields },
    });
  }
}

export async function getRankingForTournament(tournamentId: string) {
  return prisma.ranking.findMany({
    where: { tournamentId },
    include: {
      registration: { include: { player: true, team: true } },
      group: true,
    },
    orderBy: [{ groupId: "asc" }, { rank: "asc" }],
  });
}

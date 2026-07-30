import { prisma } from "@/lib/prisma/client";

/**
 * Met à jour les statistiques carrière (tous tournois confondus) des joueurs ayant
 * participé à un tournoi qui vient de se terminer. Appelé une seule fois par
 * tournoi, depuis progression-service.ts juste après le passage à COMPLETED.
 * Ignore les inscriptions en équipe (les stats carrière sont individuelles par
 * Player ; les stats d'équipe sont un point d'extension futur).
 */
export async function updatePlayerStatsForTournament(tournamentId: string): Promise<void> {
  const registrations = await prisma.registration.findMany({
    where: { tournamentId, status: { not: "WITHDRAWN" }, playerId: { not: null } },
  });

  const matches = await prisma.match.findMany({
    where: { tournamentId, status: { in: ["COMPLETED", "WALKOVER"] } },
    include: { legs: { include: { scoreEntries: { where: { isInvalidated: false } } } } },
  });

  for (const registration of registrations) {
    const playerId = registration.playerId;
    if (!playerId) continue;

    const playerMatches = matches.filter(
      (m) => m.registrationAId === registration.id || m.registrationBId === registration.id,
    );
    if (playerMatches.length === 0) continue;

    let wins = 0;
    let losses = 0;
    let totalScoreThrown = 0;
    let totalDartsThrown = 0;
    let highestScore = 0;
    let count180 = 0;
    let count140Plus = 0;

    for (const match of playerMatches) {
      if (match.winnerRegistrationId === registration.id) wins++;
      else if (match.loserRegistrationId === registration.id) losses++;

      for (const leg of match.legs) {
        for (const entry of leg.scoreEntries) {
          if (entry.registrationId !== registration.id || entry.isBust) continue;
          totalScoreThrown += entry.scoreValue;
          totalDartsThrown += entry.dartsUsed;
          if (entry.scoreValue > highestScore) highestScore = entry.scoreValue;
          if (entry.scoreValue === 180) count180++;
          else if (entry.scoreValue >= 140) count140Plus++;
        }
      }
    }

    const existing = await prisma.playerStats.findUnique({ where: { playerId } });
    const newTotalScoreThrown = (existing?.totalScoreThrown ?? 0) + totalScoreThrown;
    const newTotalDartsThrown = (existing?.totalDartsThrown ?? 0) + totalDartsThrown;
    const newMatchesPlayed = (existing?.matchesPlayed ?? 0) + playerMatches.length;
    const newWins = (existing?.wins ?? 0) + wins;
    const newLosses = (existing?.losses ?? 0) + losses;

    await prisma.playerStats.upsert({
      where: { playerId },
      create: {
        playerId,
        tournamentsPlayed: 1,
        matchesPlayed: playerMatches.length,
        wins,
        losses,
        winRatio: newMatchesPlayed > 0 ? newWins / newMatchesPlayed : 0,
        average: newTotalDartsThrown > 0 ? (newTotalScoreThrown / newTotalDartsThrown) * 3 : 0,
        totalScoreThrown,
        totalDartsThrown,
        highestScore,
        count180,
        count140Plus,
      },
      update: {
        tournamentsPlayed: { increment: 1 },
        matchesPlayed: newMatchesPlayed,
        wins: newWins,
        losses: newLosses,
        winRatio: newMatchesPlayed > 0 ? newWins / newMatchesPlayed : 0,
        average: newTotalDartsThrown > 0 ? (newTotalScoreThrown / newTotalDartsThrown) * 3 : 0,
        totalScoreThrown: newTotalScoreThrown,
        totalDartsThrown: newTotalDartsThrown,
        highestScore: Math.max(existing?.highestScore ?? 0, highestScore),
        count180: (existing?.count180 ?? 0) + count180,
        count140Plus: (existing?.count140Plus ?? 0) + count140Plus,
      },
    });
  }
}

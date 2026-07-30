import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getBracketGenerator } from "@/server/brackets/bracket-registry";
import type { GeneratedRound } from "@/server/brackets/bracket-generator.interface";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";

type Tx = Prisma.TransactionClient;

function registrationLabel(registration: {
  player: { displayName: string } | null;
  team: { name: string } | null;
} | null): string | null {
  if (!registration) return null;
  return registration.player?.displayName ?? registration.team?.name ?? null;
}

/**
 * Projection publique du bracket/poules — utilisée par la vue bracket, la vue poules
 * et l'écran TV. Ne renvoie que des informations d'affichage (jamais email,
 * téléphone ou données d'audit) : cette fonction peut être appelée sans session.
 */
export async function getBracketSnapshot(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, format: true, mode: true, status: true },
  });
  if (!tournament) {
    throw new NotFoundError("Tournoi introuvable.");
  }

  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId },
    orderBy: { roundNumber: "asc" },
    include: {
      matches: {
        include: {
          registrationA: { include: { player: true, team: true } },
          registrationB: { include: { player: true, team: true } },
          group: true,
        },
        orderBy: { bracketSlot: "asc" },
      },
    },
  });

  return {
    tournament,
    rounds: rounds.map((round) => ({
      id: round.id,
      phase: round.phase,
      roundNumber: round.roundNumber,
      name: round.name,
      status: round.status,
      matches: round.matches.map((match) => ({
        id: match.id,
        status: match.status,
        groupName: match.group?.name ?? null,
        registrationALabel: registrationLabel(match.registrationA),
        registrationBLabel: registrationLabel(match.registrationB),
        winnerRegistrationId: match.winnerRegistrationId,
        registrationAId: match.registrationAId,
        registrationBId: match.registrationBId,
      })),
    })),
  };
}

/**
 * Traduit la sortie (purement algorithmique, sans dépendance à Prisma) d'un
 * BracketGenerator en lignes TournamentRound/Match persistées, avec résolution des
 * références de propagation (feedsInto -> nextMatchId réel) et des byes (WALKOVER
 * immédiat). Appelée une seule fois, au moment où le tournoi passe à IN_PROGRESS
 * (voir tournament-service.ts::changeTournamentStatus).
 */
export async function generateAndPersistBracket(tx: Tx, tournamentId: string) {
  const tournament = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId } });

  const existingRounds = await tx.tournamentRound.count({ where: { tournamentId } });
  if (existingRounds > 0) {
    throw new ConflictError("Le bracket a déjà été généré pour ce tournoi.");
  }

  const checkedInRegistrations = await tx.registration.findMany({
    where: { tournamentId, status: "CHECKED_IN" },
  });

  const generator = getBracketGenerator(tournament.format);
  const generatedRounds = generator.generateInitialRounds({
    tournament,
    checkedInRegistrations,
    formatConfig: (tournament.formatConfig as Record<string, unknown>) ?? {},
  });

  if (generatedRounds.length === 0) {
    throw new ValidationError("La génération du bracket n'a produit aucun round.");
  }

  // Round Robin : crée les groupes (poules) référencés par les matchs générés, et
  // rattache chaque participant à sa poule (déduit des matchs générés : un
  // participant appartient à la poule de tous les matchs où il apparaît).
  const groupNameToId = new Map<string, string>();
  const groupNameToRegistrationIds = new Map<string, Set<string>>();
  for (const round of generatedRounds) {
    for (const match of round.matches) {
      if (!match.groupName) continue;
      const set = groupNameToRegistrationIds.get(match.groupName) ?? new Set<string>();
      if (match.registrationAId) set.add(match.registrationAId);
      if (match.registrationBId) set.add(match.registrationBId);
      groupNameToRegistrationIds.set(match.groupName, set);
    }
  }
  for (const [name, registrationIds] of groupNameToRegistrationIds) {
    const group = await tx.group.create({ data: { tournamentId, name } });
    groupNameToId.set(name, group.id);
    for (const registrationId of registrationIds) {
      await tx.registrationGroup.create({ data: { groupId: group.id, registrationId } });
    }
  }

  // localMatchId[roundIndex][localIndex] = id réel en base, pour résoudre les
  // références de propagation une fois toutes les lignes insérées.
  const localMatchId: string[][] = generatedRounds.map(() => []);

  for (const [roundIndex, generatedRound] of generatedRounds.entries()) {
    const round = await tx.tournamentRound.create({
      data: {
        tournamentId,
        phase: generatedRound.phase,
        roundNumber: generatedRound.roundNumber,
        name: generatedRound.name,
        status: roundIndex === 0 ? "IN_PROGRESS" : "PENDING",
        startedAt: roundIndex === 0 ? new Date() : null,
      },
    });

    for (const generatedMatch of generatedRound.matches) {
      const bothKnown = Boolean(generatedMatch.registrationAId && generatedMatch.registrationBId);
      const isWalkover = Boolean(generatedMatch.isBye);

      const match = await tx.match.create({
        data: {
          tournamentId,
          roundId: round.id,
          groupId: generatedMatch.groupName ? groupNameToId.get(generatedMatch.groupName) : undefined,
          registrationAId: generatedMatch.registrationAId,
          registrationBId: generatedMatch.registrationBId,
          bracketSlot: generatedMatch.bracketSlot,
          status: isWalkover ? "WALKOVER" : bothKnown ? "READY" : "SCHEDULED",
          winnerRegistrationId: isWalkover
            ? (generatedMatch.registrationAId ?? generatedMatch.registrationBId)
            : undefined,
          completedAt: isWalkover ? new Date() : undefined,
        },
      });
      const roundMatchIds = localMatchId[roundIndex] ?? (localMatchId[roundIndex] = []);
      roundMatchIds[generatedMatch.localIndex] = match.id;
    }
  }

  // Deuxième passe : résout nextMatchId/nextMatchSlot maintenant que tous les
  // matchs existent en base (structure explicite de l'arbre, cf. décision de
  // conception sur Match.nextMatchId).
  for (const [roundIndex, generatedRound] of generatedRounds.entries()) {
    for (const generatedMatch of generatedRound.matches) {
      if (generatedMatch.feedsIntoRoundIndex === undefined || generatedMatch.feedsIntoLocalIndex === undefined) {
        continue;
      }
      const matchId = localMatchId[roundIndex]?.[generatedMatch.localIndex];
      const nextMatchId = localMatchId[generatedMatch.feedsIntoRoundIndex]?.[generatedMatch.feedsIntoLocalIndex];
      if (!matchId || !nextMatchId) {
        throw new Error("Incohérence interne lors de la résolution du bracket (match introuvable).");
      }
      await tx.match.update({
        where: { id: matchId },
        data: { nextMatchId, nextMatchSlot: generatedMatch.feedsIntoSlot },
      });
    }
  }

  return { roundCount: generatedRounds.length };
}

export function countMatchesInRounds(rounds: GeneratedRound[]): number {
  return rounds.reduce((sum, r) => sum + r.matches.length, 0);
}

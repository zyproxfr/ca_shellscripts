import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { emitToRoom } from "@/lib/realtime/emitter";
import { tournamentRoom } from "@/lib/realtime/events";
import { changeTournamentStatus } from "@/server/tournaments/tournament-service";
import { recomputeStandings } from "@/server/ranking/ranking-service";
import { updatePlayerStatsForTournament } from "@/server/ranking/player-stats-service";
import { ValidationError } from "@/lib/utils/errors";

type Tx = Prisma.TransactionClient;

const TERMINAL_MATCH_STATUSES = new Set(["COMPLETED", "WALKOVER", "CANCELLED"]);

/**
 * À appeler juste après qu'un match a été marqué COMPLETED/WALKOVER (avec
 * winnerRegistrationId renseigné) par scoring-service. Propage le gagnant vers le
 * match suivant (structure explicite nextMatchId/nextMatchSlot), met à jour le statut
 * du round, et déclenche le passage au round suivant ou la clôture du tournoi.
 */
export async function handleMatchCompletion(matchId: string, actorUserId: string) {
  const outcome = await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { round: true },
    });

    if (!TERMINAL_MATCH_STATUSES.has(match.status) || !match.winnerRegistrationId) {
      throw new ValidationError("Le match doit être marqué terminé avec un gagnant avant de propager la progression.");
    }

    if (match.nextMatchId && match.nextMatchSlot) {
      await propagateWinner(tx, match.nextMatchId, match.nextMatchSlot, match.winnerRegistrationId);
    }

    const roundCompleted = await maybeCompleteRound(tx, match.tournamentId, match.roundId);
    let nextRoundActivated: string | undefined;
    let tournamentComplete = false;

    if (roundCompleted) {
      const nextRound = await tx.tournamentRound.findFirst({
        where: { tournamentId: match.tournamentId, roundNumber: match.round.roundNumber + 1 },
      });
      if (nextRound) {
        await tx.tournamentRound.update({
          where: { id: nextRound.id },
          data: { status: "IN_PROGRESS", startedAt: new Date() },
        });
        nextRoundActivated = nextRound.id;
      } else {
        tournamentComplete = true;
      }
    }

    return {
      tournamentId: match.tournamentId,
      roundId: match.roundId,
      winnerRegistrationId: match.winnerRegistrationId,
      roundCompleted,
      nextRoundActivated,
      tournamentComplete,
    };
  });

  // Recalcule le classement après chaque match terminé (cache recalculable à tout
  // moment, jamais une source de vérité — voir Ranking dans le schéma).
  await recomputeStandings(outcome.tournamentId);

  if (outcome.tournamentComplete) {
    await changeTournamentStatus(outcome.tournamentId, "COMPLETED", actorUserId);
    await updatePlayerStatsForTournament(outcome.tournamentId);
  }

  emitToRoom(tournamentRoom(outcome.tournamentId), {
    type: "match:completed",
    matchId,
    winnerRegistrationId: outcome.winnerRegistrationId,
  });
  emitToRoom(tournamentRoom(outcome.tournamentId), { type: "bracket:updated", tournamentId: outcome.tournamentId });
  emitToRoom(tournamentRoom(outcome.tournamentId), { type: "ranking:updated", tournamentId: outcome.tournamentId });
  if (outcome.roundCompleted) {
    emitToRoom(tournamentRoom(outcome.tournamentId), { type: "round:completed", tournamentId: outcome.tournamentId, roundId: outcome.roundId });
  }
  if (outcome.nextRoundActivated) {
    emitToRoom(tournamentRoom(outcome.tournamentId), {
      type: "round:started",
      tournamentId: outcome.tournamentId,
      roundId: outcome.nextRoundActivated,
    });
  }

  return outcome;
}

async function propagateWinner(tx: Tx, nextMatchId: string, slot: number, winnerRegistrationId: string) {
  await tx.match.update({
    where: { id: nextMatchId },
    data: slot === 1 ? { registrationAId: winnerRegistrationId } : { registrationBId: winnerRegistrationId },
  });

  const nextMatch = await tx.match.findUniqueOrThrow({ where: { id: nextMatchId } });
  if (nextMatch.registrationAId && nextMatch.registrationBId && nextMatch.status === "SCHEDULED") {
    await tx.match.update({ where: { id: nextMatchId }, data: { status: "READY" } });
  }
}

async function maybeCompleteRound(tx: Tx, tournamentId: string, roundId: string): Promise<boolean> {
  const matches = await tx.match.findMany({ where: { roundId } });
  const allTerminal = matches.every((m) => TERMINAL_MATCH_STATUSES.has(m.status));
  if (!allTerminal) return false;

  await tx.tournamentRound.update({ where: { id: roundId }, data: { status: "COMPLETED", completedAt: new Date() } });
  return true;
}

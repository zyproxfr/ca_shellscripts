import type { Prisma, TournamentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { recordAudit } from "@/server/audit/audit-service";
import { emitToRoom } from "@/lib/realtime/emitter";
import { tournamentRoom } from "@/lib/realtime/events";
import { ConflictError, InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { guardTransition, type TournamentForGuard } from "@/server/tournaments/tournament-state-machine";
import type { CreateTournamentInput, UpdateTournamentInput } from "@/lib/validation/tournament.schema";

const TOURNAMENT_INCLUDE_FOR_GUARD = {
  scoringRules: true,
  registrations: true,
  rounds: true,
} as const;

export async function listTournaments(filters?: { venueId?: string; status?: TournamentStatus }) {
  return prisma.tournament.findMany({
    where: {
      venueId: filters?.venueId,
      status: filters?.status,
    },
    include: {
      venue: true,
      _count: { select: { registrations: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTournamentDetail(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      venue: true,
      scoringRules: true,
      groups: true,
      rounds: { orderBy: { roundNumber: "asc" } },
      registrations: {
        include: { player: true, team: { include: { members: { include: { player: true } } } }, checkIn: true },
        orderBy: { registeredAt: "asc" },
      },
    },
  });

  if (!tournament) {
    throw new NotFoundError("Tournoi introuvable.");
  }

  return tournament;
}

export async function createTournament(input: CreateTournamentInput, createdById: string) {
  if (input.maxParticipants && input.maxParticipants < input.minParticipants) {
    throw new ValidationError("Le nombre maximum de participants doit être supérieur ou égal au minimum.");
  }

  const tournament = await prisma.tournament.create({
    data: {
      venueId: input.venueId,
      name: input.name,
      description: input.description,
      format: input.format,
      mode: input.mode,
      maxParticipants: input.maxParticipants,
      minParticipants: input.minParticipants,
      registrationDeadline: input.registrationDeadline,
      checkInOpensAt: input.checkInOpensAt,
      startsAt: input.startsAt,
      tieBreakRule: input.tieBreakRule,
      formatConfig: input.formatConfig as Prisma.InputJsonValue,
      createdById,
      scoringRules: {
        create: input.scoringRules,
      },
    },
    include: { scoringRules: true },
  });

  await recordAudit(prisma, {
    actorUserId: createdById,
    tournamentId: tournament.id,
    action: "TOURNAMENT_CREATED",
    entityType: "Tournament",
    entityId: tournament.id,
    afterData: tournament,
  });

  return tournament;
}

export async function updateTournament(tournamentId: string, input: UpdateTournamentInput, actorUserId: string) {
  const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!existing) {
    throw new NotFoundError("Tournoi introuvable.");
  }

  // Le format et le mode déterminent toute la structure du bracket : les figer dès que
  // le tournoi n'est plus en brouillon évite de corrompre des inscriptions déjà en cours.
  if (existing.status !== "DRAFT") {
    if (input.format && input.format !== existing.format) {
      throw new ConflictError("Le format ne peut plus être modifié une fois le tournoi sorti du brouillon.");
    }
    if (input.mode && input.mode !== existing.mode) {
      throw new ConflictError("Le mode (solo/équipe) ne peut plus être modifié une fois le tournoi sorti du brouillon.");
    }
  }

  const maxParticipants = input.maxParticipants ?? existing.maxParticipants ?? undefined;
  const minParticipants = input.minParticipants ?? existing.minParticipants;
  if (maxParticipants && minParticipants && maxParticipants < minParticipants) {
    throw new ValidationError("Le nombre maximum de participants doit être supérieur ou égal au minimum.");
  }

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      name: input.name,
      description: input.description,
      format: input.format,
      mode: input.mode,
      maxParticipants: input.maxParticipants,
      minParticipants: input.minParticipants,
      registrationDeadline: input.registrationDeadline,
      checkInOpensAt: input.checkInOpensAt,
      startsAt: input.startsAt,
      tieBreakRule: input.tieBreakRule,
      formatConfig: input.formatConfig as Prisma.InputJsonValue,
      ...(input.scoringRules
        ? {
            scoringRules: {
              upsert: {
                create: {
                  gameType: input.scoringRules.gameType ?? "X501",
                  inMode: input.scoringRules.inMode ?? "STRAIGHT",
                  outMode: input.scoringRules.outMode ?? "DOUBLE",
                  legsToWinSet: input.scoringRules.legsToWinSet ?? 3,
                  setsToWinMatch: input.scoringRules.setsToWinMatch ?? 1,
                },
                update: input.scoringRules,
              },
            },
          }
        : {}),
    },
    include: { scoringRules: true },
  });

  await recordAudit(prisma, {
    actorUserId,
    tournamentId,
    action: "TOURNAMENT_UPDATED",
    entityType: "Tournament",
    entityId: tournamentId,
    beforeData: existing,
    afterData: updated,
  });

  return updated;
}

/**
 * Seul point d'écriture autorisé pour Tournament.status. Toute la logique du
 * répertoire src/server ainsi que les routes API doivent passer par cette fonction.
 */
export async function changeTournamentStatus(
  tournamentId: string,
  targetStatus: TournamentStatus,
  actorUserId: string,
  options?: { cancelledReason?: string },
) {
  const tournament = (await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: TOURNAMENT_INCLUDE_FOR_GUARD,
  })) as TournamentForGuard | null;

  if (!tournament) {
    throw new NotFoundError("Tournoi introuvable.");
  }

  const guard = guardTransition({ tournament, targetStatus });
  if (!guard.ok) {
    throw new InvalidTransitionError(guard.errors.join(" "));
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        status: targetStatus,
        cancelledReason: targetStatus === "CANCELLED" ? (options?.cancelledReason ?? null) : tournament.cancelledReason,
      },
    });

    // Annulation : les matchs non encore terminés sont annulés en cascade ; ceux déjà
    // joués restent intacts pour préserver l'historique et les statistiques.
    if (targetStatus === "CANCELLED") {
      await tx.match.updateMany({
        where: {
          tournamentId,
          status: { in: ["SCHEDULED", "READY", "IN_PROGRESS"] },
        },
        data: { status: "CANCELLED" },
      });
    }

    await recordAudit(tx, {
      actorUserId,
      tournamentId,
      action: "TOURNAMENT_STATUS_CHANGED",
      entityType: "Tournament",
      entityId: tournamentId,
      beforeData: { status: tournament.status },
      afterData: { status: targetStatus },
    });

    return result;
  });

  emitToRoom(tournamentRoom(tournamentId), {
    type: "tournament:status-changed",
    tournamentId,
    status: targetStatus,
  });

  return updated;
}

export async function deleteDraftTournament(tournamentId: string, actorUserId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new NotFoundError("Tournoi introuvable.");
  }
  // Suppression physique réservée aux brouillons : au-delà, seule l'annulation est
  // possible, pour ne jamais perdre silencieusement des données de tournoi réel.
  if (tournament.status !== "DRAFT") {
    throw new ConflictError("Seul un tournoi en brouillon peut être supprimé. Utilisez l'annulation sinon.");
  }

  await prisma.tournament.delete({ where: { id: tournamentId } });

  await recordAudit(prisma, {
    actorUserId,
    action: "TOURNAMENT_DELETED",
    entityType: "Tournament",
    entityId: tournamentId,
    beforeData: tournament,
  });
}

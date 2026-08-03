import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { recordAudit } from "@/server/audit/audit-service";
import { emitToRoom } from "@/lib/realtime/emitter";
import { tournamentRoom } from "@/lib/realtime/events";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import type { RegisterSoloInput, RegisterTeamInput } from "@/lib/validation/registration.schema";

type Tx = Prisma.TransactionClient;

async function getOrCreatePlayer(
  tx: Tx,
  input: { playerId?: string; newPlayer?: { firstName: string; lastName: string; phone?: string } },
) {
  if (input.playerId) {
    const player = await tx.player.findUnique({ where: { id: input.playerId } });
    if (!player) {
      throw new NotFoundError("Joueur introuvable.");
    }
    return player;
  }

  if (!input.newPlayer) {
    throw new ValidationError("Joueur ou informations de nouveau joueur requis.");
  }

  return tx.player.create({
    data: {
      firstName: input.newPlayer.firstName,
      lastName: input.newPlayer.lastName,
      phone: input.newPlayer.phone,
      displayName: `${input.newPlayer.firstName} ${input.newPlayer.lastName}`.trim(),
    },
  });
}

async function assertTournamentAcceptsRegistration(tx: Tx, tournamentId: string) {
  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    include: { _count: { select: { registrations: { where: { status: { not: "WITHDRAWN" } } } } } },
  });

  if (!tournament) {
    throw new NotFoundError("Tournoi introuvable.");
  }
  if (tournament.status !== "REGISTRATION_OPEN") {
    throw new ConflictError("Les inscriptions ne sont pas ouvertes pour ce tournoi.");
  }
  if (tournament.maxParticipants && tournament._count.registrations >= tournament.maxParticipants) {
    throw new ConflictError("Le nombre maximum de participants est atteint.");
  }

  return tournament;
}

export async function registerSolo(input: RegisterSoloInput, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const tournament = await assertTournamentAcceptsRegistration(tx, input.tournamentId);
    if (tournament.mode !== "SOLO") {
      throw new ValidationError("Ce tournoi est un tournoi par équipes : utilisez l'inscription équipe.");
    }

    const player = await getOrCreatePlayer(tx, input);

    const existing = await tx.registration.findUnique({
      where: { tournamentId_playerId: { tournamentId: input.tournamentId, playerId: player.id } },
    });
    if (existing) {
      throw new ConflictError("Ce joueur est déjà inscrit à ce tournoi.");
    }

    const registration = await tx.registration.create({
      data: {
        tournamentId: input.tournamentId,
        playerId: player.id,
        seed: input.seed,
        status: "CONFIRMED",
      },
      include: { player: true },
    });

    await recordAudit(tx, {
      actorUserId,
      tournamentId: input.tournamentId,
      action: "REGISTRATION_CREATED",
      entityType: "Registration",
      entityId: registration.id,
      afterData: registration,
    });

    return registration;
  }).then((registration) => {
    emitToRoom(tournamentRoom(input.tournamentId), { type: "bracket:updated", tournamentId: input.tournamentId });
    return registration;
  });
}

export async function registerTeam(input: RegisterTeamInput, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const tournament = await assertTournamentAcceptsRegistration(tx, input.tournamentId);
    if (tournament.mode !== "TEAM") {
      throw new ValidationError("Ce tournoi est un tournoi solo : utilisez l'inscription individuelle.");
    }

    let teamId = input.teamId;

    if (input.newTeam) {
      const existingTeam = await tx.team.findUnique({ where: { name: input.newTeam.name } });
      if (existingTeam) {
        throw new ConflictError("Une équipe porte déjà ce nom.");
      }

      const members = await Promise.all(input.newTeam.members.map((m) => getOrCreatePlayer(tx, m)));

      const team = await tx.team.create({
        data: {
          name: input.newTeam.name,
          members: { create: members.map((p) => ({ playerId: p.id })) },
        },
      });
      teamId = team.id;
    }

    if (!teamId) {
      throw new ValidationError("Équipe requise.");
    }

    const existing = await tx.registration.findUnique({
      where: { tournamentId_teamId: { tournamentId: input.tournamentId, teamId } },
    });
    if (existing) {
      throw new ConflictError("Cette équipe est déjà inscrite à ce tournoi.");
    }

    const registration = await tx.registration.create({
      data: {
        tournamentId: input.tournamentId,
        teamId,
        seed: input.seed,
        status: "CONFIRMED",
      },
      include: { team: { include: { members: { include: { player: true } } } } },
    });

    await recordAudit(tx, {
      actorUserId,
      tournamentId: input.tournamentId,
      action: "REGISTRATION_CREATED",
      entityType: "Registration",
      entityId: registration.id,
      afterData: registration,
    });

    return registration;
  }).then((registration) => {
    emitToRoom(tournamentRoom(input.tournamentId), { type: "bracket:updated", tournamentId: input.tournamentId });
    return registration;
  });
}

export async function checkInRegistration(registrationId: string, staffUserId: string) {
  return prisma.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({
      where: { id: registrationId },
      include: { tournament: true, checkIn: true },
    });
    if (!registration) {
      throw new NotFoundError("Inscription introuvable.");
    }
    if (!["REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(registration.tournament.status)) {
      throw new ConflictError("Le check-in n'est pas possible dans l'état actuel du tournoi.");
    }
    if (registration.status === "WITHDRAWN" || registration.status === "DISQUALIFIED") {
      throw new ConflictError("Cette inscription n'est plus active.");
    }
    if (registration.checkIn) {
      throw new ConflictError("Ce participant est déjà check-in.");
    }

    const updated = await tx.registration.update({
      where: { id: registrationId },
      data: {
        status: "CHECKED_IN",
        checkIn: { create: { checkedInById: staffUserId } },
      },
      include: { player: true, team: true, checkIn: true },
    });

    await recordAudit(tx, {
      actorUserId: staffUserId,
      tournamentId: registration.tournamentId,
      action: "REGISTRATION_CHECKED_IN",
      entityType: "Registration",
      entityId: registrationId,
      afterData: updated,
    });

    return updated;
  }).then((updated) => {
    emitToRoom(tournamentRoom(updated.tournamentId), { type: "bracket:updated", tournamentId: updated.tournamentId });
    return updated;
  });
}

export async function withdrawRegistration(registrationId: string, actorUserId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({
      where: { id: registrationId },
      include: { tournament: true },
    });
    if (!registration) {
      throw new NotFoundError("Inscription introuvable.");
    }
    // Le bracket est généré au lancement du tournoi : retirer un participant après coup
    // casserait la structure. Passé ce point, seul un forfait au niveau du match est possible.
    if (registration.tournament.status === "IN_PROGRESS" || registration.tournament.status === "COMPLETED") {
      throw new ConflictError("Impossible de retirer un participant une fois le tournoi lancé.");
    }

    const updated = await tx.registration.update({
      where: { id: registrationId },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    });

    await recordAudit(tx, {
      actorUserId,
      tournamentId: registration.tournamentId,
      action: "REGISTRATION_WITHDRAWN",
      entityType: "Registration",
      entityId: registrationId,
      beforeData: { status: registration.status },
      afterData: { status: "WITHDRAWN", reason },
      metadata: reason ? { reason } : {},
    });

    return updated;
  }).then((updated) => {
    emitToRoom(tournamentRoom(updated.tournamentId), { type: "bracket:updated", tournamentId: updated.tournamentId });
    return updated;
  });
}

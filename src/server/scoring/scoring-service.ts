import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { recordAudit } from "@/server/audit/audit-service";
import { emitToRoom } from "@/lib/realtime/emitter";
import { matchRoom, tournamentRoom } from "@/lib/realtime/events";
import { handleMatchCompletion } from "@/server/brackets/progression-service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { applyX01Throw, START_SCORE_BY_GAME_TYPE } from "@/server/scoring/x01.engine";
import { applyCricketThrow, type CricketTurn } from "@/server/scoring/cricket.engine";
import type { ThrowInput } from "@/server/scoring/game-engine.interface";

type Tx = Prisma.TransactionClient;

export interface SubmitThrowInput extends ThrowInput {
  registrationId: string;
  expectedLegVersion: number;
}

export interface ThrowOutcome {
  legCompleted: boolean;
  matchCompleted: boolean;
  tournamentId: string;
  matchId: string;
  legId: string;
  winnerRegistrationId?: string;
}

/**
 * Démarre effectivement un match (READY -> IN_PROGRESS) et crée le premier leg.
 * Le premier joueur à lancer est registrationA par convention ; l'alternance ensuite
 * suit la règle standard (perdant du leg précédent relance, approximée ici par une
 * simple alternance stricte par numéro de leg — suffisant pour un usage bar en V1).
 */
export async function startMatch(matchId: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: { tournament: { include: { scoringRules: true } } } });
    if (match.status !== "READY") {
      throw new ConflictError("Le match doit être prêt (les deux participants connus) pour démarrer.");
    }
    if (!match.registrationAId || !match.registrationBId) {
      throw new ValidationError("Les deux participants doivent être connus pour démarrer le match.");
    }

    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });

    const leg = await tx.matchGame.create({
      data: {
        matchId,
        setNumber: 1,
        legNumber: 1,
        startingRegistrationId: match.registrationAId,
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    await recordAudit(tx, {
      actorUserId,
      tournamentId: match.tournamentId,
      action: "MATCH_STARTED",
      entityType: "Match",
      entityId: matchId,
    });

    return { match: updatedMatch, leg };
  });
}

async function getExpectedTurnRegistration(
  tx: Tx,
  leg: { id: string; startingRegistrationId: string | null; match: { registrationAId: string | null; registrationBId: string | null } },
): Promise<string | null> {
  const lastEntry = await tx.scoreEntry.findFirst({
    where: { legId: leg.id, isInvalidated: false },
    orderBy: { turnNumber: "desc" },
  });
  if (!lastEntry) return leg.startingRegistrationId;
  return lastEntry.registrationId === leg.match.registrationAId ? leg.match.registrationBId : leg.match.registrationAId;
}

async function getLastAcceptedEntry(tx: Tx, legId: string, registrationId: string) {
  return tx.scoreEntry.findFirst({
    where: { legId, registrationId, isInvalidated: false, isBust: false },
    orderBy: { turnNumber: "desc" },
  });
}

export async function submitThrow(legId: string, input: SubmitThrowInput, actorUserId: string) {
  const outcome = await prisma.$transaction(async (tx): Promise<ThrowOutcome> => {
    const leg = await tx.matchGame.findUniqueOrThrow({
      where: { id: legId },
      include: { match: { include: { tournament: { include: { scoringRules: true } } } } },
    });

    if (leg.status !== "IN_PROGRESS") {
      throw new ConflictError("Ce leg n'est pas en cours.");
    }
    if (leg.version !== input.expectedLegVersion) {
      throw new ConflictError("Ce leg a été modifié entre temps par un autre appareil. Rechargez et réessayez.");
    }
    if (input.registrationId !== leg.match.registrationAId && input.registrationId !== leg.match.registrationBId) {
      throw new ValidationError("Ce participant ne fait pas partie de ce match.");
    }

    // Garde-fou métier : impose la stricte alternance des lancers, pour éviter
    // qu'un mauvais tap dans l'interface n'enregistre un tour pour le mauvais joueur.
    const expectedRegistrationId = await getExpectedTurnRegistration(tx, leg);
    if (input.registrationId !== expectedRegistrationId) {
      throw new ConflictError("Ce n'est pas le tour de ce participant.");
    }

    const rules = leg.match.tournament.scoringRules;
    if (!rules) {
      throw new ValidationError("Règles de scoring introuvables pour ce tournoi.");
    }

    const turnNumber = (await tx.scoreEntry.count({ where: { legId, isInvalidated: false } })) + 1;

    if (rules.gameType === "CRICKET") {
      const priorEntries = await tx.scoreEntry.findMany({
        where: { legId, isInvalidated: false },
        orderBy: { turnNumber: "asc" },
      });
      const priorTurns: CricketTurn[] = priorEntries.map((e) => ({
        registrationId: e.registrationId,
        cricketMarks: (e.cricketMarks as Record<string, number>) ?? {},
      }));
      const registrationIds: [string, string] = [leg.match.registrationAId!, leg.match.registrationBId!];
      const result = applyCricketThrow(priorTurns, registrationIds, input.registrationId, input);

      if (!result.accepted) {
        throw new ValidationError(result.rejectionReason ?? "Saisie invalide.");
      }

      const entry = await tx.scoreEntry.create({
        data: {
          legId,
          registrationId: input.registrationId,
          turnNumber,
          scoreValue: 0,
          dartsUsed: input.dartsUsed,
          remainingAfter: 0,
          cricketMarks: input.cricketMarks ?? {},
          isBust: false,
          isCheckout: result.legWon,
          createdById: actorUserId,
        },
      });

      await tx.matchGame.update({ where: { id: legId }, data: { version: { increment: 1 } } });

      if (result.legWon) {
        return finalizeLeg(tx, leg.matchId, legId, input.registrationId, actorUserId);
      }
      return { legCompleted: false, matchCompleted: false, tournamentId: leg.match.tournamentId, matchId: leg.matchId, legId };
    }

    // X01 (501/301)
    const startScore = START_SCORE_BY_GAME_TYPE[rules.gameType as "X501" | "X301"];
    const lastEntry = await getLastAcceptedEntry(tx, legId, input.registrationId);
    const remainingBefore = lastEntry ? lastEntry.remainingAfter : startScore;

    const result = applyX01Throw(remainingBefore, rules, input);
    if (!result.accepted) {
      throw new ValidationError(result.rejectionReason ?? "Saisie invalide.");
    }

    await tx.scoreEntry.create({
      data: {
        legId,
        registrationId: input.registrationId,
        turnNumber,
        scoreValue: input.scoreValue ?? 0,
        dartsUsed: input.dartsUsed,
        remainingAfter: result.remainingAfter,
        isBust: result.isBust,
        isCheckout: result.isCheckout,
        createdById: actorUserId,
      },
    });

    await tx.matchGame.update({ where: { id: legId }, data: { version: { increment: 1 } } });

    if (result.legWon) {
      return finalizeLeg(tx, leg.matchId, legId, input.registrationId, actorUserId);
    }
    return { legCompleted: false, matchCompleted: false, tournamentId: leg.match.tournamentId, matchId: leg.matchId, legId };
  });

  emitToRoom(matchRoom(outcome.matchId), { type: "match:score-updated", matchId: outcome.matchId, legId: outcome.legId, remaining: {} });
  if (outcome.legCompleted) {
    emitToRoom(tournamentRoom(outcome.tournamentId), {
      type: "match:leg-completed",
      matchId: outcome.matchId,
      legId: outcome.legId,
      winnerRegistrationId: outcome.winnerRegistrationId ?? "",
    });
  }

  if (outcome.matchCompleted) {
    await handleMatchCompletion(outcome.matchId, actorUserId);
  }

  return outcome;
}

/**
 * Un leg vient d'être gagné : détermine si le set, puis le match, sont eux aussi
 * terminés (best-of legs par set, best-of sets par match), et enchaîne
 * automatiquement sur le leg/set suivant sinon.
 */
async function finalizeLeg(
  tx: Tx,
  matchId: string,
  legId: string,
  winnerRegistrationId: string,
  actorUserId: string,
): Promise<ThrowOutcome> {
  const leg = await tx.matchGame.findUniqueOrThrow({ where: { id: legId } });
  await tx.matchGame.update({
    where: { id: legId },
    data: { status: "COMPLETED", winnerRegistrationId, completedAt: new Date() },
  });

  const match = await tx.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { tournament: { include: { scoringRules: true } } },
  });
  const rules = match.tournament.scoringRules!;

  const legsInSet = await tx.matchGame.findMany({ where: { matchId, setNumber: leg.setNumber } });
  const legsWonInSet = (regId: string) => legsInSet.filter((l) => l.winnerRegistrationId === regId).length;

  const regA = match.registrationAId!;
  const regB = match.registrationBId!;
  const setWinner =
    legsWonInSet(regA) >= rules.legsToWinSet ? regA : legsWonInSet(regB) >= rules.legsToWinSet ? regB : null;

  if (!setWinner) {
    // Le set continue : leg suivant, alternance stricte du joueur qui débute.
    const nextStarting = leg.startingRegistrationId === regA ? regB : regA;
    await tx.matchGame.create({
      data: {
        matchId,
        setNumber: leg.setNumber,
        legNumber: leg.legNumber + 1,
        startingRegistrationId: nextStarting,
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      actorUserId,
      tournamentId: match.tournamentId,
      action: "LEG_COMPLETED",
      entityType: "MatchGame",
      entityId: legId,
      afterData: { winnerRegistrationId },
    });
    return {
      legCompleted: true,
      matchCompleted: false,
      tournamentId: match.tournamentId,
      matchId,
      legId,
      winnerRegistrationId,
    };
  }

  // Set déterminé : compte les sets gagnés sur tout le match.
  const allLegs = await tx.matchGame.findMany({ where: { matchId } });
  const setsWon = (regId: string) => {
    const setNumbers = new Set(allLegs.map((l) => l.setNumber));
    let count = 0;
    for (const setNumber of setNumbers) {
      const legsOfSet = allLegs.filter((l) => l.setNumber === setNumber);
      if (legsOfSet.filter((l) => l.winnerRegistrationId === regId).length >= rules.legsToWinSet) count++;
    }
    return count;
  };

  const matchWinner =
    setsWon(regA) >= rules.setsToWinMatch ? regA : setsWon(regB) >= rules.setsToWinMatch ? regB : null;

  if (!matchWinner) {
    // Set suivant : nouveau leg 1, celui qui a perdu le set précédent débute (alternance simple).
    const nextStarting = leg.startingRegistrationId === regA ? regB : regA;
    await tx.matchGame.create({
      data: {
        matchId,
        setNumber: leg.setNumber + 1,
        legNumber: 1,
        startingRegistrationId: nextStarting,
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      actorUserId,
      tournamentId: match.tournamentId,
      action: "SET_COMPLETED",
      entityType: "Match",
      entityId: matchId,
      afterData: { setWinner },
    });
    return {
      legCompleted: true,
      matchCompleted: false,
      tournamentId: match.tournamentId,
      matchId,
      legId,
      winnerRegistrationId,
    };
  }

  const loserRegistrationId = matchWinner === regA ? regB : regA;
  await tx.match.update({
    where: { id: matchId },
    data: {
      status: "COMPLETED",
      winnerRegistrationId: matchWinner,
      loserRegistrationId,
      completedAt: new Date(),
    },
  });

  await recordAudit(tx, {
    actorUserId,
    tournamentId: match.tournamentId,
    action: "MATCH_COMPLETED",
    entityType: "Match",
    entityId: matchId,
    afterData: { winnerRegistrationId: matchWinner },
  });

  return {
    legCompleted: true,
    matchCompleted: true,
    tournamentId: match.tournamentId,
    matchId,
    legId,
    winnerRegistrationId,
  };
}

export interface CorrectLastThrowInput {
  scoreValue?: number;
  dartsUsed: number;
  cricketMarks?: Record<string, number>;
  lastDartWasDouble?: boolean;
  lastDartWasTriple?: boolean;
  reason: string;
}

/**
 * Corrige la DERNIÈRE saisie d'un leg (cas d'usage réel : le staff se trompe et le
 * remarque immédiatement). Corriger une saisie plus ancienne, ou un match déjà
 * terminé, sort du périmètre V1 (cf. plan) : ça éviterait de devoir rejouer toute
 * la cascade de propagation déjà déclenchée. Historique intégral conservé
 * (isInvalidated + correctsEntryId), jamais de suppression physique.
 */
export async function correctLastThrow(legId: string, input: CorrectLastThrowInput, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const leg = await tx.matchGame.findUniqueOrThrow({
      where: { id: legId },
      include: { match: { include: { tournament: { include: { scoringRules: true } } } } },
    });

    if (leg.status === "COMPLETED") {
      throw new ConflictError(
        "Ce leg est déjà terminé : la correction d'un tour décisif n'est plus possible une fois le match validé.",
      );
    }

    const lastEntry = await tx.scoreEntry.findFirst({
      where: { legId, isInvalidated: false },
      orderBy: { turnNumber: "desc" },
    });
    if (!lastEntry) {
      throw new NotFoundError("Aucune saisie à corriger sur ce leg.");
    }

    const rules = leg.match.tournament.scoringRules!;
    const previousEntry = await tx.scoreEntry.findFirst({
      where: { legId, registrationId: lastEntry.registrationId, isInvalidated: false, turnNumber: { lt: lastEntry.turnNumber } },
      orderBy: { turnNumber: "desc" },
    });

    let result;
    if (rules.gameType === "CRICKET") {
      const priorEntries = await tx.scoreEntry.findMany({
        where: { legId, isInvalidated: false, id: { not: lastEntry.id } },
        orderBy: { turnNumber: "asc" },
      });
      const priorTurns: CricketTurn[] = priorEntries.map((e) => ({
        registrationId: e.registrationId,
        cricketMarks: (e.cricketMarks as Record<string, number>) ?? {},
      }));
      result = applyCricketThrow(
        priorTurns,
        [leg.match.registrationAId!, leg.match.registrationBId!],
        lastEntry.registrationId,
        input,
      );
    } else {
      const startScore = START_SCORE_BY_GAME_TYPE[rules.gameType as "X501" | "X301"];
      const remainingBefore = previousEntry ? previousEntry.remainingAfter : startScore;
      result = applyX01Throw(remainingBefore, rules, input);
    }

    if (!result.accepted) {
      throw new ValidationError(result.rejectionReason ?? "Correction invalide.");
    }
    if (result.legWon) {
      throw new ConflictError(
        "Cette correction ferait gagner le leg : utilisez la saisie normale plutôt qu'une correction pour ce cas.",
      );
    }

    await tx.scoreEntry.update({ where: { id: lastEntry.id }, data: { isInvalidated: true } });

    const corrected = await tx.scoreEntry.create({
      data: {
        legId,
        registrationId: lastEntry.registrationId,
        turnNumber: lastEntry.turnNumber,
        scoreValue: input.scoreValue ?? 0,
        dartsUsed: input.dartsUsed,
        remainingAfter: result.remainingAfter,
        cricketMarks: input.cricketMarks ?? undefined,
        isBust: result.isBust,
        isCheckout: false,
        createdById: actorUserId,
        correctsEntryId: lastEntry.id,
        correctionReason: input.reason,
      },
    });

    await recordAudit(tx, {
      actorUserId,
      tournamentId: leg.match.tournamentId,
      action: "SCORE_CORRECTED",
      entityType: "ScoreEntry",
      entityId: lastEntry.id,
      beforeData: lastEntry,
      afterData: corrected,
      metadata: { reason: input.reason },
    });

    return { entry: corrected, matchId: leg.matchId };
  }).then(({ entry, matchId }) => {
    emitToRoom(matchRoom(matchId), { type: "match:score-updated", matchId, legId: entry.legId, remaining: {} });
    return entry;
  });
}

export async function getActiveLeg(matchId: string) {
  const leg = await prisma.matchGame.findFirst({ where: { matchId, status: "IN_PROGRESS" } });
  if (!leg) {
    throw new NotFoundError("Aucun leg en cours pour ce match.");
  }
  return leg;
}

export async function getMatchForScoring(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { include: { scoringRules: true } },
      registrationA: { include: { player: true, team: true } },
      registrationB: { include: { player: true, team: true } },
      legs: {
        orderBy: [{ setNumber: "asc" }, { legNumber: "asc" }],
        include: { scoreEntries: { where: { isInvalidated: false }, orderBy: { turnNumber: "asc" } } },
      },
    },
  });
  if (!match) {
    throw new NotFoundError("Match introuvable.");
  }
  return match;
}

export async function listMatchesForStaff(tournamentId?: string) {
  return prisma.match.findMany({
    where: {
      status: { in: ["READY", "IN_PROGRESS"] },
      tournament: { status: "IN_PROGRESS" },
      ...(tournamentId ? { tournamentId } : {}),
    },
    include: {
      tournament: { select: { id: true, name: true } },
      registrationA: { include: { player: true, team: true } },
      registrationB: { include: { player: true, team: true } },
      round: true,
    },
    orderBy: [{ status: "desc" }, { createdAt: "asc" }],
  });
}

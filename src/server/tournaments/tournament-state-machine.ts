import type { Registration, ScoringRules, Tournament, TournamentRound, TournamentStatus } from "@prisma/client";

export const TOURNAMENT_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT: ["REGISTRATION_OPEN", "CANCELLED"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "CANCELLED"],
  // Retour arrière autorisé : rouvrir les inscriptions avant le lancement effectif du tournoi.
  REGISTRATION_CLOSED: ["IN_PROGRESS", "REGISTRATION_OPEN", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export interface TournamentForGuard extends Tournament {
  scoringRules: ScoringRules | null;
  registrations: Registration[];
  rounds: TournamentRound[];
}

export interface TransitionContext {
  tournament: TournamentForGuard;
  targetStatus: TournamentStatus;
}

export type GuardResult = { ok: true } | { ok: false; errors: string[] };

const IMPLEMENTED_FORMATS = new Set(["ROUND_ROBIN", "SINGLE_ELIMINATION"]);

/**
 * Un seul garde par transition cible. Appelé exclusivement par
 * tournament-service.ts::changeTournamentStatus() — jamais directement.
 */
export function guardTransition(ctx: TransitionContext): GuardResult {
  const { tournament, targetStatus } = ctx;
  const allowed = TOURNAMENT_TRANSITIONS[tournament.status] ?? [];
  if (!allowed.includes(targetStatus)) {
    return { ok: false, errors: [`Transition ${tournament.status} -> ${targetStatus} interdite.`] };
  }

  switch (targetStatus) {
    case "REGISTRATION_OPEN": {
      if (!tournament.scoringRules) {
        return { ok: false, errors: ["Les règles de scoring doivent être configurées avant d'ouvrir les inscriptions."] };
      }
      return { ok: true };
    }

    case "REGISTRATION_CLOSED":
      return { ok: true };

    case "IN_PROGRESS": {
      const errors: string[] = [];
      const checkedIn = tournament.registrations.filter((r) => r.status === "CHECKED_IN");
      if (checkedIn.length < tournament.minParticipants) {
        errors.push(`Minimum ${tournament.minParticipants} participants check-in requis (actuel: ${checkedIn.length}).`);
      }
      if (!IMPLEMENTED_FORMATS.has(tournament.format)) {
        errors.push("Ce format n'est pas encore implémenté (prévu dans une itération suivante).");
      }
      return errors.length ? { ok: false, errors } : { ok: true };
    }

    case "COMPLETED": {
      const finalRound = [...tournament.rounds].sort((a, b) => a.roundNumber - b.roundNumber).at(-1);
      if (!finalRound || finalRound.status !== "COMPLETED") {
        return { ok: false, errors: ["Le round final du tournoi n'est pas terminé."] };
      }
      return { ok: true };
    }

    case "CANCELLED":
      return { ok: true };

    default:
      return { ok: true };
  }
}

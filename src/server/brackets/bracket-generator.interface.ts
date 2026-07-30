import type { Registration, RoundPhase, Tournament } from "@prisma/client";

export interface GenerateBracketInput {
  tournament: Tournament;
  // Uniquement les inscriptions CHECKED_IN — un participant qui ne s'est pas
  // présenté au bar ne peut pas se retrouver dans un match.
  checkedInRegistrations: Registration[];
  formatConfig: Record<string, unknown>;
}

export interface GeneratedMatch {
  // Index local au round, sert à retrouver la ligne après insertion en base.
  localIndex: number;
  registrationAId: string | null;
  registrationBId: string | null;
  groupName?: string;
  bracketSlot?: number;
  // Référence logique vers le match qui recevra le gagnant : { roundIndex, localIndex }
  // dans le tableau `rounds` retourné — résolu en vrais nextMatchId après insertion.
  feedsIntoRoundIndex?: number;
  feedsIntoLocalIndex?: number;
  feedsIntoSlot?: 1 | 2;
  // Bye : un seul côté rempli, le match est auto-résolu (WALKOVER) dès la génération.
  isBye?: boolean;
}

export interface GeneratedRound {
  phase: RoundPhase;
  roundNumber: number;
  name: string;
  matches: GeneratedMatch[];
}

export interface ProgressionContext {
  tournamentId: string;
  format: Tournament["format"];
  completedMatchId: string;
}

export interface ProgressionResult {
  // Mises à jour à appliquer aux matchs affectés par la complétion (propagation du
  // gagnant vers le match suivant, le cas échéant).
  matchesToUpdate: Array<{ matchId: string; registrationAId?: string; registrationBId?: string }>;
  roundToCompleteId?: string;
  roundToActivateId?: string;
  tournamentComplete: boolean;
}

export interface StandingEntry {
  registrationId: string;
  rank: number;
  points: number;
  wins: number;
  losses: number;
  legsWon: number;
  legsLost: number;
  tieBreakScore: number;
}

/**
 * Interface commune à tous les générateurs de format (pattern Strategy). Round Robin
 * et Single Elimination l'implémentent en V1 ; Double Elimination/League/Custom sont
 * enregistrés comme stubs qui lèvent une erreur explicite si sollicités (cf.
 * bracket-registry.ts). Ajouter un format plus tard = implémenter cette interface +
 * l'enregistrer, sans toucher au reste (service tournoi, UI bracket).
 */
export interface BracketGenerator {
  readonly format: Tournament["format"];
  generateInitialRounds(input: GenerateBracketInput): GeneratedRound[];
}

import type { GameType, InOutMode } from "@prisma/client";

export interface ScoringRulesConfig {
  gameType: GameType;
  inMode: InOutMode;
  outMode: InOutMode;
}

export interface ThrowInput {
  // X01 uniquement : points marqués ce tour (0-180).
  scoreValue?: number;
  dartsUsed: number;
  // Cricket uniquement : marques posées CE tour, ex: { "20": 3, "BULL": 1 }.
  cricketMarks?: Record<string, number>;
  // Requis pour valider un checkout en mode DOUBLE/MASTER.
  lastDartWasDouble?: boolean;
  lastDartWasTriple?: boolean;
}

export interface ApplyThrowResult {
  accepted: boolean;
  isBust: boolean;
  isCheckout: boolean;
  // X01 : score restant après ce tour (0 si checkout, inchangé si bust). Cricket : 0 (non pertinent).
  remainingAfter: number;
  legWon: boolean;
  rejectionReason?: string;
}

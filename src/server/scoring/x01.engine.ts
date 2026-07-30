import type { ApplyThrowResult, ScoringRulesConfig, ThrowInput } from "@/server/scoring/game-engine.interface";

export const START_SCORE_BY_GAME_TYPE = {
  X501: 501,
  X301: 301,
} as const;

/**
 * Fonction pure : ne dépend que du score restant AVANT ce tour (recalculé par
 * scoring-service à partir de la dernière ScoreEntry acceptée, jamais d'un état en
 * mémoire). Facile à tester exhaustivement, aucun effet de bord.
 */
export function applyX01Throw(remainingBefore: number, rules: ScoringRulesConfig, input: ThrowInput): ApplyThrowResult {
  const scoreValue = input.scoreValue ?? 0;

  if (scoreValue < 0 || scoreValue > 180) {
    return {
      accepted: false,
      isBust: false,
      isCheckout: false,
      remainingAfter: remainingBefore,
      legWon: false,
      rejectionReason: "Le score d'un tour doit être compris entre 0 et 180.",
    };
  }
  if (input.dartsUsed < 1 || input.dartsUsed > 3) {
    return {
      accepted: false,
      isBust: false,
      isCheckout: false,
      remainingAfter: remainingBefore,
      legWon: false,
      rejectionReason: "Le nombre de fléchettes doit être compris entre 1 et 3.",
    };
  }

  const after = remainingBefore - scoreValue;

  // Bust : score négatif, ou tombe à 1 alors que la sortie ne peut se faire que sur
  // une double/master (1 est infinissable dans ces modes).
  if (after < 0 || (after === 1 && rules.outMode !== "STRAIGHT")) {
    return { accepted: true, isBust: true, isCheckout: false, remainingAfter: remainingBefore, legWon: false };
  }

  if (after === 0) {
    const validCheckout =
      rules.outMode === "STRAIGHT" ||
      (rules.outMode === "DOUBLE" && input.lastDartWasDouble) ||
      (rules.outMode === "MASTER" && (input.lastDartWasDouble || input.lastDartWasTriple));

    if (!validCheckout) {
      // Score tombé à 0 mais dernière fléchette invalide pour le mode configuré : bust.
      return { accepted: true, isBust: true, isCheckout: false, remainingAfter: remainingBefore, legWon: false };
    }
    return { accepted: true, isBust: false, isCheckout: true, remainingAfter: 0, legWon: true };
  }

  return { accepted: true, isBust: false, isCheckout: false, remainingAfter: after, legWon: false };
}

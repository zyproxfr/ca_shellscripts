import type { TieBreakRule } from "@prisma/client";

export interface TieBreakInputs {
  legDifference: number;
  average: number;
}

/**
 * Valeur numérique de départage : plus c'est grand, mieux c'est classé. HEAD_TO_HEAD
 * n'est pas réductible à un simple nombre comparable globalement (c'est relatif à un
 * adversaire précis) — en V1 on le retombe sur la différence de legs comme
 * approximation raisonnable pour le tri global, la confrontation directe stricte
 * entre deux egos est un raffinement possible pour une itération suivante.
 */
export function tieBreakValue(rule: TieBreakRule, inputs: TieBreakInputs): number {
  switch (rule) {
    case "POINTS_AVERAGE":
      return inputs.average;
    case "LEG_DIFFERENCE":
    case "HEAD_TO_HEAD":
    case "RANDOM_DRAW":
    default:
      return inputs.legDifference;
  }
}

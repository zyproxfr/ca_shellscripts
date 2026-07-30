import type { ApplyThrowResult, ThrowInput } from "@/server/scoring/game-engine.interface";

export const CRICKET_NUMBERS = ["20", "19", "18", "17", "16", "15", "BULL"] as const;
export type CricketNumber = (typeof CRICKET_NUMBERS)[number];

const NUMBER_VALUE: Record<CricketNumber, number> = {
  "20": 20,
  "19": 19,
  "18": 18,
  "17": 17,
  "16": 16,
  "15": 15,
  BULL: 25,
};

export interface CricketTurn {
  registrationId: string;
  cricketMarks: Record<string, number>;
}

export interface CricketPlayerState {
  marks: Record<CricketNumber, number>;
  score: number;
  closed: boolean;
}

function emptyMarks(): Record<CricketNumber, number> {
  return { "20": 0, "19": 0, "18": 0, "17": 0, "16": 0, "15": 0, BULL: 0 };
}

/**
 * Recalcule l'état complet du leg (marques posées, score, numéros fermés) à partir
 * de l'historique des tours — pas d'état en mémoire, tout repart des ScoreEntry
 * persistées (voir scoring-service.ts). Les marques au-delà de 3 sur un numéro ne
 * rapportent des points que si l'adversaire n'a pas encore fermé ce numéro.
 */
export function computeCricketLegState(
  turns: CricketTurn[],
  registrationIds: [string, string],
): Record<string, CricketPlayerState> {
  const state: Record<string, CricketPlayerState> = {
    [registrationIds[0]]: { marks: emptyMarks(), score: 0, closed: false },
    [registrationIds[1]]: { marks: emptyMarks(), score: 0, closed: false },
  };

  for (const turn of turns) {
    const opponentId = registrationIds.find((id) => id !== turn.registrationId);
    if (!opponentId) continue;
    const player = state[turn.registrationId]!;
    const opponent = state[opponentId]!;

    for (const [numberKey, count] of Object.entries(turn.cricketMarks)) {
      if (!isCricketNumber(numberKey) || count <= 0) continue;
      const before = player.marks[numberKey];
      const after = before + count;
      player.marks[numberKey] = after;

      const scoringMarks = Math.max(0, after - Math.max(before, 3));
      if (scoringMarks > 0 && opponent.marks[numberKey] < 3) {
        player.score += scoringMarks * NUMBER_VALUE[numberKey];
      }
    }
  }

  for (const id of registrationIds) {
    state[id]!.closed = CRICKET_NUMBERS.every((n) => state[id]!.marks[n] >= 3);
  }

  return state;
}

function isCricketNumber(value: string): value is CricketNumber {
  return (CRICKET_NUMBERS as readonly string[]).includes(value);
}

export function applyCricketThrow(
  priorTurns: CricketTurn[],
  registrationIds: [string, string],
  registrationId: string,
  input: ThrowInput,
): ApplyThrowResult {
  const marks = input.cricketMarks ?? {};
  const totalMarks = Object.values(marks).reduce((sum, v) => sum + v, 0);
  if (totalMarks > input.dartsUsed * 3) {
    return {
      accepted: false,
      isBust: false,
      isCheckout: false,
      remainingAfter: 0,
      legWon: false,
      rejectionReason: "Nombre de marques incohérent avec le nombre de fléchettes lancées.",
    };
  }
  for (const key of Object.keys(marks)) {
    if (!isCricketNumber(key)) {
      return {
        accepted: false,
        isBust: false,
        isCheckout: false,
        remainingAfter: 0,
        legWon: false,
        rejectionReason: `Numéro de cricket invalide : ${key}.`,
      };
    }
  }

  const stateAfter = computeCricketLegState([...priorTurns, { registrationId, cricketMarks: marks }], registrationIds);
  const opponentId = registrationIds.find((id) => id !== registrationId)!;
  const player = stateAfter[registrationId]!;
  const opponent = stateAfter[opponentId]!;

  const legWon = player.closed && player.score >= opponent.score;

  return { accepted: true, isBust: false, isCheckout: false, remainingAfter: 0, legWon };
}

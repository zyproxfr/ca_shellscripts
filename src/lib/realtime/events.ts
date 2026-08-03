// Événements temps réel serveur -> client. Chaque payload transporte l'état complet
// de l'entité affectée (jamais un delta) pour rester robuste à un événement perdu ou
// reçu dans le désordre : le client peut toujours simplement remplacer son état local.

export type RealtimeEvent =
  | { type: "match:score-updated"; matchId: string; legId: string; remaining: Record<string, number> }
  | { type: "match:leg-completed"; matchId: string; legId: string; winnerRegistrationId: string }
  | { type: "match:completed"; matchId: string; winnerRegistrationId: string }
  | { type: "round:started"; tournamentId: string; roundId: string }
  | { type: "round:completed"; tournamentId: string; roundId: string }
  | { type: "bracket:updated"; tournamentId: string }
  | { type: "ranking:updated"; tournamentId: string }
  | { type: "tournament:status-changed"; tournamentId: string; status: string }
  | { type: "board:status-changed"; boardId: string; status: string; matchId?: string };

export function tournamentRoom(tournamentId: string) {
  return `tournament:${tournamentId}`;
}

export function matchRoom(matchId: string) {
  return `match:${matchId}`;
}

export function tvRoom(venueId: string) {
  return `tv:${venueId}`;
}

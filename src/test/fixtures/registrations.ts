import type { Registration } from "@prisma/client";

let counter = 0;

export function makeRegistration(overrides: Partial<Registration> = {}): Registration {
  counter += 1;
  return {
    id: overrides.id ?? `reg-${counter}`,
    tournamentId: overrides.tournamentId ?? "tournament-1",
    playerId: overrides.playerId ?? `player-${counter}`,
    teamId: overrides.teamId ?? null,
    seed: overrides.seed ?? null,
    status: overrides.status ?? "CHECKED_IN",
    registeredAt: overrides.registeredAt ?? new Date(2026, 0, 1, 0, 0, counter),
    withdrawnAt: overrides.withdrawnAt ?? null,
  };
}

export function makeRegistrations(count: number): Registration[] {
  return Array.from({ length: count }, (_, i) => makeRegistration({ id: `reg-${i + 1}`, seed: i + 1 }));
}

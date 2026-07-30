import { describe, expect, it } from "vitest";
import {
  guardTransition,
  TOURNAMENT_TRANSITIONS,
  type TournamentForGuard,
} from "@/server/tournaments/tournament-state-machine";
import type { TournamentStatus } from "@prisma/client";

const ALL_STATUSES: TournamentStatus[] = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

function baseTournament(overrides: Partial<TournamentForGuard> = {}): TournamentForGuard {
  return {
    id: "t1",
    venueId: "v1",
    name: "Test",
    description: null,
    format: "SINGLE_ELIMINATION",
    mode: "SOLO",
    status: "DRAFT",
    maxParticipants: null,
    minParticipants: 2,
    registrationDeadline: null,
    checkInOpensAt: null,
    startsAt: null,
    endsAt: null,
    tieBreakRule: "LEG_DIFFERENCE",
    formatConfig: {},
    createdById: "u1",
    cancelledReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    scoringRules: {
      id: "sr1",
      tournamentId: "t1",
      gameType: "X501",
      inMode: "STRAIGHT",
      outMode: "DOUBLE",
      legsToWinSet: 3,
      setsToWinMatch: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    registrations: [],
    rounds: [],
    ...overrides,
  };
}

describe("tournament-state-machine", () => {
  it("matrice exhaustive : seules les transitions déclarées sont autorisées (hors gardes métier)", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const declared = TOURNAMENT_TRANSITIONS[from].includes(to);
        const tournament = baseTournament({
          status: from,
          registrations: Array.from({ length: 2 }, (_, i) => ({
            id: `r${i}`,
            tournamentId: "t1",
            playerId: `p${i}`,
            teamId: null,
            seed: null,
            status: "CHECKED_IN" as const,
            registeredAt: new Date(),
            withdrawnAt: null,
          })),
          rounds: [{ id: "round1", tournamentId: "t1", phase: "FINAL" as const, roundNumber: 1, name: "Finale", status: "COMPLETED" as const, startedAt: new Date(), completedAt: new Date(), createdAt: new Date() }],
        });
        const result = guardTransition({ tournament, targetStatus: to });
        if (!declared) {
          expect(result.ok, `${from} -> ${to} devrait être refusé`).toBe(false);
        }
      }
    }
  });

  it("refuse REGISTRATION_OPEN sans règles de scoring configurées", () => {
    const tournament = baseTournament({ status: "DRAFT", scoringRules: null });
    const result = guardTransition({ tournament, targetStatus: "REGISTRATION_OPEN" });
    expect(result.ok).toBe(false);
  });

  it("refuse IN_PROGRESS sous le minimum de participants check-in", () => {
    const tournament = baseTournament({ status: "REGISTRATION_CLOSED", minParticipants: 4, registrations: [] });
    const result = guardTransition({ tournament, targetStatus: "IN_PROGRESS" });
    expect(result.ok).toBe(false);
  });

  it("refuse IN_PROGRESS pour un format non implémenté", () => {
    const tournament = baseTournament({
      status: "REGISTRATION_CLOSED",
      format: "DOUBLE_ELIMINATION",
      minParticipants: 2,
      registrations: [
        { id: "r1", tournamentId: "t1", playerId: "p1", teamId: null, seed: null, status: "CHECKED_IN", registeredAt: new Date(), withdrawnAt: null },
        { id: "r2", tournamentId: "t1", playerId: "p2", teamId: null, seed: null, status: "CHECKED_IN", registeredAt: new Date(), withdrawnAt: null },
      ],
    });
    const result = guardTransition({ tournament, targetStatus: "IN_PROGRESS" });
    expect(result.ok).toBe(false);
  });

  it("refuse COMPLETED si le round final n'est pas terminé", () => {
    const tournament = baseTournament({
      status: "IN_PROGRESS",
      rounds: [{ id: "round1", tournamentId: "t1", phase: "FINAL", roundNumber: 1, name: "Finale", status: "IN_PROGRESS", startedAt: new Date(), completedAt: null, createdAt: new Date() }],
    });
    const result = guardTransition({ tournament, targetStatus: "COMPLETED" });
    expect(result.ok).toBe(false);
  });

  it("autorise CANCELLED depuis n'importe quel état non terminal", () => {
    for (const status of ["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS"] as TournamentStatus[]) {
      const tournament = baseTournament({ status });
      expect(guardTransition({ tournament, targetStatus: "CANCELLED" }).ok).toBe(true);
    }
  });
});

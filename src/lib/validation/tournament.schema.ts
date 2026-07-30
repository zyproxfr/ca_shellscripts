import { z } from "zod";

export const createTournamentSchema = z.object({
  venueId: z.string().min(1, "Établissement requis."),
  name: z.string().trim().min(3, "Le nom doit contenir au moins 3 caractères.").max(120),
  description: z.string().trim().max(2000).optional(),
  format: z.enum(["ROUND_ROBIN", "SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "LEAGUE", "CUSTOM"]),
  mode: z.enum(["SOLO", "TEAM"]),
  maxParticipants: z.coerce.number().int().min(2).max(512).optional(),
  minParticipants: z.coerce.number().int().min(2).max(512).default(2),
  registrationDeadline: z.coerce.date().optional(),
  checkInOpensAt: z.coerce.date().optional(),
  startsAt: z.coerce.date().optional(),
  tieBreakRule: z
    .enum(["HEAD_TO_HEAD", "LEG_DIFFERENCE", "POINTS_AVERAGE", "RANDOM_DRAW"])
    .default("LEG_DIFFERENCE"),
  formatConfig: z.record(z.unknown()).default({}),
  scoringRules: z.object({
    gameType: z.enum(["X501", "X301", "CRICKET"]).default("X501"),
    inMode: z.enum(["STRAIGHT", "DOUBLE", "MASTER"]).default("STRAIGHT"),
    outMode: z.enum(["STRAIGHT", "DOUBLE", "MASTER"]).default("DOUBLE"),
    legsToWinSet: z.coerce.number().int().min(1).max(15).default(3),
    setsToWinMatch: z.coerce.number().int().min(1).max(9).default(1),
  }),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export const updateTournamentSchema = createTournamentSchema.partial().extend({
  scoringRules: createTournamentSchema.shape.scoringRules.partial().optional(),
});

export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;

export const tournamentStatusValues = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const changeTournamentStatusSchema = z.object({
  targetStatus: z.enum(tournamentStatusValues),
  cancelledReason: z.string().trim().max(500).optional(),
});

export type ChangeTournamentStatusInput = z.infer<typeof changeTournamentStatusSchema>;

import { z } from "zod";

const newPlayerSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis.").max(60),
  lastName: z.string().trim().min(1, "Nom requis.").max(60),
  phone: z.string().trim().max(30).optional(),
});

// Inscription solo : soit un joueur existant (playerId), soit création à la volée
// (cas fréquent au bar : le joueur n'est pas encore dans la base).
export const registerSoloSchema = z.object({
  tournamentId: z.string().min(1),
  playerId: z.string().min(1).optional(),
  newPlayer: newPlayerSchema.optional(),
  seed: z.coerce.number().int().min(1).optional(),
}).refine((data) => Boolean(data.playerId) !== Boolean(data.newPlayer), {
  message: "Fournir soit playerId, soit newPlayer, jamais les deux.",
});

export type RegisterSoloInput = z.infer<typeof registerSoloSchema>;

// Inscription équipe : équipe existante (teamId) ou nouvelle équipe (nom + membres,
// chaque membre étant lui-même soit un joueur existant, soit un nouveau joueur).
export const registerTeamSchema = z.object({
  tournamentId: z.string().min(1),
  teamId: z.string().min(1).optional(),
  newTeam: z
    .object({
      name: z.string().trim().min(2, "Nom d'équipe requis.").max(80),
      members: z
        .array(
          z.object({
            playerId: z.string().min(1).optional(),
            newPlayer: newPlayerSchema.optional(),
          }).refine((m) => Boolean(m.playerId) !== Boolean(m.newPlayer), {
            message: "Fournir soit playerId, soit newPlayer pour chaque membre.",
          }),
        )
        .min(1, "Une équipe doit avoir au moins un membre."),
    })
    .optional(),
  seed: z.coerce.number().int().min(1).optional(),
}).refine((data) => Boolean(data.teamId) !== Boolean(data.newTeam), {
  message: "Fournir soit teamId, soit newTeam, jamais les deux.",
});

export type RegisterTeamInput = z.infer<typeof registerTeamSchema>;

export const withdrawRegistrationSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

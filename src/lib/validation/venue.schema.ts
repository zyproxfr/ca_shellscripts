import { z } from "zod";

export const createVenueSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(120),
  address: z.string().trim().max(300).optional(),
  timezone: z.string().trim().min(1).default("Europe/Paris"),
});

export type CreateVenueInput = z.infer<typeof createVenueSchema>;

export const createBoardSchema = z.object({
  venueId: z.string().min(1, "Établissement requis."),
  label: z.string().trim().min(1, "Libellé requis.").max(50),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;

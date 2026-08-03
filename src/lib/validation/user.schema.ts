import { z } from "zod";

const staffRoleSchema = z.enum(["ADMIN", "STAFF"], {
  errorMap: () => ({ message: "Le rôle doit être Administrateur ou Staff." }),
});

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide."),
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(100),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
  role: staffRoleSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(100).optional(),
    role: staffRoleSchema.optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ doit être modifié.",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

import { z } from "zod";

export const submitThrowSchema = z.object({
  registrationId: z.string().min(1),
  expectedLegVersion: z.coerce.number().int().min(0),
  scoreValue: z.coerce.number().int().min(0).max(180).optional(),
  dartsUsed: z.coerce.number().int().min(1).max(3).default(3),
  cricketMarks: z.record(z.coerce.number().int().min(0).max(9)).optional(),
  lastDartWasDouble: z.boolean().optional(),
  lastDartWasTriple: z.boolean().optional(),
});

export type SubmitThrowInput = z.infer<typeof submitThrowSchema>;

export const correctLastThrowSchema = z.object({
  scoreValue: z.coerce.number().int().min(0).max(180).optional(),
  dartsUsed: z.coerce.number().int().min(1).max(3).default(3),
  cricketMarks: z.record(z.coerce.number().int().min(0).max(9)).optional(),
  lastDartWasDouble: z.boolean().optional(),
  lastDartWasTriple: z.boolean().optional(),
  reason: z.string().trim().min(3, "Merci de préciser brièvement la raison de la correction.").max(300),
});

export type CorrectLastThrowInput = z.infer<typeof correctLastThrowSchema>;

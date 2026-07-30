import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export interface RecordAuditInput {
  actorUserId: string | null;
  tournamentId?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Point d'écriture unique de l'audit trail. Toute mutation sensible (changement de
 * statut de tournoi, correction de score, suppression, check-in...) doit appeler
 * cette fonction dans la même transaction que la mutation elle-même.
 */
export async function recordAudit(tx: Tx, input: RecordAuditInput) {
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      tournamentId: input.tournamentId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeData: input.beforeData === undefined ? undefined : (input.beforeData as Prisma.InputJsonValue),
      afterData: input.afterData === undefined ? undefined : (input.afterData as Prisma.InputJsonValue),
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

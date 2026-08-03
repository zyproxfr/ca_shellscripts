import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { recordAudit } from "@/server/audit/audit-service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validation/user.schema";

const STAFF_ROLES: Role[] = ["ADMIN", "STAFF"];

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UserSnapshot = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
};

function sanitizeUserForAudit(user: UserSnapshot) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

async function countOtherActiveAdmins(excludeUserId: string) {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      id: { not: excludeUserId },
    },
  });
}

export async function listStaffUsers() {
  return prisma.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    select: userSelect,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function createUser(input: CreateUserInput, actorUserId: string) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("Un compte existe déjà avec cette adresse email.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role,
    },
    select: userSelect,
  });

  await recordAudit(prisma, {
    actorUserId,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    afterData: sanitizeUserForAudit(user),
  });

  return user;
}

export async function updateUser(userId: string, input: UpdateUserInput, actorUserId: string) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing || !STAFF_ROLES.includes(existing.role)) {
    throw new NotFoundError("Utilisateur introuvable.");
  }

  if (userId === actorUserId) {
    if (input.isActive === false) {
      throw new ValidationError("Vous ne pouvez pas désactiver votre propre compte.");
    }
    if (input.role !== undefined && input.role !== existing.role) {
      throw new ValidationError("Vous ne pouvez pas modifier votre propre rôle.");
    }
  }

  if (existing.role === "ADMIN" && existing.isActive) {
    const wouldLoseAdmin = input.role === "STAFF" || input.isActive === false;
    if (wouldLoseAdmin && (await countOtherActiveAdmins(userId)) === 0) {
      throw new ValidationError("Impossible de retirer le dernier administrateur actif.");
    }
  }

  const data: { name?: string; role?: Role; isActive?: boolean; passwordHash?: string } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: userSelect,
  });

  await recordAudit(prisma, {
    actorUserId,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: userId,
    beforeData: sanitizeUserForAudit(existing),
    afterData: sanitizeUserForAudit(updated),
    metadata: input.password ? { passwordChanged: true } : undefined,
  });

  return updated;
}

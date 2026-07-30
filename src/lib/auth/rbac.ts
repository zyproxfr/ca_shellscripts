import type { Session } from "next-auth";
import { getCurrentSession } from "@/lib/auth/session";
import { ForbiddenError, UnauthenticatedError } from "@/lib/utils/errors";

export type AppRole = "ADMIN" | "STAFF" | "PLAYER";

/**
 * Garde d'autorisation à appeler en première ligne de chaque server action / route
 * mutante. Convention imposée dans tout le code serveur : aucune mutation ne doit
 * accéder à Prisma sans être passée par ce garde au préalable.
 */
export async function requireRole(allowedRoles: AppRole[]): Promise<Session> {
  const session = await getCurrentSession();
  if (!session?.user) {
    throw new UnauthenticatedError();
  }
  if (!allowedRoles.includes(session.user.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export async function requireAnyAuthenticatedUser(): Promise<Session> {
  const session = await getCurrentSession();
  if (!session?.user) {
    throw new UnauthenticatedError();
  }
  return session;
}

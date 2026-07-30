import { PrismaClient } from "@prisma/client";

// Singleton PrismaClient : évite d'épuiser les connexions Postgres à cause du hot-reload
// de Next.js en développement (chaque rechargement de module recréerait un client sinon).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

import { prisma } from "@/lib/prisma/client";

export async function searchPlayers(query: string, limit = 10) {
  if (!query.trim()) return [];
  return prisma.player.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { lastName: "asc" },
  });
}

export async function searchTeams(query: string, limit = 10) {
  if (!query.trim()) return [];
  return prisma.team.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    include: { members: { include: { player: true } } },
    take: limit,
    orderBy: { name: "asc" },
  });
}

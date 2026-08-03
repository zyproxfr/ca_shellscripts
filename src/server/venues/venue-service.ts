import { prisma } from "@/lib/prisma/client";
import { ConflictError, NotFoundError } from "@/lib/utils/errors";
import type { CreateBoardInput, CreateVenueInput } from "@/lib/validation/venue.schema";

export async function listVenues() {
  return prisma.venue.findMany({
    include: { boards: true, _count: { select: { tournaments: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createVenue(input: CreateVenueInput) {
  const existing = await prisma.venue.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new ConflictError("Un établissement porte déjà ce nom.");
  }
  return prisma.venue.create({ data: input });
}

export async function createBoard(input: CreateBoardInput) {
  const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
  if (!venue) {
    throw new NotFoundError("Établissement introuvable.");
  }
  const existing = await prisma.board.findUnique({
    where: { venueId_label: { venueId: input.venueId, label: input.label } },
  });
  if (existing) {
    throw new ConflictError("Un plateau porte déjà ce libellé dans cet établissement.");
  }
  return prisma.board.create({ data: input });
}

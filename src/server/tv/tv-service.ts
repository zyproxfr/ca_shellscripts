import { prisma } from "@/lib/prisma/client";
import { NotFoundError } from "@/lib/utils/errors";

function label(side: { player: { displayName: string } | null; team: { name: string } | null } | null): string | null {
  if (!side) return null;
  return side.player?.displayName ?? side.team?.name ?? null;
}

/**
 * Projection publique pour l'écran TV du bar : le tournoi IN_PROGRESS le plus
 * récent de l'établissement (cas d'usage réel : une TV affiche un tournoi à la
 * fois), ses matchs en direct et le haut du classement. Aucune donnée sensible.
 */
export async function getTvState(venueId: string) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    throw new NotFoundError("Établissement introuvable.");
  }

  const tournament = await prisma.tournament.findFirst({
    where: { venueId, status: "IN_PROGRESS" },
    orderBy: { startsAt: "desc" },
  });

  if (!tournament) {
    return { venue: { id: venue.id, name: venue.name }, tournament: null, liveMatches: [], topRanking: [] };
  }

  const liveMatches = await prisma.match.findMany({
    where: { tournamentId: tournament.id, status: "IN_PROGRESS" },
    include: {
      registrationA: { include: { player: true, team: true } },
      registrationB: { include: { player: true, team: true } },
      board: true,
      legs: {
        where: { status: "IN_PROGRESS" },
        include: { scoreEntries: { where: { isInvalidated: false, isBust: false }, orderBy: { turnNumber: "desc" } } },
      },
    },
  });

  const topRanking = await prisma.ranking.findMany({
    where: { tournamentId: tournament.id },
    include: { registration: { include: { player: true, team: true } } },
    orderBy: { rank: "asc" },
    take: 8,
  });

  return {
    venue: { id: venue.id, name: venue.name },
    tournament: { id: tournament.id, name: tournament.name, format: tournament.format },
    liveMatches: liveMatches.map((match) => {
      const leg = match.legs[0];
      const remainingFor = (registrationId: string | null) => {
        if (!registrationId || !leg) return null;
        const last = leg.scoreEntries.find((e) => e.registrationId === registrationId);
        return last ? last.remainingAfter : null;
      };
      return {
        id: match.id,
        boardLabel: match.board?.label ?? null,
        registrationALabel: label(match.registrationA),
        registrationBLabel: label(match.registrationB),
        remainingA: remainingFor(match.registrationAId),
        remainingB: remainingFor(match.registrationBId),
      };
    }),
    topRanking: topRanking.map((r) => ({
      rank: r.rank,
      label: r.registration.player?.displayName ?? r.registration.team?.name ?? "?",
      points: r.points,
      wins: r.wins,
      losses: r.losses,
    })),
  };
}

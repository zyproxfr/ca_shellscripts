import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma/client";

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: {
      stats: true,
      registrations: {
        include: { tournament: { include: { venue: true } } },
        orderBy: { registeredAt: "desc" },
      },
    },
  });

  if (!player) notFound();

  const stats = player.stats;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">{player.displayName}</h1>
      </div>

      <div className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Tournois joués" value={stats?.tournamentsPlayed ?? 0} />
        <Stat label="Victoires" value={stats?.wins ?? 0} />
        <Stat label="Défaites" value={stats?.losses ?? 0} />
        <Stat label="Ratio victoire" value={stats ? `${Math.round(stats.winRatio * 100)}%` : "—"} />
        <Stat label="Moyenne" value={stats?.average.toFixed(2) ?? "—"} />
        <Stat label="Meilleur score" value={stats?.highestScore ?? 0} />
        <Stat label="180" value={stats?.count180 ?? 0} />
        <Stat label="140+" value={stats?.count140Plus ?? 0} />
      </div>

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">Historique des tournois</h2>
        <ul className="divide-y">
          {player.registrations.map((reg) => (
            <li key={reg.id} className="flex items-center justify-between py-3">
              <div>
                <Link href={`/tournaments/${reg.tournament.id}/ranking`} className="font-medium text-brand-700 hover:underline">
                  {reg.tournament.name}
                </Link>
                <p className="text-sm text-slate-500">
                  {reg.tournament.venue.name} · {new Date(reg.registeredAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <span className="text-sm text-slate-500">{reg.status}</span>
            </li>
          ))}
          {player.registrations.length === 0 && <p className="text-slate-500">Aucun tournoi pour l&apos;instant.</p>}
        </ul>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

"use client";

import Link from "next/link";
import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";

interface Side {
  player: { displayName: string } | null;
  team: { name: string } | null;
}

interface MatchListItem {
  id: string;
  status: string;
  tournament: { id: string; name: string };
  round: { name: string };
  registrationA: Side | null;
  registrationB: Side | null;
}

function label(side: Side | null): string {
  return side?.player?.displayName ?? side?.team?.name ?? "?";
}

const fetcher = (url: string) => apiFetch<MatchListItem[]>(url);

const STATUS_LABELS: Record<string, string> = {
  READY: "Prêt à démarrer",
  IN_PROGRESS: "En cours",
};

export default function StaffMatchesPage() {
  const { data: matches, error, isLoading } = useSWR("/api/matches", fetcher, { refreshInterval: 8000 });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Matchs à arbitrer</h1>

      {isLoading && <p>Chargement...</p>}
      {error && <p className="text-red-600">Impossible de charger les matchs.</p>}
      {matches?.length === 0 && <p className="text-slate-500">Aucun match prêt ou en cours pour l&apos;instant.</p>}

      <div className="space-y-3">
        {matches?.map((match) => (
          <Link
            key={match.id}
            href={`/staff/matches/${match.id}/score`}
            className="card flex items-center justify-between hover:ring-brand-300"
          >
            <div>
              <p className="text-lg font-semibold">
                {label(match.registrationA)} <span className="text-slate-400">vs</span> {label(match.registrationB)}
              </p>
              <p className="text-sm text-slate-500">
                {match.tournament.name} · {match.round.name}
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
              {STATUS_LABELS[match.status] ?? match.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";

interface TournamentListItem {
  id: string;
  name: string;
  status: string;
  format: string;
  mode: string;
  venue: { name: string };
  _count: { registrations: number };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  REGISTRATION_OPEN: "Inscriptions ouvertes",
  REGISTRATION_CLOSED: "Inscriptions fermées",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

const fetcher = (url: string) => apiFetch<TournamentListItem[]>(url);

export default function TournamentsListPage() {
  const { data: tournaments, error, isLoading } = useSWR("/api/tournaments", fetcher);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tournois</h1>
        <Link href="/admin/tournaments/new" className="btn-primary">
          + Nouveau tournoi
        </Link>
      </div>

      {isLoading && <p>Chargement...</p>}
      {error && <p className="text-red-600">Impossible de charger les tournois.</p>}

      <div className="space-y-3">
        {tournaments?.map((t) => (
          <Link key={t.id} href={`/admin/tournaments/${t.id}`} className="card block hover:ring-brand-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{t.name}</h2>
                <p className="text-sm text-slate-500">
                  {t.venue.name} · {t.format} · {t.mode === "SOLO" ? "Solo" : "Équipes"} · {t._count.registrations}{" "}
                  inscrit(s)
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                {STATUS_LABELS[t.status] ?? t.status}
              </span>
            </div>
          </Link>
        ))}
        {tournaments?.length === 0 && <p className="text-slate-500">Aucun tournoi pour l&apos;instant.</p>}
      </div>
    </div>
  );
}

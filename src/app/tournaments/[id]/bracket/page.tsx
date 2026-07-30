"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";
import { BracketView } from "@/components/bracket/BracketView";

const fetcher = (url: string) => apiFetch(url);

export default function PublicBracketPage({ params }: { params: { id: string } }) {
  // Polling de secours en attendant le temps réel (étape suivante) : reste correct
  // même sans websocket.
  const { data, error, isLoading } = useSWR(`/api/tournaments/${params.id}/bracket`, fetcher, {
    refreshInterval: 5000,
  });

  if (isLoading) return <main className="p-8">Chargement...</main>;
  if (error || !data) return <main className="p-8 text-red-600">Tournoi introuvable.</main>;

  const snapshot = data as {
    tournament: { name: string; status: string };
    rounds: Array<{ id: string; name: string; status: string; matches: never[] }>;
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{snapshot.tournament.name} — Bracket</h1>
      {snapshot.rounds.length === 0 ? (
        <p className="text-slate-500">Le bracket n&apos;a pas encore été généré.</p>
      ) : (
        <BracketView rounds={snapshot.rounds as never} />
      )}
    </main>
  );
}

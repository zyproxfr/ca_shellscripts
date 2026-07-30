"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";
import { GroupTable } from "@/components/groups/GroupTable";

const fetcher = (url: string) => apiFetch(url);

export default function PublicGroupsPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading } = useSWR(`/api/tournaments/${params.id}/bracket`, fetcher, {
    refreshInterval: 5000,
  });

  if (isLoading) return <main className="p-8">Chargement...</main>;
  if (error || !data) return <main className="p-8 text-red-600">Tournoi introuvable.</main>;

  const snapshot = data as {
    tournament: { name: string };
    rounds: Array<{ id: string; name: string; matches: never[] }>;
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{snapshot.tournament.name} — Poules</h1>
      {snapshot.rounds.length === 0 ? (
        <p className="text-slate-500">Les poules n&apos;ont pas encore été générées.</p>
      ) : (
        <GroupTable rounds={snapshot.rounds as never} />
      )}
    </main>
  );
}

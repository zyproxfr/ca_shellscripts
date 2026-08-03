"use client";

import { apiFetch } from "@/lib/utils/api-client";
import { useRealtimeResource } from "@/lib/realtime/use-realtime-resource";
import { tournamentRoom } from "@/lib/realtime/events";
import { BracketView } from "@/components/bracket/BracketView";
import { ConnectionStatus } from "@/components/layout/ConnectionStatus";

const fetcher = (url: string) => apiFetch(url);

export default function PublicBracketPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading, connected } = useRealtimeResource(
    `/api/tournaments/${params.id}/bracket`,
    tournamentRoom(params.id),
    fetcher,
  );

  if (isLoading) return <main className="p-8">Chargement...</main>;
  if (error || !data) return <main className="p-8 text-red-600">Tournoi introuvable.</main>;

  const snapshot = data as {
    tournament: { name: string; status: string };
    rounds: Array<{ id: string; name: string; status: string; matches: never[] }>;
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{snapshot.tournament.name} — Bracket</h1>
        <ConnectionStatus connected={connected} />
      </div>
      {snapshot.rounds.length === 0 ? (
        <p className="text-slate-500">Le bracket n&apos;a pas encore été généré.</p>
      ) : (
        <BracketView rounds={snapshot.rounds as never} />
      )}
    </main>
  );
}

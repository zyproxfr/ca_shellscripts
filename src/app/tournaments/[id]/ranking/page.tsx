"use client";

import { apiFetch } from "@/lib/utils/api-client";
import { useRealtimeResource } from "@/lib/realtime/use-realtime-resource";
import { tournamentRoom } from "@/lib/realtime/events";
import { RankingTable } from "@/components/ranking/RankingTable";
import { ConnectionStatus } from "@/components/layout/ConnectionStatus";

const fetcher = (url: string) => apiFetch(url);

export default function PublicRankingPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading, connected } = useRealtimeResource(
    `/api/tournaments/${params.id}/ranking`,
    tournamentRoom(params.id),
    fetcher,
  );

  if (isLoading) return <main className="p-8">Chargement...</main>;
  if (error || !data) return <main className="p-8 text-red-600">Classement introuvable.</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Classement</h1>
        <ConnectionStatus connected={connected} />
      </div>
      <RankingTable rows={data as never} />
    </main>
  );
}

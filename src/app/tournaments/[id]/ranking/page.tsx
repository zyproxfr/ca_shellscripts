"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";
import { RankingTable } from "@/components/ranking/RankingTable";

const fetcher = (url: string) => apiFetch(url);

export default function PublicRankingPage({ params }: { params: { id: string } }) {
  const { data, error, isLoading } = useSWR(`/api/tournaments/${params.id}/ranking`, fetcher, {
    refreshInterval: 5000,
  });

  if (isLoading) return <main className="p-8">Chargement...</main>;
  if (error || !data) return <main className="p-8 text-red-600">Classement introuvable.</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Classement</h1>
      <RankingTable rows={data as never} />
    </main>
  );
}

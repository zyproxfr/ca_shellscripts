"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";
import { useRealtimeInvalidate } from "@/lib/realtime/use-realtime-resource";
import { tournamentRoom } from "@/lib/realtime/events";
import { TvDashboard } from "@/components/tv/TvDashboard";

interface TvState {
  venue: { name: string };
  tournament: { id: string; name: string; format: string } | null;
  liveMatches: Array<{
    id: string;
    boardLabel: string | null;
    registrationALabel: string | null;
    registrationBLabel: string | null;
    remainingA: number | null;
    remainingB: number | null;
  }>;
  topRanking: Array<{ rank: number; label: string; points: number; wins: number; losses: number }>;
}

const fetcher = (url: string) => apiFetch<TvState>(url);

export default function TvPage({ params }: { params: { venueId: string } }) {
  const swrKey = `/api/tv/${params.venueId}`;
  // Polling de secours (8s) : l'écran TV est le plus critique visuellement, il ne
  // doit jamais rester figé même si le socket est indisponible.
  const { data, error, isLoading } = useSWR<TvState>(swrKey, fetcher, { refreshInterval: 8000 });

  const room = data?.tournament ? tournamentRoom(data.tournament.id) : null;
  useRealtimeInvalidate(room, swrKey);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Chargement...</div>;
  if (error || !data) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-red-400">Établissement introuvable.</div>;
  }

  return <TvDashboard state={data} />;
}

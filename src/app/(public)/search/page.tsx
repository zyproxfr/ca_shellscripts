"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";

interface SearchResult {
  players: Array<{ id: string; displayName: string }>;
  teams: Array<{ id: string; name: string }>;
}

const fetcher = (url: string) => apiFetch<SearchResult>(url);

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { data } = useSWR(query.trim().length >= 2 ? `/api/public/search?q=${encodeURIComponent(query)}` : null, fetcher);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Rechercher un joueur ou une équipe</h1>
      <input
        className="input"
        placeholder="Nom, prénom ou équipe..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <div className="mt-6 space-y-6">
        {data && data.players.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Joueurs</h2>
            <ul className="space-y-2">
              {data.players.map((p) => (
                <li key={p.id}>
                  <Link href={`/players/${p.id}`} className="card block hover:ring-brand-300">
                    {p.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data && data.teams.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Équipes</h2>
            <ul className="space-y-2">
              {data.teams.map((t) => (
                <li key={t.id} className="card">
                  {t.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data && data.players.length === 0 && data.teams.length === 0 && (
          <p className="text-slate-500">Aucun résultat pour « {query} ».</p>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";

interface Board {
  id: string;
  label: string;
  status: string;
}

interface Venue {
  id: string;
  name: string;
  address: string | null;
  boards: Board[];
  _count: { tournaments: number };
}

const fetcher = (url: string) => apiFetch<Venue[]>(url);

export default function VenuesPage() {
  const { data: venues, error, isLoading, mutate } = useSWR("/api/venues", fetcher);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [boardLabel, setBoardLabel] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateVenue(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/venues", { method: "POST", body: JSON.stringify({ name, address: address || undefined }) });
      setName("");
      setAddress("");
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateBoard(venueId: string) {
    const label = boardLabel[venueId]?.trim();
    if (!label) return;
    setFormError(null);
    try {
      await apiFetch("/api/boards", { method: "POST", body: JSON.stringify({ venueId, label }) });
      setBoardLabel((prev) => ({ ...prev, [venueId]: "" }));
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Établissement &amp; plateaux</h1>

      <form onSubmit={handleCreateVenue} className="card space-y-4">
        <h2 className="text-lg font-semibold">Ajouter un établissement</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nom</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Adresse (optionnel)</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Ajout..." : "Ajouter l'établissement"}
        </button>
      </form>

      {isLoading && <p>Chargement...</p>}
      {error && <p className="text-red-600">Impossible de charger les établissements.</p>}

      <div className="space-y-4">
        {venues?.map((venue) => (
          <div key={venue.id} className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{venue.name}</h2>
                {venue.address && <p className="text-sm text-slate-500">{venue.address}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{venue._count.tournaments} tournoi(s)</span>
                <a
                  href={`/tv/${venue.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Écran TV ↗
                </a>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Plateaux</h3>
              <ul className="mb-3 flex flex-wrap gap-2">
                {venue.boards.map((board) => (
                  <li key={board.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                    {board.label} · {board.status}
                  </li>
                ))}
                {venue.boards.length === 0 && <li className="text-sm text-slate-400">Aucun plateau pour l&apos;instant.</li>}
              </ul>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Ex: Plateau 1"
                  value={boardLabel[venue.id] ?? ""}
                  onChange={(e) => setBoardLabel((prev) => ({ ...prev, [venue.id]: e.target.value }))}
                />
                <button type="button" className="btn-secondary" onClick={() => handleCreateBoard(venue.id)}>
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

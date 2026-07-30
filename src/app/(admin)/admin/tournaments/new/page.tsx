"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";

interface Venue {
  id: string;
  name: string;
}

const fetcher = (url: string) => apiFetch<Venue[]>(url);

export default function NewTournamentPage() {
  const router = useRouter();
  const { data: venues } = useSWR("/api/venues", fetcher);

  const [venueId, setVenueId] = useState("");
  const [name, setName] = useState("");
  const [format, setFormat] = useState("SINGLE_ELIMINATION");
  const [mode, setMode] = useState("SOLO");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [minParticipants, setMinParticipants] = useState("2");
  const [gameType, setGameType] = useState("X501");
  const [outMode, setOutMode] = useState("DOUBLE");
  const [legsToWinSet, setLegsToWinSet] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tournament = await apiFetch<{ id: string }>("/api/tournaments", {
        method: "POST",
        body: JSON.stringify({
          venueId,
          name,
          format,
          mode,
          maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
          minParticipants: Number(minParticipants),
          scoringRules: {
            gameType,
            inMode: "STRAIGHT",
            outMode,
            legsToWinSet: Number(legsToWinSet),
            setsToWinMatch: 1,
          },
        }),
      });
      router.push(`/admin/tournaments/${tournament.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Créer un tournoi</h1>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="space-y-1">
          <label className="text-sm font-medium">Établissement</label>
          <select className="input" value={venueId} onChange={(e) => setVenueId(e.target.value)} required>
            <option value="">-- Choisir --</option>
            {venues?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {venues?.length === 0 && (
            <p className="text-sm text-amber-600">
              Aucun établissement : créez-en un d&apos;abord dans « Établissement ».
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Nom du tournoi</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Format</label>
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="SINGLE_ELIMINATION">Élimination directe</option>
              <option value="ROUND_ROBIN">Round Robin (poules)</option>
              <option value="DOUBLE_ELIMINATION">Double élimination (bientôt)</option>
              <option value="LEAGUE">Ligue (bientôt)</option>
              <option value="CUSTOM">Custom (bientôt)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Mode</label>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="SOLO">Solo</option>
              <option value="TEAM">Équipes</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Participants min.</label>
            <input
              type="number"
              min={2}
              className="input"
              value={minParticipants}
              onChange={(e) => setMinParticipants(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Participants max. (optionnel)</label>
            <input
              type="number"
              min={2}
              className="input"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-600">Règles de scoring</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Jeu</label>
              <select className="input" value={gameType} onChange={(e) => setGameType(e.target.value)}>
                <option value="X501">501</option>
                <option value="X301">301</option>
                <option value="CRICKET">Cricket</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Sortie (out)</label>
              <select className="input" value={outMode} onChange={(e) => setOutMode(e.target.value)} disabled={gameType === "CRICKET"}>
                <option value="STRAIGHT">Simple</option>
                <option value="DOUBLE">Double</option>
                <option value="MASTER">Master</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Manches gagnantes</label>
              <input
                type="number"
                min={1}
                className="input"
                value={legsToWinSet}
                onChange={(e) => setLegsToWinSet(e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Création..." : "Créer le tournoi"}
        </button>
      </form>
    </div>
  );
}

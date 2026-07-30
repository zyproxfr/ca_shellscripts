"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";

interface Player {
  id: string;
  displayName: string;
}

export type PlayerSelection =
  | { kind: "existing"; playerId: string; label: string }
  | { kind: "new"; firstName: string; lastName: string };

interface PlayerPickerProps {
  onChange: (selection: PlayerSelection | null) => void;
}

const fetcher = (url: string) => apiFetch<Player[]>(url);

// Recherche-avant-création : évite de dupliquer un joueur déjà en base (exigence
// produit explicite "éviter joueur dupliqué"). Le staff cherche d'abord, et ne
// bascule en création que si le joueur n'existe vraiment pas encore.
export function PlayerPicker({ onChange }: PlayerPickerProps) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Player | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const { data: results } = useSWR(query.trim().length >= 2 ? `/api/players?q=${encodeURIComponent(query)}` : null, fetcher);

  function selectPlayer(player: Player) {
    setSelected(player);
    setQuery(player.displayName);
    onChange({ kind: "existing", playerId: player.id, label: player.displayName });
  }

  function handleNewChange(first: string, last: string) {
    setFirstName(first);
    setLastName(last);
    if (first.trim() && last.trim()) {
      onChange({ kind: "new", firstName: first.trim(), lastName: last.trim() });
    } else {
      onChange(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          className={mode === "search" ? "font-semibold text-brand-700" : "text-slate-500"}
          onClick={() => {
            setMode("search");
            onChange(null);
          }}
        >
          Joueur existant
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          className={mode === "new" ? "font-semibold text-brand-700" : "text-slate-500"}
          onClick={() => {
            setMode("new");
            setSelected(null);
            onChange(null);
          }}
        >
          Nouveau joueur
        </button>
      </div>

      {mode === "search" ? (
        <div className="relative">
          <input
            className="input"
            placeholder="Rechercher un joueur (nom, prénom)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              onChange(null);
            }}
          />
          {query.trim().length >= 2 && !selected && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {results?.map((player) => (
                <li key={player.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-left hover:bg-brand-50"
                    onClick={() => selectPlayer(player)}
                  >
                    {player.displayName}
                  </button>
                </li>
              ))}
              {results?.length === 0 && (
                <li className="px-4 py-2 text-sm text-slate-400">Aucun résultat — essayez « Nouveau joueur ».</li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="input"
            placeholder="Prénom"
            value={firstName}
            onChange={(e) => handleNewChange(e.target.value, lastName)}
          />
          <input
            className="input"
            placeholder="Nom"
            value={lastName}
            onChange={(e) => handleNewChange(firstName, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

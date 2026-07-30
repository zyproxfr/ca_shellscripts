"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

interface TournamentDetail {
  id: string;
  name: string;
  status: string;
  format: string;
  mode: string;
  minParticipants: number;
  maxParticipants: number | null;
  venue: { name: string };
  scoringRules: { gameType: string; inMode: string; outMode: string; legsToWinSet: number } | null;
  registrations: Array<{ id: string; status: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  REGISTRATION_OPEN: "Inscriptions ouvertes",
  REGISTRATION_CLOSED: "Inscriptions fermées",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

const NEXT_STATUS: Record<string, { status: string; label: string; danger?: boolean }[]> = {
  DRAFT: [{ status: "REGISTRATION_OPEN", label: "Ouvrir les inscriptions" }],
  REGISTRATION_OPEN: [
    { status: "REGISTRATION_CLOSED", label: "Fermer les inscriptions" },
    { status: "CANCELLED", label: "Annuler le tournoi", danger: true },
  ],
  REGISTRATION_CLOSED: [
    { status: "REGISTRATION_OPEN", label: "Rouvrir les inscriptions" },
    { status: "IN_PROGRESS", label: "Lancer le tournoi" },
    { status: "CANCELLED", label: "Annuler le tournoi", danger: true },
  ],
  IN_PROGRESS: [{ status: "CANCELLED", label: "Annuler le tournoi", danger: true }],
  COMPLETED: [],
  CANCELLED: [],
};

const fetcher = (url: string) => apiFetch<TournamentDetail>(url);

export default function TournamentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: tournament, error, isLoading, mutate } = useSWR(`/api/tournaments/${params.id}`, fetcher);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleTransition(targetStatus: string) {
    setActionError(null);
    try {
      await apiFetch(`/api/tournaments/${params.id}/status`, {
        method: "POST",
        body: JSON.stringify({ targetStatus }),
      });
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  async function handleDelete() {
    await apiFetch(`/api/tournaments/${params.id}`, { method: "DELETE" });
    router.push("/admin/tournaments");
  }

  if (isLoading) return <p>Chargement...</p>;
  if (error || !tournament) return <p className="text-red-600">Tournoi introuvable.</p>;

  const checkedIn = tournament.registrations.filter((r) => r.status === "CHECKED_IN").length;
  const active = tournament.registrations.filter((r) => r.status !== "WITHDRAWN").length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-slate-500">
            {tournament.venue.name} · {tournament.format} · {tournament.mode === "SOLO" ? "Solo" : "Équipes"}
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-4 py-2 font-medium text-brand-700">
          {STATUS_LABELS[tournament.status] ?? tournament.status}
        </span>
      </div>

      <div className="card grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-slate-500">Inscrits (actifs)</p>
          <p className="text-2xl font-bold">
            {active}
            {tournament.maxParticipants ? ` / ${tournament.maxParticipants}` : ""}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Check-in</p>
          <p className="text-2xl font-bold">{checkedIn}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Minimum requis</p>
          <p className="text-2xl font-bold">{tournament.minParticipants}</p>
        </div>
      </div>

      {tournament.scoringRules && (
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Règles de scoring</h2>
          <p className="text-slate-600">
            {tournament.scoringRules.gameType} · sortie {tournament.scoringRules.outMode.toLowerCase()} ·{" "}
            {tournament.scoringRules.legsToWinSet} manches gagnantes
          </p>
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/tournaments/${tournament.id}/registrations`} className="btn-secondary">
            Gérer les inscriptions
          </Link>
          {NEXT_STATUS[tournament.status]?.map((action) =>
            action.danger ? (
              <ConfirmButton
                key={action.status}
                label={action.label}
                confirmMessage={`Confirmer : ${action.label} ? Cette action est irréversible.`}
                onConfirm={() => handleTransition(action.status)}
              />
            ) : (
              <button key={action.status} className="btn-primary" onClick={() => handleTransition(action.status)}>
                {action.label}
              </button>
            ),
          )}
        </div>
        {actionError && <p className="text-sm text-red-600">{actionError}</p>}

        {tournament.status === "DRAFT" && (
          <div className="border-t pt-3">
            <ConfirmButton
              label="Supprimer ce brouillon"
              confirmMessage="Supprimer définitivement ce tournoi brouillon ?"
              onConfirm={handleDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/utils/api-client";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { PlayerPicker, type PlayerSelection } from "@/components/forms/PlayerPicker";

interface Player {
  id: string;
  displayName: string;
}

interface Team {
  id: string;
  name: string;
}

interface RegistrationItem {
  id: string;
  status: string;
  player: Player | null;
  team: Team | null;
  checkIn: { checkedInAt: string } | null;
}

interface TournamentDetail {
  id: string;
  name: string;
  mode: "SOLO" | "TEAM";
  status: string;
  registrations: RegistrationItem[];
}

const fetcher = (url: string) => apiFetch<TournamentDetail>(url);

const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  CHECKED_IN: "Check-in ✓",
  WITHDRAWN: "Retiré",
  DISQUALIFIED: "Disqualifié",
};

export default function TournamentRegistrationsPage({ params }: { params: { id: string } }) {
  const { data: tournament, error, isLoading, mutate } = useSWR(`/api/tournaments/${params.id}`, fetcher);

  const [soloSelection, setSoloSelection] = useState<PlayerSelection | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamMemberFirstName, setTeamMemberFirstName] = useState("");
  const [teamMemberLastName, setTeamMemberLastName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRegisterSolo(e: React.FormEvent) {
    e.preventDefault();
    if (!soloSelection) {
      setFormError("Sélectionnez un joueur existant ou renseignez un nouveau joueur.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/registrations", {
        method: "POST",
        body: JSON.stringify({
          kind: "solo",
          tournamentId: params.id,
          ...(soloSelection.kind === "existing"
            ? { playerId: soloSelection.playerId }
            : { newPlayer: { firstName: soloSelection.firstName, lastName: soloSelection.lastName } }),
        }),
      });
      setSoloSelection(null);
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterTeam(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/registrations", {
        method: "POST",
        body: JSON.stringify({
          kind: "team",
          tournamentId: params.id,
          newTeam: {
            name: teamName,
            members: [{ newPlayer: { firstName: teamMemberFirstName, lastName: teamMemberLastName } }],
          },
        }),
      });
      setTeamName("");
      setTeamMemberFirstName("");
      setTeamMemberLastName("");
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckIn(registrationId: string) {
    setFormError(null);
    try {
      await apiFetch(`/api/registrations/${registrationId}/checkin`, { method: "POST" });
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  async function handleWithdraw(registrationId: string) {
    await apiFetch(`/api/registrations/${registrationId}`, { method: "DELETE", body: JSON.stringify({}) });
    await mutate();
  }

  if (isLoading) return <p>Chargement...</p>;
  if (error || !tournament) return <p className="text-red-600">Tournoi introuvable.</p>;

  const canRegister = tournament.status === "REGISTRATION_OPEN";

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Inscriptions — {tournament.name}</h1>

      {!canRegister && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-800">
          Les inscriptions ne sont pas ouvertes ({tournament.status}). Le check-in reste possible tant que le tournoi
          n&apos;est pas lancé.
        </p>
      )}

      {canRegister && tournament.mode === "SOLO" && (
        <form onSubmit={handleRegisterSolo} className="card space-y-3">
          <h2 className="text-lg font-semibold">Inscrire un joueur</h2>
          <PlayerPicker onChange={setSoloSelection} />
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Inscription..." : "Inscrire"}
          </button>
        </form>
      )}

      {canRegister && tournament.mode === "TEAM" && (
        <form onSubmit={handleRegisterTeam} className="card space-y-3">
          <h2 className="text-lg font-semibold">Inscrire une équipe</h2>
          <input
            className="input"
            placeholder="Nom de l'équipe"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Prénom (1er membre)"
              value={teamMemberFirstName}
              onChange={(e) => setTeamMemberFirstName(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="Nom (1er membre)"
              value={teamMemberLastName}
              onChange={(e) => setTeamMemberLastName(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Inscription..." : "Inscrire l'équipe"}
          </button>
        </form>
      )}

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">Participants ({tournament.registrations.length})</h2>
        <ul className="divide-y">
          {tournament.registrations.map((reg) => (
            <li key={reg.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{reg.player?.displayName ?? reg.team?.name}</p>
                <p className="text-sm text-slate-500">{REGISTRATION_STATUS_LABELS[reg.status] ?? reg.status}</p>
              </div>
              <div className="flex gap-2">
                {!reg.checkIn && reg.status !== "WITHDRAWN" && (
                  <button className="btn-secondary" onClick={() => handleCheckIn(reg.id)}>
                    Check-in
                  </button>
                )}
                {reg.status !== "WITHDRAWN" && (
                  <ConfirmButton
                    label="Retirer"
                    confirmMessage="Retirer ce participant du tournoi ?"
                    onConfirm={() => handleWithdraw(reg.id)}
                    className="btn-secondary"
                  />
                )}
              </div>
            </li>
          ))}
          {tournament.registrations.length === 0 && <p className="text-slate-500">Aucun participant inscrit.</p>}
        </ul>
      </div>
    </div>
  );
}

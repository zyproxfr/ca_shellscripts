"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/utils/api-client";
import { useRealtimeResource } from "@/lib/realtime/use-realtime-resource";
import { matchRoom } from "@/lib/realtime/events";
import { ScoreKeypad } from "@/components/scoring/ScoreKeypad";
import { CricketBoard } from "@/components/scoring/CricketBoard";
import { ConnectionStatus } from "@/components/layout/ConnectionStatus";

interface Side {
  id: string;
  player: { displayName: string } | null;
  team: { name: string } | null;
}

interface ScoreEntryView {
  id: string;
  registrationId: string;
  turnNumber: number;
  scoreValue: number;
  remainingAfter: number;
  isBust: boolean;
  isCheckout: boolean;
}

interface LegView {
  id: string;
  setNumber: number;
  legNumber: number;
  status: string;
  startingRegistrationId: string | null;
  winnerRegistrationId: string | null;
  version: number;
  scoreEntries: ScoreEntryView[];
}

interface MatchView {
  id: string;
  status: string;
  registrationAId: string | null;
  registrationBId: string | null;
  registrationA: Side | null;
  registrationB: Side | null;
  winnerRegistrationId: string | null;
  tournament: { scoringRules: { gameType: "X501" | "X301" | "CRICKET"; outMode: "STRAIGHT" | "DOUBLE" | "MASTER" } | null };
  legs: LegView[];
}

const START_SCORE = { X501: 501, X301: 301, CRICKET: 0 };

function label(side: Side | null): string {
  return side?.player?.displayName ?? side?.team?.name ?? "?";
}

function remainingFor(leg: LegView, registrationId: string, startScore: number): number {
  const entries = leg.scoreEntries.filter((e) => e.registrationId === registrationId && !e.isBust);
  const last = entries.at(-1);
  return last ? last.remainingAfter : startScore;
}

const fetcher = (url: string) => apiFetch<MatchView>(url);

export default function MatchScorePage({ params }: { params: { id: string } }) {
  const { data: match, error, isLoading, connected, mutate } = useRealtimeResource(
    `/api/matches/${params.id}`,
    matchRoom(params.id),
    fetcher,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");

  async function handleStart() {
    setActionError(null);
    try {
      await apiFetch(`/api/matches/${params.id}/start`, { method: "POST" });
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  if (isLoading) return <p>Chargement...</p>;
  if (error || !match) return <p className="text-red-600">Match introuvable.</p>;

  const rules = match.tournament.scoringRules;
  if (!rules) return <p className="text-red-600">Règles de scoring introuvables.</p>;

  const currentLeg = match.legs.find((l) => l.status === "IN_PROGRESS");
  const startScore = START_SCORE[rules.gameType];

  const currentTurnRegistrationId = currentLeg
    ? currentLeg.scoreEntries.length === 0
      ? currentLeg.startingRegistrationId
      : currentLeg.scoreEntries.at(-1)!.registrationId === match.registrationAId
        ? match.registrationBId
        : match.registrationAId
    : null;

  async function submitThrow(input: object) {
    setActionError(null);
    try {
      await apiFetch(`/api/matches/${params.id}/score`, {
        method: "POST",
        body: JSON.stringify({
          registrationId: currentTurnRegistrationId,
          expectedLegVersion: currentLeg!.version,
          ...input,
        }),
      });
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur inconnue.");
      await mutate();
    }
  }

  async function submitCorrection(input: object) {
    setActionError(null);
    try {
      await apiFetch(`/api/matches/${params.id}/score/correct`, {
        method: "POST",
        body: JSON.stringify({ ...input, reason: correctionReason }),
      });
      setShowCorrection(false);
      setCorrectionReason("");
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  const setsSummary = summarizeSets(match.legs, match.registrationAId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex justify-end">
        <ConnectionStatus connected={connected} />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold">
          {label(match.registrationA)} <span className="text-slate-400">vs</span> {label(match.registrationB)}
        </h1>
        <p className="text-slate-500">
          {rules.gameType} · sortie {rules.outMode.toLowerCase()} · manches (set {setsSummary.currentSet}) : {setsSummary.a} - {setsSummary.b}
        </p>
      </div>

      {actionError && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{actionError}</p>}

      {match.status === "COMPLETED" ? (
        <div className="card text-center">
          <p className="text-xl font-semibold">
            Match terminé — vainqueur :{" "}
            {match.winnerRegistrationId === match.registrationAId ? label(match.registrationA) : label(match.registrationB)}
          </p>
        </div>
      ) : match.status === "READY" ? (
        <div className="card text-center">
          <button className="btn-primary" onClick={handleStart}>
            Démarrer le match
          </button>
        </div>
      ) : currentLeg ? (
        <>
          <div className="card grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-slate-500">{label(match.registrationA)}</p>
              <p className="text-tv-lg font-bold">
                {rules.gameType === "CRICKET" ? "—" : remainingFor(currentLeg, match.registrationAId!, startScore)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{label(match.registrationB)}</p>
              <p className="text-tv-lg font-bold">
                {rules.gameType === "CRICKET" ? "—" : remainingFor(currentLeg, match.registrationBId!, startScore)}
              </p>
            </div>
          </div>

          <p className="text-center text-lg font-semibold text-brand-700">
            Au lancer : {currentTurnRegistrationId === match.registrationAId ? label(match.registrationA) : label(match.registrationB)}
          </p>

          <div className="card">
            {rules.gameType === "CRICKET" ? (
              <CricketBoard onSubmit={submitThrow} />
            ) : (
              <ScoreKeypad
                remaining={remainingFor(currentLeg, currentTurnRegistrationId!, startScore)}
                outMode={rules.outMode}
                onSubmit={submitThrow}
              />
            )}
          </div>

          {currentLeg.scoreEntries.length > 0 && (
            <div className="card">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">Historique du leg</h2>
                <button className="text-sm text-brand-700 underline" onClick={() => setShowCorrection((v) => !v)}>
                  Corriger le dernier tour
                </button>
              </div>
              <ul className="space-y-1 text-sm">
                {currentLeg.scoreEntries.map((e) => (
                  <li key={e.id} className="flex justify-between">
                    <span>{e.registrationId === match.registrationAId ? label(match.registrationA) : label(match.registrationB)}</span>
                    <span>
                      {e.scoreValue} {e.isBust ? "(bust)" : e.isCheckout ? "(checkout)" : ""}
                    </span>
                  </li>
                ))}
              </ul>

              {showCorrection && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <input
                    className="input"
                    placeholder="Raison de la correction (obligatoire)"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                  />
                  {rules.gameType === "CRICKET" ? (
                    <CricketBoard disabled={correctionReason.trim().length < 3} onSubmit={submitCorrection} />
                  ) : (
                    <ScoreKeypad
                      remaining={startScore}
                      outMode={rules.outMode}
                      disabled={correctionReason.trim().length < 3}
                      onSubmit={submitCorrection}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-slate-500">En attente du prochain leg...</p>
      )}
    </div>
  );
}

// Affiche le nombre de legs gagnés par chaque camp dans le set en cours (la
// détermination du vainqueur du set/match elle-même est gérée côté serveur, avec
// le seuil configuré — voir scoring-service.ts::finalizeLeg).
function summarizeSets(legs: LegView[], registrationAId: string | null) {
  const currentSet = Math.max(...legs.map((l) => l.setNumber), 1);
  const legsInSet = legs.filter((l) => l.setNumber === currentSet && l.status === "COMPLETED");
  const a = legsInSet.filter((l) => l.winnerRegistrationId === registrationAId).length;
  const b = legsInSet.length - a;
  return { a, b, currentSet };
}

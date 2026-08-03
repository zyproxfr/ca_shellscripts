interface LiveMatch {
  id: string;
  boardLabel: string | null;
  registrationALabel: string | null;
  registrationBLabel: string | null;
  remainingA: number | null;
  remainingB: number | null;
}

interface RankingRow {
  rank: number;
  label: string;
  points: number;
  wins: number;
  losses: number;
}

interface TvState {
  venue: { name: string };
  tournament: { name: string; format: string } | null;
  liveMatches: LiveMatch[];
  topRanking: RankingRow[];
}

// Écran plein d'ambiance bar : gros textes, fort contraste, lisible de loin.
export function TvDashboard({ state }: { state: TvState }) {
  if (!state.tournament) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <h1 className="text-tv-lg font-bold">{state.venue.name}</h1>
        <p className="mt-4 text-2xl text-slate-400">Aucun tournoi en cours pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-8 py-6 text-white">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-tv-lg font-bold">{state.tournament.name}</h1>
        <span className="text-xl text-slate-400">{state.venue.name}</span>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-4 text-2xl font-semibold text-brand-400">Matchs en direct</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {state.liveMatches.map((match) => (
              <div key={match.id} className="rounded-2xl bg-slate-900 p-6 shadow-lg">
                {match.boardLabel && <p className="mb-2 text-sm uppercase tracking-wide text-slate-500">{match.boardLabel}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-xl font-semibold">{match.registrationALabel}</span>
                  <span className="text-4xl font-bold text-brand-400">{match.remainingA ?? "—"}</span>
                </div>
                <div className="my-2 border-t border-slate-700" />
                <div className="flex items-center justify-between">
                  <span className="text-xl font-semibold">{match.registrationBLabel}</span>
                  <span className="text-4xl font-bold text-brand-400">{match.remainingB ?? "—"}</span>
                </div>
              </div>
            ))}
            {state.liveMatches.length === 0 && (
              <p className="text-slate-400">Aucun match en cours pour l&apos;instant.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-brand-400">Classement</h2>
          <ol className="space-y-2">
            {state.topRanking.map((row) => (
              <li key={row.rank} className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
                <span className="text-lg font-medium">
                  <span className="mr-3 text-slate-500">#{row.rank}</span>
                  {row.label}
                </span>
                <span className="text-lg font-bold text-brand-400">{row.points} pts</span>
              </li>
            ))}
            {state.topRanking.length === 0 && <p className="text-slate-400">Classement pas encore disponible.</p>}
          </ol>
        </section>
      </div>
    </div>
  );
}

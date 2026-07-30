interface MatchView {
  id: string;
  status: string;
  registrationALabel: string | null;
  registrationBLabel: string | null;
  groupName: string | null;
}

interface RoundView {
  id: string;
  name: string;
  matches: MatchView[];
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "À venir",
  READY: "Prêt",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  WALKOVER: "Forfait",
  CANCELLED: "Annulé",
};

export function GroupTable({ rounds }: { rounds: RoundView[] }) {
  const groupNames = Array.from(new Set(rounds.flatMap((r) => r.matches.map((m) => m.groupName)))).filter(
    (name): name is string => Boolean(name),
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {groupNames.map((groupName) => (
        <div key={groupName} className="card">
          <h3 className="mb-3 text-lg font-semibold">{groupName}</h3>
          <div className="space-y-4">
            {rounds.map((round) => {
              const matches = round.matches.filter((m) => m.groupName === groupName);
              if (matches.length === 0) return null;
              return (
                <div key={round.id}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{round.name}</p>
                  <ul className="space-y-1">
                    {matches.map((match) => (
                      <li key={match.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                        <span>
                          {match.registrationALabel} <span className="text-slate-400">vs</span> {match.registrationBLabel}
                        </span>
                        <span className="text-xs text-slate-500">{STATUS_LABELS[match.status] ?? match.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

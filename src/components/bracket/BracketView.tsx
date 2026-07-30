interface MatchView {
  id: string;
  status: string;
  registrationALabel: string | null;
  registrationBLabel: string | null;
  registrationAId: string | null;
  registrationBId: string | null;
  winnerRegistrationId: string | null;
}

interface RoundView {
  id: string;
  name: string;
  status: string;
  matches: MatchView[];
}

function SideLabel({ label, isWinner, isBye }: { label: string | null; isWinner: boolean; isBye: boolean }) {
  return (
    <div
      className={`rounded-md px-3 py-2 text-sm ${
        isWinner ? "bg-brand-50 font-semibold text-brand-800" : "bg-slate-50 text-slate-700"
      }`}
    >
      {label ?? (isBye ? "—" : "À déterminer")}
    </div>
  );
}

export function BracketView({ rounds }: { rounds: RoundView[] }) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {rounds.map((round) => (
        <div key={round.id} className="min-w-[240px] shrink-0 space-y-3">
          <h3 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">{round.name}</h3>
          <div className="flex h-full flex-col justify-around gap-4">
            {round.matches.map((match) => (
              <div key={match.id} className="card space-y-1 p-3">
                <SideLabel
                  label={match.registrationALabel}
                  isWinner={Boolean(match.winnerRegistrationId && match.winnerRegistrationId === match.registrationAId)}
                  isBye={!match.registrationAId}
                />
                <SideLabel
                  label={match.registrationBLabel}
                  isWinner={Boolean(match.winnerRegistrationId && match.winnerRegistrationId === match.registrationBId)}
                  isBye={!match.registrationBId}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

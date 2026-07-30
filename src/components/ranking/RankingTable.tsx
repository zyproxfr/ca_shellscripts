interface RankingRow {
  id: string;
  groupId: string | null;
  rank: number;
  points: number;
  wins: number;
  losses: number;
  legsWon: number;
  legsLost: number;
  average: number;
  highestScore: number;
  count180: number;
  count140Plus: number;
  registration: {
    player: { displayName: string } | null;
    team: { name: string } | null;
  };
  group: { name: string } | null;
}

function label(reg: RankingRow["registration"]): string {
  return reg.player?.displayName ?? reg.team?.name ?? "?";
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  const groups = Array.from(new Set(rows.map((r) => r.group?.name ?? null)));

  return (
    <div className="space-y-8">
      {groups.map((groupName) => (
        <div key={groupName ?? "global"} className="card overflow-x-auto">
          {groupName && <h2 className="mb-3 text-lg font-semibold">{groupName}</h2>}
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Participant</th>
                <th className="py-2 pr-2 text-right">Pts</th>
                <th className="py-2 pr-2 text-right">V-D</th>
                <th className="py-2 pr-2 text-right">Legs</th>
                <th className="py-2 pr-2 text-right">Moyenne</th>
                <th className="py-2 pr-2 text-right">Meilleur</th>
                <th className="py-2 pr-2 text-right">180</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => (r.group?.name ?? null) === groupName)
                .map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-semibold">{row.rank}</td>
                    <td className="py-2 pr-2">{label(row.registration)}</td>
                    <td className="py-2 pr-2 text-right">{row.points}</td>
                    <td className="py-2 pr-2 text-right">
                      {row.wins}-{row.losses}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {row.legsWon}-{row.legsLost}
                    </td>
                    <td className="py-2 pr-2 text-right">{row.average.toFixed(2)}</td>
                    <td className="py-2 pr-2 text-right">{row.highestScore}</td>
                    <td className="py-2 pr-2 text-right">{row.count180}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
      {rows.length === 0 && <p className="text-slate-500">Classement pas encore disponible.</p>}
    </div>
  );
}

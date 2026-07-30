export function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
      <span className="text-slate-500">{connected ? "Connexion en direct" : "Connexion dégradée — actualisation périodique"}</span>
    </div>
  );
}

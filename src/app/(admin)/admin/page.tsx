import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/tournaments/new" className="card block hover:ring-brand-300">
          <h2 className="text-lg font-semibold">Créer un tournoi</h2>
          <p className="text-sm text-slate-500">Configurer un nouveau tournoi en moins de 2 minutes.</p>
        </Link>
        <Link href="/admin/tournaments" className="card block hover:ring-brand-300">
          <h2 className="text-lg font-semibold">Gérer les tournois</h2>
          <p className="text-sm text-slate-500">Inscriptions, check-in, statuts, historique.</p>
        </Link>
      </div>
    </div>
  );
}

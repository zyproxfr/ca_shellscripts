import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";

// Garde en profondeur : le middleware protège déjà /admin/**, ce layout revérifie
// le rôle côté serveur (défense en profondeur, cf. section Rôles/Sécurité du plan).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/acces-refuse");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-lg font-bold">Administration</span>
          <div className="flex gap-4 text-sm font-medium">
            <Link href="/admin/tournaments">Tournois</Link>
            <Link href="/admin/venues">Établissement</Link>
            <Link href="/admin/users">Utilisateurs</Link>
            <Link href="/" className="text-slate-500">
              Accueil
            </Link>
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}

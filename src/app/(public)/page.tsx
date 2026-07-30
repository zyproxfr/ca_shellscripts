import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getCurrentSession();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-4 text-center">
      <div>
        <h1 className="text-4xl font-bold">🎯 Tournois Fléchettes</h1>
        <p className="mt-2 text-lg text-slate-600">
          Inscriptions, matchs en direct, classement et écran TV pour les soirées tournoi du bar.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link href="/tournaments" className="btn-secondary">
          Voir les tournois
        </Link>
        <Link href="/search" className="btn-secondary">
          Rechercher un joueur
        </Link>
        {session?.user.role === "ADMIN" && (
          <Link href="/admin" className="btn-primary">
            Espace admin
          </Link>
        )}
        {(session?.user.role === "STAFF" || session?.user.role === "ADMIN") && (
          <Link href="/staff/matches" className="btn-primary">
            Espace staff
          </Link>
        )}
        {!session && (
          <Link href="/login" className="btn-primary">
            Connexion staff / admin
          </Link>
        )}
      </div>
    </main>
  );
}

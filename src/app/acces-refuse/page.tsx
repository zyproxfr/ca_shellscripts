import Link from "next/link";

export default function AccesRefusePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">Accès refusé</h1>
      <p className="text-slate-600">Votre compte n&apos;a pas les droits nécessaires pour accéder à cette page.</p>
      <Link href="/" className="btn-secondary">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}

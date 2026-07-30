import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    redirect("/acces-refuse");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-lg font-bold">Espace staff</span>
          <div className="flex gap-4 text-sm font-medium">
            <Link href="/staff/matches">Matchs à arbitrer</Link>
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

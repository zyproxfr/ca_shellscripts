import { NextRequest, NextResponse } from "next/server";
import { toApiError } from "@/lib/utils/errors";
import { searchPlayers, searchTeams } from "@/server/players/player-service";

// Recherche publique (aucune authentification) : ne renvoie que des identifiants
// d'affichage, jamais téléphone/email.
export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q") ?? "";
    const [players, teams] = await Promise.all([searchPlayers(query), searchTeams(query)]);
    return NextResponse.json({
      players: players.map((p) => ({ id: p.id, displayName: p.displayName })),
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
    });
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

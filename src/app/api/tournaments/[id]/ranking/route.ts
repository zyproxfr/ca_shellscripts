import { NextRequest, NextResponse } from "next/server";
import { toApiError } from "@/lib/utils/errors";
import { getRankingForTournament } from "@/server/ranking/ranking-service";

// Route publique (écran TV, spectateurs) : aucune authentification requise.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ranking = await getRankingForTournament(params.id);
    return NextResponse.json(ranking);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

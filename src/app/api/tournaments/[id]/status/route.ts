import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { changeTournamentStatusSchema } from "@/lib/validation/tournament.schema";
import { changeTournamentStatus } from "@/server/tournaments/tournament-service";

// Les transitions de statut sont une action opérationnelle : ADMIN et STAFF peuvent
// toutes deux les déclencher (le staff gère le tournoi en direct au bar).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "STAFF"]);
    const json = await req.json();
    const input = changeTournamentStatusSchema.parse(json);
    const tournament = await changeTournamentStatus(params.id, input.targetStatus, session.user.id, {
      cancelledReason: input.cancelledReason,
    });
    return NextResponse.json(tournament);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

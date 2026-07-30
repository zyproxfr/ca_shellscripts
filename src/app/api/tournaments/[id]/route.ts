import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { updateTournamentSchema } from "@/lib/validation/tournament.schema";
import { deleteDraftTournament, getTournamentDetail, updateTournament } from "@/server/tournaments/tournament-service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const tournament = await getTournamentDetail(params.id);
    return NextResponse.json(tournament);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const json = await req.json();
    const input = updateTournamentSchema.parse(json);
    const tournament = await updateTournament(params.id, input, session.user.id);
    return NextResponse.json(tournament);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    await deleteDraftTournament(params.id, session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

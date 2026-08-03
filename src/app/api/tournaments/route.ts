import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { createTournamentSchema } from "@/lib/validation/tournament.schema";
import { createTournament, listTournaments } from "@/server/tournaments/tournament-service";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const venueId = req.nextUrl.searchParams.get("venueId") ?? undefined;
    const status = (req.nextUrl.searchParams.get("status") as never) ?? undefined;
    const tournaments = await listTournaments({ venueId, status });
    return NextResponse.json(tournaments);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"]);
    const json = await req.json();
    const input = createTournamentSchema.parse(json);
    const tournament = await createTournament(input, session.user.id);
    return NextResponse.json(tournament, { status: 201 });
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

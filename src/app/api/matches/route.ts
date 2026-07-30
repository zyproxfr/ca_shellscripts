import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { listMatchesForStaff } from "@/server/scoring/scoring-service";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const tournamentId = req.nextUrl.searchParams.get("tournamentId") ?? undefined;
    const matches = await listMatchesForStaff(tournamentId);
    return NextResponse.json(matches);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

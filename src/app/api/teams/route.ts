import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { searchTeams } from "@/server/players/player-service";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const query = req.nextUrl.searchParams.get("q") ?? "";
    const teams = await searchTeams(query);
    return NextResponse.json(teams);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

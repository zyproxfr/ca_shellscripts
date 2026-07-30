import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { getMatchForScoring } from "@/server/scoring/scoring-service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const match = await getMatchForScoring(params.id);
    return NextResponse.json(match);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

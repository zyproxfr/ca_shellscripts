import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { correctLastThrowSchema } from "@/lib/validation/score.schema";
import { correctLastThrow, getActiveLeg } from "@/server/scoring/scoring-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "STAFF"]);
    const json = await req.json();
    const input = correctLastThrowSchema.parse(json);
    const leg = await getActiveLeg(params.id);
    const entry = await correctLastThrow(leg.id, input, session.user.id);
    return NextResponse.json(entry);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

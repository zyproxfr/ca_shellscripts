import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { submitThrowSchema } from "@/lib/validation/score.schema";
import { getActiveLeg, submitThrow } from "@/server/scoring/scoring-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "STAFF"]);
    const json = await req.json();
    const input = submitThrowSchema.parse(json);
    const leg = await getActiveLeg(params.id);
    const outcome = await submitThrow(leg.id, input, session.user.id);
    return NextResponse.json(outcome);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

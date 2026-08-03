import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { withdrawRegistrationSchema } from "@/lib/validation/registration.schema";
import { withdrawRegistration } from "@/server/registrations/registration-service";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "STAFF"]);
    const json = await req.json().catch(() => ({}));
    const input = withdrawRegistrationSchema.parse(json);
    const registration = await withdrawRegistration(params.id, session.user.id, input.reason);
    return NextResponse.json(registration);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

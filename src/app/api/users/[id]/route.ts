import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { updateUserSchema } from "@/lib/validation/user.schema";
import { updateUser } from "@/server/users/user-service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const json = await req.json();
    const input = updateUserSchema.parse(json);
    const user = await updateUser(params.id, input, session.user.id);
    return NextResponse.json(user);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

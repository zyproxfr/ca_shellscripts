import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { createUserSchema } from "@/lib/validation/user.schema";
import { createUser, listStaffUsers } from "@/server/users/user-service";

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const users = await listStaffUsers();
    return NextResponse.json(users);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"]);
    const json = await req.json();
    const input = createUserSchema.parse(json);
    const user = await createUser(input, session.user.id);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

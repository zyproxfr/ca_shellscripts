import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { createBoardSchema } from "@/lib/validation/venue.schema";
import { createBoard } from "@/server/venues/venue-service";

export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);
    const json = await req.json();
    const input = createBoardSchema.parse(json);
    const board = await createBoard(input);
    return NextResponse.json(board, { status: 201 });
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

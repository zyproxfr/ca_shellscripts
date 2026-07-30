import { NextRequest, NextResponse } from "next/server";
import { toApiError } from "@/lib/utils/errors";
import { getTvState } from "@/server/tv/tv-service";

// Route publique (écran TV du bar) : aucune authentification.
export async function GET(_req: NextRequest, { params }: { params: { venueId: string } }) {
  try {
    const state = await getTvState(params.venueId);
    return NextResponse.json(state);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

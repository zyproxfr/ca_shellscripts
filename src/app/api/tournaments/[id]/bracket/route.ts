import { NextRequest, NextResponse } from "next/server";
import { toApiError } from "@/lib/utils/errors";
import { getBracketSnapshot } from "@/server/brackets/bracket-service";

// Route publique (écran TV, spectateurs) : aucune authentification requise, aucune
// donnée sensible renvoyée (voir getBracketSnapshot).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const snapshot = await getBracketSnapshot(params.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

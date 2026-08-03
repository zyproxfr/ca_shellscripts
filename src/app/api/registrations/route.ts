import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError, ValidationError } from "@/lib/utils/errors";
import { registerSoloSchema, registerTeamSchema } from "@/lib/validation/registration.schema";
import { registerSolo, registerTeam } from "@/server/registrations/registration-service";

// Inscription réalisée par le staff/admin au comptoir (V1 : pas d'auto-inscription
// joueur, cf. plan — décision pragmatique pour un usage terrain au bar).
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "STAFF"]);
    const json = await req.json();

    if (json.kind === "solo") {
      const input = registerSoloSchema.parse(json);
      const registration = await registerSolo(input, session.user.id);
      return NextResponse.json(registration, { status: 201 });
    }

    if (json.kind === "team") {
      const input = registerTeamSchema.parse(json);
      const registration = await registerTeam(input, session.user.id);
      return NextResponse.json(registration, { status: 201 });
    }

    throw new ValidationError('Le champ "kind" doit valoir "solo" ou "team".');
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

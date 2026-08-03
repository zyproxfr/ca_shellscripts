import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { toApiError } from "@/lib/utils/errors";
import { createVenueSchema } from "@/lib/validation/venue.schema";
import { createVenue, listVenues } from "@/server/venues/venue-service";

export async function GET() {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const venues = await listVenues();
    return NextResponse.json(venues);
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);
    const json = await req.json();
    const input = createVenueSchema.parse(json);
    const venue = await createVenue(input);
    return NextResponse.json(venue, { status: 201 });
  } catch (error) {
    const { httpStatus, body } = toApiError(error);
    return NextResponse.json(body, { status: httpStatus });
  }
}

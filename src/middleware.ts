import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Protège les groupes de routes (admin) et (staff) : redirige vers /login si absent de
// session, ou vers une page "accès refusé" si le rôle ne correspond pas. L'écran TV
// public ((public)/tv/**) n'est jamais concerné par ce middleware.
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/acces-refuse", req.url));
    }

    if (pathname.startsWith("/staff") && role !== "ADMIN" && role !== "STAFF") {
      return NextResponse.redirect(new URL("/acces-refuse", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/profile/:path*", "/my-tournaments/:path*"],
};

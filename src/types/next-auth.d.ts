import type { DefaultSession } from "next-auth";

type AppRole = "ADMIN" | "STAFF" | "PLAYER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: AppRole;
  }
}

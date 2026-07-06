import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { prisma } from "./prisma";
import { env } from "./env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
  },

  // Appen är byggd för en enda användare – tillåt bara ett konto att skapas.
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const existing = await prisma.user.count();
          if (existing >= 1) {
            throw new APIError("BAD_REQUEST", {
              message: "Ett konto finns redan. Logga in istället.",
            });
          }
          return { data: {} };
        },
      },
    },
  },
});

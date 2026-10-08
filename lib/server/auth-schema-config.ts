import { betterAuth } from "better-auth";
import { anonymous, emailOTP } from "better-auth/plugins";

/**
 * Schema-generation-only Better Auth config.
 *
 * Runtime auth is created from lib/server/auth-factory.ts with the actual
 * Cloudflare D1 binding and real secrets. This file exists only so the
 * Better Auth CLI can generate the exact SQLite/Drizzle tables required by
 * the enabled plugins without hand-written auth SQL.
 */
export const auth = betterAuth({
  secret: "myrota-schema-generation-only-secret-do-not-use-at-runtime",
  baseURL: "http://localhost:3000",
  plugins: [
    anonymous({
      disableDeleteAnonymousUser: true,
    }),
    emailOTP({
      async sendVerificationOTP() {
        // Never invoked during schema generation.
      },
    }),
  ],
});

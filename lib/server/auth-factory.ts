import type { D1Database } from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { anonymous, emailOTP } from "better-auth/plugins";

/**
 * Gate 1 server-only Better Auth factory for an actual Cloudflare D1 binding.
 *
 * This module intentionally does not export an active handler. The Worker must
 * supply a *verified* database binding, email sender, abuse gate, and atomic
 * account-merge transaction before exposing /api/auth publicly.
 *
 * The onLinkAccount callback must not complete until mergeGuestIntoClaimed
 * persists everything successfully. Existing-account login may follow another
 * Better Auth path; it requires separate integration testing.
 */
export interface AuthFactoryOptions {
  db: D1Database;
  appUrl: string;
  secret: string;
  trustedOrigins: string[];
  google?: {
    clientId: string;
    clientSecret: string;
  };
  sendOtp: (event: {
    email: string;
    otp: string;
    type: "sign-in" | "email-verification" | "forget-password" | "change-email";
  }) => Promise<void>;
  mergeGuestIntoClaimed: (event: {
    guestUserId: string;
    claimedUserId: string;
  }) => Promise<void>;
}


/**
 * Better Auth handles its own API failures, so the outer Next route catch is
 * insufficient for diagnosing anonymous sign-in failures. Keep the exception
 * inside Workers Logs, NEVER in the HTTP response.
 */
function reportAuthFailure(error: unknown): void {
  const e = error instanceof Error ? error : new Error("Unknown auth error");
  // SQL exceptions may include user input, credentials or cookies. Do not emit
  // free-form SQL or error stacks into persistent logs.
  const raw = e.message;
  const category = /no such table|no such column|SQLITE|D1_ERROR|database/i.test(raw)
    ? "database"
    : /origin|csrf|trusted|host/i.test(raw)
      ? "origin-or-csrf"
      : /secret|session|cookie|sign/i.test(raw)
        ? "session-or-secret"
        : "other";
  console.error("[myrota.auth.internal]", {
    name: e.name.slice(0, 80),
    category,
    // Whitelisted error patterns only, not raw SQL or user data.
    hint: /no such column/i.test(raw) ? "missing-column"
      : /no such table/i.test(raw) ? "missing-table"
      : /constraint failed|UNIQUE constraint/i.test(raw) ? "constraint"
      : /not implemented|unsupported/i.test(raw) ? "unsupported"
      : "inspect-local-repro",
  });
}

export function createMyrotaAuth(options: AuthFactoryOptions) {
  if (!options.secret || options.secret.length < 32) {
    throw new Error("Better Auth requires a strong server secret");
  }
  if (!options.appUrl || !options.appUrl.startsWith("https://") &&
      !options.appUrl.startsWith("http://localhost:")) {
    throw new Error("Invalid canonical auth origin");
  }
  if (!options.db || !options.sendOtp || !options.mergeGuestIntoClaimed) {
    throw new Error("Refusing to serve Auth without DB, email and merge handler");
  }

  return betterAuth({
    onAPIError: {
      onError: (error) => reportAuthFailure(error),
    },
    logger: {
      level: "error",
      disabled: false,
      // Capture internal Better Auth errors without storing arbitrary
      // arguments which may contain credentials or request payloads.
      log: (level, _message, ...args) => {
        if (level === "error") {
          const error = args.find((arg) => arg instanceof Error);
          reportAuthFailure(error ?? new Error("Better Auth reported an error"));
        }
      },
    },
    database: options.db,
    secret: options.secret,
    baseURL: options.appUrl,
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: { enabled: false },
    socialProviders: options.google
      ? { google: {
          clientId: options.google.clientId,
          clientSecret: options.google.clientSecret,
        } }
      : {},
    plugins: [
      anonymous({
        // Gate 1: never let Better Auth automatically delete the guest.
        // We explicitly retire it only after the D1 merge batch is verified.
        disableDeleteAnonymousUser: true,
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await options.mergeGuestIntoClaimed({
            guestUserId: anonymousUser.user.id,
            claimedUserId: newUser.user.id,
          });
          // If the merge rejects, auth claiming MUST abort rather than
          // silently discard guest shelf, friend pairs or dated activity.
        },
      }),
      emailOTP({
        otpLength: 6,
        async sendVerificationOTP({ email, otp, type }) {
          // Server-side provider must count quota and resends, then confirm
          // Brevo accepted the message or throw to prevent a false success.
          await options.sendOtp({ email, otp, type });
        },
      }),
    ],
  });
}

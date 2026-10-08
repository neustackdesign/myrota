import { createMyrotaAuth } from "./auth-factory";
import { bindings } from "./cloudflare-env";

function baseUrlFor(request: Request, configured?: string) {
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return url.origin;
}

async function sendBrevoOtp(event: {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}) {
  const e = bindings();
  if (!e.BREVO_API_KEY || !e.BREVO_SENDER_EMAIL) {
    throw new Error("Email OTP is not configured");
  }
  const subject = event.type === "sign-in" ? "Your myrota sign-in code" : "Your myrota verification code";
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": e.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: e.BREVO_SENDER_EMAIL, name: e.BREVO_SENDER_NAME || "myrota" },
      to: [{ email: event.email }],
      subject,
      textContent: `Your myrota code is ${event.otp}. It expires soon. If you did not request this, ignore this email.`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo rejected OTP delivery (${response.status})${detail ? ": " + detail.slice(0, 160) : ""}`);
  }
}

/**
 * Gate 1 intentionally blocks account claim merge until the complete durable
 * merge transaction exists. Anonymous auth and shelf persistence can go live
 * independently without risking guest data deletion.
 */
async function mergeNotYetEnabled() {
  throw new Error("Account claim merge is not enabled until the verified merge transaction is deployed");
}

export function runtimeAuth(request: Request) {
  const e = bindings();
  if (!e.DB) throw new Error("D1 binding missing");
  if (!e.BETTER_AUTH_SECRET || e.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("Better Auth secret is not configured");
  }
  const appUrl = baseUrlFor(request, e.MYROTA_BASE_URL);
  return createMyrotaAuth({
    db: e.DB,
    appUrl,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [appUrl],
    google:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
        ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET }
        : undefined,
    sendOtp: sendBrevoOtp,
    mergeGuestIntoClaimed: mergeNotYetEnabled,
  });
}

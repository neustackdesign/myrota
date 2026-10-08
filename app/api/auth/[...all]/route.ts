import { bindings } from "@/lib/server/cloudflare-env";
import { runtimeAuth } from "@/lib/server/runtime-auth";
import { verifyTurnstile } from "@/lib/server/turnstile";

const GUARDED_POSTS = [
  "/api/auth/sign-in/anonymous",
  "/api/auth/sign-in/social",
  "/api/auth/sign-in/email-otp",
  "/api/auth/email-otp/send-verification-otp",
];

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

async function handle(request: Request) {
  try {
    if (request.method === "POST" && GUARDED_POSTS.some((path) => new URL(request.url).pathname === path)) {
      const e = await bindings();
      if (!e.TURNSTILE_SECRET_KEY) return jsonError(503, "Account protection is not configured yet");
      const token = request.headers.get("x-captcha-response") ?? "";
      if (!token) return jsonError(400, "Verification token required");
      const ok = await verifyTurnstile({
        secret: e.TURNSTILE_SECRET_KEY,
        token,
        remoteIp: request.headers.get("cf-connecting-ip"),
      });
      if (!ok) return jsonError(403, "Verification failed");
    }
    return (await runtimeAuth(request)).handler(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication unavailable";
    const expectedConfig = /not configured|not enabled|binding missing/i.test(message);
    return jsonError(expectedConfig ? 503 : 500, expectedConfig ? message : "Authentication unavailable");
  }
}

export const GET = handle;
export const POST = handle;

import { bindings } from "@/lib/server/cloudflare-env";

export async function GET() {
  const e = bindings();
  return Response.json(
    {
      providers: {
        google: Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
        emailOtp: Boolean(e.BREVO_API_KEY && e.BREVO_SENDER_EMAIL),
        apple: false,
      },
      turnstileSiteKey: e.TURNSTILE_SITE_KEY || null,
      vapidPublicKey: null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

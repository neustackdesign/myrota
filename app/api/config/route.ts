import { bindings } from "@/lib/server/cloudflare-env";

export async function GET() {
  const e = await bindings();
  return Response.json(
    {
      providers: {
        // Account claim is OFF until a verified atomic guest merge exists.
        // Presence of provider secrets does not mean a flow is safely usable.
        google: false,
        emailOtp: false,
        apple: false,
      },
      turnstileSiteKey: e.TURNSTILE_SITE_KEY || null,
      vapidPublicKey: null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

import { bindings } from "@/lib/server/cloudflare-env";

const REQUIRED_TABLES = ["user", "session", "account", "verification", "shelf_items", "account_merge_jobs"];

export async function GET() {
  try {
    const e = bindings();
    const result = await e.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user','session','account','verification','shelf_items','account_merge_jobs')"
    ).all<{ name: string }>();
    const names = new Set(result.results.map((row) => row.name));
    const schemaReady = REQUIRED_TABLES.every((name) => names.has(name));
    const authSecretReady = Boolean(e.BETTER_AUTH_SECRET && e.BETTER_AUTH_SECRET.length >= 32);
    const turnstileReady = Boolean(e.TURNSTILE_SECRET_KEY && e.TURNSTILE_SITE_KEY);

    return Response.json(
      {
        app: "myrota",
        runtime: "cloudflare-worker",
        database: schemaReady ? "connected" : "schema-incomplete",
        auth: authSecretReady && turnstileReady ? "anonymous-ready" : "configuration-pending",
        live: schemaReady,
      },
      {
        status: schemaReady ? 200 : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      {
        app: "myrota",
        runtime: "cloudflare-worker",
        database: "unavailable",
        auth: "unavailable",
        live: false,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

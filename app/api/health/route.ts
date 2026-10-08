import { NextResponse } from "next/server";

/**
 * Public readiness endpoint: truthful about provisioning and deliberately
 * does not expose account IDs, credentials, session details or database state.
 */
export async function GET() {
  return NextResponse.json(
    {
      app: "myrota",
      runtime: "nextjs-scaffold",
      database: "not-connected",
      auth: "not-connected",
      live: false,
    },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

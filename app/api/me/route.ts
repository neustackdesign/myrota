import { currentUser } from "@/lib/server/session";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json(
      {
        userId: user.id,
        isAnonymous: Boolean((user as { isAnonymous?: boolean }).isAnonymous),
        displayName: user.name || null,
        identityProviders: [],
        hasRota: false,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service unavailable";
    return Response.json(
      { error: /not configured|binding missing/i.test(message) ? message : "Service unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

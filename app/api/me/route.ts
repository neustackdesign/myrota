import { currentUser } from "@/lib/server/session";
import { activeRota } from "@/lib/server/rota-store";
import { bindings } from "@/lib/server/cloudflare-env";

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
        hasRota: Boolean(await activeRota(user.id)),
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

export async function PATCH(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.displayName !== "string") {
      return Response.json({ error: "Display name required" }, { status: 422 });
    }
    const displayName = body.displayName.trim();
    if (!displayName || displayName.length > 60) {
      return Response.json({ error: "Use a name between 1 and 60 characters" }, { status: 422 });
    }
    const db = (await bindings()).DB;
    await db.prepare('UPDATE user SET name = ?, updated_at = ? WHERE id = ?')
      .bind(displayName, Date.now(), user.id).run();
    return Response.json({
      userId: user.id,
      isAnonymous: Boolean((user as { isAnonymous?: boolean }).isAnonymous),
      displayName,
      identityProviders: [],
      hasRota: Boolean(await activeRota(user.id)),
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to save name" }, { status: 503 });
  }
}

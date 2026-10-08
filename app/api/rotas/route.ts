import { currentUser } from "@/lib/server/session";
import { createRotaForUser, requestTimeZone } from "@/lib/server/rota-store";

export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const timeZone = requestTimeZone(request);
    const body = await request.json().catch(() => null);
    const result = await createRotaForUser(user.id, body, timeZone);
    return Response.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unavailable";
    const invalid = message.startsWith("validation:");
    return Response.json(
      { error: invalid ? message.slice("validation:".length) : "Rota service unavailable" },
      { status: invalid ? 422 : 503 },
    );
  }
}

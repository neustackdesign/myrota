import { currentUser } from "@/lib/server/session";
import { activeRota } from "@/lib/server/rota-store";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const rota = await activeRota(user.id);
    if (!rota) return Response.json({ error: "No rota yet" }, { status: 404 });
    return Response.json({ rota }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Rota service unavailable" }, { status: 503 });
  }
}

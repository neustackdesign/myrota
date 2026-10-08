import { currentUser } from "@/lib/server/session";
import { activeRota, latestRotas, recordsForUser, requestTimeZone } from "@/lib/server/rota-store";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const rota = await activeRota(user.id);
    const timeZone = rota?.timeZone ?? requestTimeZone(request);
    const rotas = await latestRotas(user.id);
    const records = await recordsForUser(user.id, rotas.map((r) => r.id));
    return Response.json(
      { serverNow: new Date().toISOString(), timeZone, rota, rotas, records, friends: [] },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Today service unavailable" }, { status: 503 });
  }
}

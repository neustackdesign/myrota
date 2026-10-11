import { currentUser } from "@/lib/server/session";
import { activeRota, latestRotas, recordsForUser, requestTimeZone } from "@/lib/server/rota-store";
import { weekRotaIds } from "@/lib/domain/week";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const rota = await activeRota(user.id);
    const timeZone = rota?.timeZone ?? requestTimeZone(request);
    // Enough history for last week + this week's replanned revisions (Issue #19):
    // a mid-week replan must not push last week's records out of the streak.
    const rotas = await latestRotas(user.id, 8);
    const records = await recordsForUser(user.id, [...new Set(rotas.flatMap((r) => weekRotaIds(r)))]);
    return Response.json(
      { serverNow: new Date().toISOString(), timeZone, rota, rotas, records, friends: [] },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Today service unavailable" }, { status: 503 });
  }
}

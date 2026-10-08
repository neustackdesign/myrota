import { currentUser } from "@/lib/server/session";
import { listShelf } from "@/lib/server/shelf-store";
import { evaluatePair, shelfToMixSubject, unknownMixSubject } from "@/lib/domain/mix";
import type { MixSubjectRef } from "@/lib/api/contract";
import type { RuleSet, ShelfProduct } from "@/lib/domain/types";

const UNREVIEWED: RuleSet = { version: "pending-pharmacist-review", pairRules: [], timingRules: [], contextHoldRules: [] };
function toSubject(ref: MixSubjectRef, owned: ShelfProduct[]) {
  if (ref.kind === "shelf") {
    const product = owned.find((p) => p.id === ref.shelfProductId);
    return product ? shelfToMixSubject(product) : null;
  }
  if (ref.kind === "unknown" && ref.name.length <= 180) return unknownMixSubject(ref.name, ref.name);
  return null;
}
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.a || !body.b) {
    return Response.json({ error: "Provide two products." }, { status: 422 });
  }
  const refs = [body.a, body.b] as MixSubjectRef[];
  if (refs.some((r) => !r || !["unknown", "shelf"].includes(r.kind))) {
    return Response.json({ error: "Unverified catalogue product." }, { status: 422 });
  }
  const hasShelf = refs.some((r) => r.kind === "shelf");
  let products: ShelfProduct[] = [];
  if (hasShelf) {
    try {
      const user = await currentUser(request);
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      products = await listShelf(user.id) as ShelfProduct[];
    } catch {
      return Response.json({ error: "Mix service unavailable" }, { status: 503 });
    }
  }
  const a = toSubject(refs[0], products);
  const b = toSubject(refs[1], products);
  if (!a || !b) return Response.json({ error: "Product not found on your shelf" }, { status: 404 });
  return Response.json(
    { result: evaluatePair(a, b, UNREVIEWED), names: [a.displayName, b.displayName] },
    { headers: { "cache-control": "no-store" } },
  );
}

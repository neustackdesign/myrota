import { addShelfProduct, listShelf } from "@/lib/server/shelf-store";
import { currentUser } from "@/lib/server/session";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Service unavailable";
  if (message.startsWith("validation:")) {
    return Response.json({ error: message.slice("validation:".length) }, { status: 422 });
  }
  if (/not configured|binding missing/i.test(message)) {
    return Response.json({ error: message }, { status: 503 });
  }
  return Response.json({ error: "Service unavailable" }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ products: await listShelf(user.id) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => null);
    const product = await addShelfProduct(user.id, body);
    return Response.json({ product, duplicate: false }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

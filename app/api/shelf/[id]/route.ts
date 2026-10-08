import { currentUser } from "@/lib/server/session";
import { deleteShelfProduct, updateShelfProduct } from "@/lib/server/shelf-store";

type Params = { params: Promise<{ id: string }> };
function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Unavailable";
  return Response.json(
    { error: message.startsWith("validation:") ? message.slice(11) : "Unable to update Shelf" },
    { status: message.startsWith("validation:") ? 422 : 503 },
  );
}
export async function PATCH(request: Request, ctx: Params) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const product = await updateShelfProduct(user.id, id, body);
    if (!product) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ product }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return fail(error); }
}
export async function DELETE(request: Request, ctx: Params) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    return (await deleteShelfProduct(user.id, id))
      ? new Response(null, { status: 204, headers: { "cache-control": "no-store" } })
      : Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return fail(error); }
}

import { bindings } from "@/lib/server/cloudflare-env";
import { capabilitiesFor } from "@/lib/server/capabilities";
import { transcribeLabel, DEFAULT_VISION_MODEL } from "@/lib/server/extract-vision";
import { splitInciList, toInciIngredients } from "@/lib/server/inci";
import { sniffImage, looksLikeIngredientList } from "@/lib/server/extract-validate";
import type { ExtractResponse, ExtractProblem } from "@/lib/api/contract";

/**
 * POST /api/extract — produce a REVIEWABLE candidate only. Never saves a product,
 * never returns a safety verdict, never persists or logs the image.
 *
 *  - multipart/form-data: image + method=scan|gallery + side=back|front → Workers AI
 *    vision transcription (gated on capability). Identity is NEVER inferred from
 *    pixels; only the verbatim INCI list is read, as `partial`.
 *  - application/json: pasted INCI (always available).
 */

const MAX_IMAGE_BYTES = 6_000_000; // 6 MB

const problem = (p: ExtractProblem): Response =>
  Response.json({ ok: false, problem: p } satisfies ExtractResponse, { headers: { "cache-control": "no-store" } });

async function handleImage(request: Request): Promise<Response> {
  const e = await bindings();
  // Explicit gate: binding unavailable OR operator flag not set after benchmark.
  if (!e.AI || !capabilitiesFor(e).photoReading) {
    return Response.json(
      { error: "Photo reading isn't enabled yet. Paste the ingredients or add the product by name." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return problem("unsupported_image"); }
  const image = form.get("image");
  const side = form.get("side") === "front" ? "front" : "back";
  if (!(image instanceof File)) return problem("unsupported_image");
  if (image.size === 0) return problem("no_text");
  if (image.size > MAX_IMAGE_BYTES) return problem("too_large");

  const bytes = new Uint8Array(await image.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return problem("unsupported_image");

  const model = (typeof process !== "undefined" && process.env?.MYROTA_VISION_MODEL) || DEFAULT_VISION_MODEL;
  const started = Date.now();
  let text = "";
  let usage: unknown = null;
  try {
    const result = await transcribeLabel(e.AI, bytes, model);
    text = result.text;
    usage = result.usage;
  } catch {
    // Provider error/timeout. Never leak detail; never persist the image.
    return Response.json(
      { error: "Couldn't read the photo just now. Try again, paste the ingredients, or add by name." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  // Cost/latency metric for the 30-label benchmark — metadata only, never image content.
  console.log("[myrota.extract.metric]", JSON.stringify({
    model, kind, bytes: bytes.length, side, latencyMs: Date.now() - started, usage,
  }));

  if (!text || /^unreadable$/i.test(text)) return problem(side === "front" ? "no_text" : "blur");

  const entries = splitInciList(text);
  if (!looksLikeIngredientList(text, entries)) return problem("not_ingredient_list");

  // Identity is NEVER inferred from pixels. Only the verbatim INCI is read, as partial.
  const ingredients = toInciIngredients(entries, "scan");
  const candidate = {
    extractionId: crypto.randomUUID(),
    brand: null,
    name: null,
    category: null,
    format: null,
    identityStatus: "unknown" as const,
    inciStatus: "partial" as const,
    identityKey: null,
    variant: null,
    ingredients,
    flags: [], // only reviewed rules / verified alerts produce flags; server decides, none yet
    provider: `workers_ai_vision:${model}`,
  };
  return Response.json({ ok: true, candidate } satisfies ExtractResponse, { headers: { "cache-control": "no-store" } });
}

async function handlePaste(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 24_000) return Response.json({ error: "too_large" }, { status: 413 });
  const input = await request.json().catch(() => null);
  if (!input || input.method !== "paste" || typeof input.pastedText !== "string") {
    return Response.json({ error: "Paste a product label or use manual entry." }, { status: 422 });
  }
  const raw = input.pastedText.trim();
  if (!raw) return problem("no_text");
  if (raw.length > 16_000) return problem("too_large");
  const entries = splitInciList(raw);
  if (!entries.length) return problem("no_text");
  const ingredients = toInciIngredients(entries, "paste");
  const candidate = {
    extractionId: crypto.randomUUID(),
    brand: null,
    name: null,
    category: null,
    format: null,
    identityStatus: "unknown" as const,
    inciStatus: "partial" as const,
    identityKey: null,
    variant: null,
    ingredients,
    flags: [],
    provider: "user_pasted_inci_v1",
  };
  return Response.json({ ok: true, candidate } satisfies ExtractResponse, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) return handleImage(request);
  return handlePaste(request);
}

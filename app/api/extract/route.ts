import { bindings } from "@/lib/server/cloudflare-env";
import { capabilitiesFor } from "@/lib/server/capabilities";
import { transcribeLabel, transcribeFrontLabel, DEFAULT_VISION_MODEL, DEFAULT_VISION_FORMAT } from "@/lib/server/extract-vision";
import { splitInciList, toInciIngredients } from "@/lib/server/inci";
import { sniffImage, looksLikeIngredientList } from "@/lib/server/extract-validate";
import { parseFrontLabel } from "@/lib/server/extract-front";
import { enforceExtractQuota } from "@/lib/server/extract-quota";
import { currentUser } from "@/lib/server/session";
import type { ExtractResponse, ExtractProblem } from "@/lib/api/contract";

/**
 * POST /api/extract — produce a REVIEWABLE candidate only. Never saves a product,
 * never returns a safety verdict, never persists or logs the image.
 *
 *  - multipart/form-data: image + method=scan|gallery + side=back|front → Workers AI
 *    two distinct tasks: INCI transcription where visible; otherwise a front-label
 *    product-identity candidate with partial evidence. Neither guesses an SKU.
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
  // Reject declared oversize bodies before multipart parsing allocates buffers.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_IMAGE_BYTES + 128_000) return problem("too_large");
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

  // Abuse + cost protection BEFORE invoking paid Workers AI. Per-IP + per-user
  // (when signed in) + a global daily ceiling. A capped request costs nothing.
  const ip = request.headers.get("cf-connecting-ip");
  const user = await currentUser(request).catch(() => null);
  const quota = await enforceExtractQuota(e.DB, ip, user?.id ?? null, e);
  if (!quota.allowed) {
    return Response.json(
      { error: "Photo reading is busy right now. Paste the ingredients or add by name, and try a photo again later." },
      { status: 429, headers: { "cache-control": "no-store", "retry-after": "3600" } },
    );
  }

  const model = e.MYROTA_VISION_MODEL || DEFAULT_VISION_MODEL;
  const fmtRaw = e.MYROTA_VISION_FORMAT || DEFAULT_VISION_FORMAT;
  const format = (["simple", "messages", "messages-array"].includes(fmtRaw) ? fmtRaw : "messages") as "simple" | "messages" | "messages-array";
  const started = Date.now();
  let text = "";
  let usage: unknown = null;
  let entries: string[] = [];
  let aiCalls = 0;
  let frontRaw = "";

  try {
    if (side !== "front") {
      const result = await transcribeLabel(e.AI, bytes, model, format, kind);
      aiCalls++;
      text = result.text;
      usage = result.usage;
      if (text && !/^unreadable$/i.test(text)) {
        const possible = splitInciList(text);
        if (looksLikeIngredientList(text, possible)) entries = possible;
      }
    }
    // A clear product front has no INCI list. Use a *bounded, second* task
    // rather than disguising the absence as camera blur. The front extraction
    // is also available explicitly without first paying for INCI OCR.
    if (!entries.length) {
      frontRaw = await transcribeFrontLabel(e.AI, bytes, model, format, kind);
      aiCalls++;
    }
  } catch {
    return Response.json(
      { error: "Couldn't read the photo just now. Try again, paste ingredients, or add by name." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  // Do not log raw photos, label text or model output. A fallback can incur
  // two inference calls; surface this in cost accounting, not as free capacity.
  console.log("[myrota.extract.metric]", JSON.stringify({
    model, format, kind, side, bytes: bytes.length, aiCalls,
    latencyMs: Date.now() - started, usage,
    resultType: entries.length ? "inci" : "front_or_unknown",
  }));

  if (!entries.length) {
    const front = parseFrontLabel(frontRaw);
    if (!front) return problem("not_ingredient_list");
    const candidate = {
      extractionId: crypto.randomUUID(),
      brand: front.brand,
      name: front.name,
      category: front.category,
      format: null,
      identityStatus: "partial" as const,
      inciStatus: "unknown" as const,
      identityKey: null,
      variant: front.variant,
      ingredients: [],
      flags: [],
      provider: `workers_ai_vision:${model}:front_label_unverified`,
    };
    return Response.json({ ok: true, candidate } satisfies ExtractResponse, {
      headers: { "cache-control": "no-store" },
    });
  }

  // INCI transcription does not establish exact product identity.
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

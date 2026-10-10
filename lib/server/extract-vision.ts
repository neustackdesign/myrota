import type { WorkersAi } from "./cloudflare-env";

/**
 * Provider-neutral vision/OCR adapter for Cloudflare Workers AI.
 *
 * The model is asked to TRANSCRIBE the label verbatim — never to infer, complete
 * or name a product/ingredient it cannot see. The caller treats the returned text
 * as the sole source string and validates every candidate ingredient against it.
 *
 * Model id (MYROTA_VISION_MODEL) and input FORMAT (MYROTA_VISION_FORMAT) are both
 * binding-configurable so a model can be qualified against the benchmark without a
 * code change. The exact model MUST pass docs/INGESTION_BENCHMARK.md before
 * PHOTO_READING_ENABLED is set.
 */
// Qualified against the 30-label benchmark: 29/30 legible, 82.8% active recall,
// ~4.3s median. llama-3.2-11b-vision needs a license accept; llava is too slow.
export const DEFAULT_VISION_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
export const DEFAULT_VISION_FORMAT = "messages" as const;
export type VisionFormat = "simple" | "messages" | "messages-array";

const TRANSCRIBE_PROMPT =
  "Read this cosmetic product label photo and output ONLY the ingredients list (the INCI list), " +
  "exactly as printed, as a single comma-separated line. Preserve spelling and order. Do NOT translate, " +
  "correct, complete, guess or add anything not printed. If you cannot read an ingredients list, reply with " +
  "exactly: UNREADABLE.";

export interface VisionResult {
  text: string;
  model: string;
  format: VisionFormat;
  usage: unknown | null;
  /** First chars of the raw response, for qualification only (never shown to users). */
  rawSample: string;
}

function textFrom(out: unknown): string {
  if (typeof out === "string") return out;
  if (out && typeof out === "object") {
    const o = out as Record<string, unknown>;
    for (const k of ["response", "description", "text", "result"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
    // chat-style { choices: [{ message: { content } }] }
    const choices = o.choices as Array<{ message?: { content?: string } }> | undefined;
    if (Array.isArray(choices) && typeof choices[0]?.message?.content === "string") return choices[0].message!.content!;
  }
  return "";
}

export type ImageKind = "jpeg" | "png" | "webp";

/** Encodes up to 6MB safely without exceeding JS argument limits. */
export function imageBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return btoa(parts.join(""));
}
function buildInput(format: VisionFormat, bytes: Uint8Array, kind: ImageKind, prompt = TRANSCRIBE_PROMPT): Record<string, unknown> {

  if (format === "simple") {
    return { image: Array.from(bytes), prompt, max_tokens: 1024, temperature: 0 };
  }
  if (format === "messages-array") {
    // instruct vision models that take a messages array + raw image bytes
    return { messages: [{ role: "user", content: prompt }], image: Array.from(bytes), max_tokens: 1024, temperature: 0 };
  }
  // "messages": chat content parts with a base64 data URI
  const b64 = imageBase64(bytes);
  return {
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/${kind};base64,${b64}` } },
      ],
    }],
    max_tokens: 1024,
    temperature: 0,
  };
}

export async function transcribeLabel(
  ai: WorkersAi,
  bytes: Uint8Array,
  model = DEFAULT_VISION_MODEL,
  format: VisionFormat = "messages",
  kind: ImageKind = "jpeg",
): Promise<VisionResult> {
  const out = await ai.run(model, buildInput(format, bytes, kind));
  const usage = out && typeof out === "object" ? (out as Record<string, unknown>).usage ?? null : null;
  let rawSample = "";
  try { rawSample = (typeof out === "string" ? out : JSON.stringify(out)).slice(0, 300); } catch { /* ignore */ }
  return { text: textFrom(out).trim(), model, format, usage, rawSample };
}

/**
 * Front-label identity is intentionally separate from INCI transcription.
 * Never return or infer the full ingredient list from a marketing claim.
 * This uses a second metered Workers AI call only when the existing INCI
 * transcription is unavailable, or a user explicitly chooses a front photo.
 */
const FRONT_PROMPT =
  'Transcribe ONLY words actually visible on the FRONT of this cosmetic package. ' +
  'Return exactly one JSON object with keys visible_text (verbatim visible words), ' +
  'brand, name, category, size. Values must be strings or null. ' +
  'Name the exact visible product, not an ingredient or a guessed retail listing. ' +
  'Category must be one of cleanser, toner, serum, treatment, moisturiser, sunscreen, other ' +
  'only when literally printed; otherwise null. Size must be text printed on the label. ' +
  'No INCI list, claimed formulation, ingredient completion, barcode, medical advice or guesses. ' +
  'If no front-label product name is visible use null for name. Output valid JSON only.';

export async function transcribeFrontLabel(
  ai: WorkersAi,
  bytes: Uint8Array,
  model = DEFAULT_VISION_MODEL,
  format: VisionFormat = "messages",
  kind: ImageKind = "jpeg",
): Promise<string> {
  const out = await ai.run(model, buildInput(format, bytes, kind, FRONT_PROMPT));
  return textFrom(out).trim();
}

import type { WorkersAi } from "./cloudflare-env";

/**
 * Provider-neutral vision/OCR adapter for Cloudflare Workers AI.
 *
 * The model is asked to TRANSCRIBE the label verbatim — never to infer, complete
 * or name a product/ingredient it cannot see. The caller treats the returned text
 * as the sole source string and validates every candidate ingredient against it,
 * so the model cannot smuggle in an ingredient that is not in its own transcript.
 *
 * The exact model MUST be confirmed available + benchmarked on the target account
 * before PHOTO_READING_ENABLED is set. Model id is configurable via env so we never
 * hard-assume one exists.
 */
// Image-to-Text model: accepts { image: number[], prompt } and returns { description }.
// Configurable per-deploy via the MYROTA_VISION_MODEL binding so alternatives can be
// A/B'd against the benchmark without a code change.
export const DEFAULT_VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

const TRANSCRIBE_PROMPT =
  "You are an OCR transcriber for a cosmetic product label. Transcribe ONLY the text that is actually " +
  "printed in the image, exactly as written, preserving spelling and order. Do NOT translate, correct, " +
  "complete, guess, or add anything that is not visibly printed. If an ingredients list is present, output " +
  "it verbatim. If you cannot read the text, output the single word: UNREADABLE.";

export interface VisionResult {
  text: string;
  model: string;
  /** Neurons/compute if the provider reports it; null otherwise. Recorded for the cost benchmark. */
  usage: unknown | null;
}

/** Normalise the many Workers AI response shapes to a string. */
function textFrom(out: unknown): string {
  if (typeof out === "string") return out;
  if (out && typeof out === "object") {
    const o = out as Record<string, unknown>;
    if (typeof o.response === "string") return o.response;
    if (typeof o.description === "string") return o.description;
    if (typeof o.text === "string") return o.text;
  }
  return "";
}

export async function transcribeLabel(
  ai: WorkersAi,
  imageBytes: Uint8Array,
  model = DEFAULT_VISION_MODEL,
): Promise<VisionResult> {
  // Workers AI vision models accept the image as an array of byte values.
  const out = await ai.run(model, {
    image: Array.from(imageBytes),
    prompt: TRANSCRIBE_PROMPT,
    max_tokens: 1024,
    temperature: 0, // deterministic transcription
  });
  const usage = out && typeof out === "object" ? (out as Record<string, unknown>).usage ?? null : null;
  return { text: textFrom(out).trim(), model, usage };
}

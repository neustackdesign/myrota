/** Initial real ingestion path: declared INCI pasted by user.
 * Photos are explicitly NOT passed off as OCR until the Workers AI evidence
 * pipeline and the 30-real-label benchmark are validated.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    // Image body is never logged or persisted, including on failure.
    return Response.json(
      { error: "Photo reading is being connected. Paste the INCI list or add this product manually for now." },
      { status: 501, headers: { "cache-control": "no-store" } },
    );
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 24_000) return Response.json({ error: "too_large" }, { status: 413 });
  const input = await request.json().catch(() => null);
  if (!input || input.method !== "paste" || typeof input.pastedText !== "string") {
    return Response.json({ error: "Paste a product label or use manual entry." }, { status: 422 });
  }
  const raw = input.pastedText.trim();
  if (!raw || raw.length > 16_000) return Response.json({ ok: false, problem: raw ? "too_large" : "no_text" });
  const clean = raw.replace(/^ingredients?\s*[:：]\s*/i, "").replace(/\r\n?/g, "\n");
  const entries = clean.split(/[,;\n]+/).map((x: string) => x.trim()).filter(Boolean);
  if (!entries.length) return Response.json({ ok: false, problem: "no_text" });
  const ingredients = entries.slice(0, 200).map((text: string, index: number) => ({
    id: `line-${index + 1}`,
    text: text.slice(0, 200),
    status: "read" as const,
    activeClass: null,
    flagged: false,
  }));
  // No identity, safety verdict, ingredient verification or product-format
  // certainty is inferred from a pasted list.
  return Response.json(
    {
      ok: true,
      candidate: {
        extractionId: crypto.randomUUID(),
        brand: null,
        name: null,
        category: null,
        format: null,
        identityStatus: "unknown",
        inciStatus: "partial",
        identityKey: null,
        variant: null,
        ingredients,
        flags: [],
        provider: "user_pasted_inci_v1",
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

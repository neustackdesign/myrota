"use client";

/**
 * Downscale a label photo so it fits the Worker's 6 MB /api/extract limit while
 * staying legible for OCR. Phone photos are often 3–12 MB; we cap the longest
 * side at ~2200px and re-encode JPEG, dropping quality only if still too large.
 * Returns the original file when it is already small enough.
 */
const TARGET_BYTES = 5_200_000; // comfortably under the 6 MB server cap
const MAX_DIM = 2200;

export async function fitImageForUpload(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // can't decode here; let the server validate/reject
  }
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= TARGET_BYTES) {
      return new File([blob], "label.jpg", { type: "image/jpeg" });
    }
    if (blob && quality === 0.55) {
      return new File([blob], "label.jpg", { type: "image/jpeg" }); // best effort
    }
  }
  return file;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { imageBase64, transcribeLabel } from "../lib/server/extract-vision.ts";

test("multi-megabyte mobile photo converts losslessly without JS spread RangeError", () => {
  const bytes = new Uint8Array(2 * 1024 * 1024 + 73);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const encoded = imageBase64(bytes);
  assert.deepEqual(Buffer.from(encoded, "base64"), Buffer.from(bytes));
});

test("vision adapter sends PNG/WebP as their true MIME types", async () => {
  for (const kind of ["png", "webp"]) {
    let captured;
    const ai = { run: async (_model, input) => { captured = input; return { response: "Aqua, Glycerin, Niacinamide" }; } };
    const bytes = Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3]);
    const result = await transcribeLabel(ai, bytes, "@cf/test", "messages", kind);
    assert.equal(result.text, "Aqua, Glycerin, Niacinamide");
    assert.equal(captured.messages[0].content[1].image_url.url,
      "data:image/" + kind + ";base64," + Buffer.from(bytes).toString("base64"));
  }
});

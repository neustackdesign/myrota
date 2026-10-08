import { defineConfig } from "drizzle-kit";

/** Generate SQL locally; Cloudflare binding/remote apply happens after account auth. */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  strict: true,
  verbose: true,
});

import { defineConfig } from "drizzle-kit";

/** Generate SQL locally; Cloudflare binding/remote apply happens after account auth. */
export default defineConfig({
  schema: ["./db/schema.ts", "./db/auth-schema.ts"],
  out: "./db/generated-migrations",
  dialect: "sqlite",
  strict: true,
  verbose: true,
});

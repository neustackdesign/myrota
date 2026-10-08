import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

/**
 * Current Vinext Cloudflare App Router setup (vinext 1.0.1).
 * Keep native Next.js build in parallel as the compatibility control.
 */
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "myrota",
    short_name: "myrota",
    description: "Turn the skincare you already own into a simple 7-day rota.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#F7EFE7",
    theme_color: "#F7EFE7",
    orientation: "portrait",
    categories: ["health", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

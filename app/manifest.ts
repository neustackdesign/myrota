import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "myrota",
    short_name: "myrota",
    description: "Turn the skincare you already own into a simple 7-day rota.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F2EA",
    theme_color: "#171714",
    orientation: "portrait",
    categories: ["health", "lifestyle"],
  };
}

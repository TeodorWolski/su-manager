import type { MetadataRoute } from "next";

/** Instalacja na ekranie początkowym (Android/Chrome): nazwa, kolory, ikony. iOS bierze apple-icon.png. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SU Manager",
    short_name: "SU Manager",
    description: "Grania, ludzie, materiał.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f3ef",
    theme_color: "#f4f3ef",
    lang: "pl",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

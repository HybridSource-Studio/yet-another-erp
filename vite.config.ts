/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { APP_NAME, APP_TAGLINE } from "./src/config.ts";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default defineConfig({
  // Relative base: the build runs from any path on any static host, with no domain baked in.
  base: "./",
  // The version shown in the footer (src/app/version.ts); package.json is its only home.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    {
      // Fills %APP_NAME% and %APP_TAGLINE% in index.html from src/config.ts.
      name: "app-config-html",
      transformIndexHtml: (html) =>
        html
          .replaceAll("%APP_NAME%", escapeHtml(APP_NAME))
          .replaceAll("%APP_TAGLINE%", escapeHtml(APP_TAGLINE)),
    },
  ],
  server: { port: 5192, strictPort: true },
  preview: { port: 5193, strictPort: true },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["src/test-setup.ts"],
  },
});

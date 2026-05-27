/**
 * Vite config for the Curie web UI (SPEC-0001 R14/R15).
 *
 * The app lives under `web/` and consumes the already-built library from
 * `dist/` via the `@lib` alias, so we never recompile the lib through Vite. The
 * `process.env` define is a browser safety net: the library's wallet factory
 * reads env in real mode, but we always pass `mode: 'simulated'` explicitly, so
 * this just guarantees no bare `process.env` reference can blow up in-browser.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "web",
  plugins: [react()],
  resolve: {
    alias: {
      "@lib": resolve(repoRoot, "dist/index.js"),
    },
  },
  define: {
    "process.env": "{}",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

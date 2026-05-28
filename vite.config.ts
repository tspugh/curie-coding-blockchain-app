/**
 * Vite config for the Curie web UI (SPEC-0001 R14/R15).
 *
 * The app lives under `web/` and consumes the already-built library from
 * `dist/` via the `@lib` alias, so we never recompile the lib through Vite.
 *
 * `envDir` is set to the repo root so that VITE_* vars in the root `.env` are
 * loaded and available as `import.meta.env.VITE_*` in the browser build.
 *
 * `process.env` is stubbed to `{}` so no bare `process.env` reference from the
 * library bundle blows up in-browser; the web client reads Vite env vars and
 * passes them explicitly to createClient() instead.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "web",
  envDir: repoRoot,
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

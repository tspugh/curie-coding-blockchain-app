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
import { mkdir, appendFile } from "node:fs/promises";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = dirname(fileURLToPath(import.meta.url));

/**
 * SPEC-0003 §2.2 (R9). Dev-server-only POST /__log/tx sink that appends a
 * single JSONL record per call to `.tmp/tx-log.jsonl` (gitignored). The UI
 * fires-and-forgets these from the RealBackend tx-confirmed event bus; the
 * file is the single source of truth for dev-session spend, queryable with
 * `tail -f .tmp/tx-log.jsonl | jq` from a side terminal.
 */
function txLogSinkPlugin(): Plugin {
  const logDir = resolve(repoRoot, ".tmp");
  const logFile = resolve(logDir, "tx-log.jsonl");
  return {
    name: "curie-tx-log-sink",
    configureServer(server) {
      server.middlewares.use("/__log/tx", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          void (async () => {
            try {
              const body = Buffer.concat(chunks).toString("utf8").trim();
              if (!body) {
                res.statusCode = 400;
                res.end();
                return;
              }
              // Validate JSON before writing so a malformed POST can't corrupt
              // the JSONL stream.
              JSON.parse(body);
              await mkdir(logDir, { recursive: true });
              await appendFile(logFile, body + "\n", "utf8");
              res.statusCode = 204;
              res.end();
            } catch (err) {
              // Log once on the dev server (not the browser console) so we
              // notice configuration mistakes without spamming the page.
              // eslint-disable-next-line no-console
              console.error("[tx-log-sink] write failed:", err);
              res.statusCode = 500;
              res.end();
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  root: "web",
  envDir: repoRoot,
  plugins: [react(), txLogSinkPlugin()],
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
  preview: {
    // Allow any *.trycloudflare.com quick-tunnel host so the dev tunnel works
    // without per-session config edits. Leading-dot = subdomain wildcard.
    allowedHosts: [".trycloudflare.com"],
  },
});

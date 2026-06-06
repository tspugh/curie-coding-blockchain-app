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
import { mkdir, appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { executeProbe } from "./web/src/probeHandler.js";

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
        // GET → return the entire JSONL as a JSON array so the in-UI
        // TxMonitor can hydrate cumulative session state across reloads.
        // POST → append a single confirmed-tx record (the original sink).
        if (req.method === "GET") {
          void (async () => {
            try {
              if (!existsSync(logFile)) {
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end("[]");
                return;
              }
              const raw = await readFile(logFile, "utf8");
              const entries = raw
                .split("\n")
                .filter((l) => l.trim().length > 0)
                .map((l) => {
                  try { return JSON.parse(l) as unknown; } catch { return null; }
                })
                .filter((x) => x !== null);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(entries));
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error("[tx-log-sink] read failed:", err);
              res.statusCode = 500;
              res.end();
            }
          })();
          return;
        }
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

/**
 * SPEC-0006 R21. Dev-server-only GET /__probe?url=<encoded> middleware that
 * server-side fetches the target URL (avoiding browser CORS restrictions) and
 * returns { ok: boolean, status: number, error?: string }.
 *
 * The fetch logic lives in `web/src/probeHandler.ts` (`executeProbe`) so it
 * can be unit-tested independently of the Vite server.  This middleware is
 * the HTTP wrapper only: it parses the `url` query-param, delegates to
 * `executeProbe`, and serialises the result as JSON.
 *
 * Strategy (deliberate HEAD-drop, documented in probeHandler.ts and here):
 *   Spec §3.9 and the unit wording describe HEAD-first with a Range-GET
 *   fallback, but this implementation issues a single Range-GET directly —
 *   HEAD is omitted entirely.  Rationale: the probe runs server-side (no
 *   CORS restriction), so the CORS-workaround motivation for HEAD disappears.
 *   A Range-GET is universally supported and avoids the two-round-trip cost.
 *   Deliberate simplification, not an oversight.
 */
function urlProbePlugin(): Plugin {
  return {
    name: "curie-url-probe",
    configureServer(server) {
      server.middlewares.use("/__probe", (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const rawUrl = new URL(
          req.url ?? "",
          "http://localhost",
        ).searchParams.get("url");
        if (!rawUrl) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, status: 0, error: "missing url parameter" }));
          return;
        }
        void executeProbe(rawUrl).then((result) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        });
      });
    },
  };
}

export default defineConfig({
  root: "web",
  envDir: repoRoot,
  plugins: [react(), txLogSinkPlugin(), urlProbePlugin()],
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
  server: {
    allowedHosts: [".trycloudflare.com", ".ts.net"],
  },
  preview: {
    // Allow any *.trycloudflare.com quick-tunnel host so the dev tunnel works
    // without per-session config edits. Leading-dot = subdomain wildcard.
    // `.ts.net` covers Tailscale MagicDNS / Funnel hosts (resolves only on the
    // tailnet or via Funnel ACLs); needed on the Pi where cloudflared isn't running.
    allowedHosts: [".trycloudflare.com", ".ts.net"],
  },
});

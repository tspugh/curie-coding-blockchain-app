#!/usr/bin/env python3
"""
graphify.py — Code knowledge graph generator for Claude coding agents.

Analyzes TypeScript source files and generates .claude/graph/ with:
  CONTEXT.md  — Human-readable codebase map (< 200 lines, load at session start)
  graph.json  — Machine-readable entity/relationship graph
  meta.json   — Staleness tracking (local-only, not committed)

Usage:
  python scripts/graphify.py          # Generate / refresh graph
  python scripts/graphify.py --check  # Exit 0 if fresh, 1 if stale

Auto-runs on SessionStart via Claude Code hook when stale (>1 hr or src changed).
"""

import json
import re
import sys
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "src"
GRAPH_DIR = ROOT / ".claude" / "graph"
CONTEXT_FILE = GRAPH_DIR / "CONTEXT.md"
GRAPH_FILE = GRAPH_DIR / "graph.json"
META_FILE = GRAPH_DIR / "meta.json"
STALE_HOURS = 1


# ---------------------------------------------------------------------------
# Staleness
# ---------------------------------------------------------------------------

def _src_hash() -> str:
    """MD5 of all source file mtimes — detects any change without reading content."""
    h = hashlib.md5()
    for p in sorted(SRC_DIR.rglob("*.ts")):
        h.update(f"{p}:{p.stat().st_mtime}".encode())
    return h.hexdigest()


def is_stale() -> bool:
    if not META_FILE.exists():
        return True
    try:
        meta = json.loads(META_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return True
    ts = datetime.fromisoformat(meta.get("generated_at", "2000-01-01T00:00:00+00:00"))
    age_h = (datetime.now(timezone.utc) - ts).total_seconds() / 3600
    return age_h > STALE_HOURS or meta.get("src_hash") != _src_hash()


# ---------------------------------------------------------------------------
# TypeScript parser (regex, no new dependencies)
# ---------------------------------------------------------------------------

_EXPORT_DECL = re.compile(
    r'^export\s+(?:async\s+)?(?:function\*?\s+|class\s+|const\s+|let\s+|var\s+|'
    r'interface\s+|type\s+|enum\s+|abstract\s+class\s+)(\w+)',
    re.MULTILINE,
)
_EXPORT_BRACE = re.compile(r'^export\s*\{([^}]+)\}', re.MULTILINE)
_EXPORT_DEFAULT = re.compile(r'^export\s+default\b', re.MULTILINE)
_IMPORT_FROM = re.compile(
    r"""^import\s+(?:type\s+)?(?:\w+|[\w\s{},*]+)\s+from\s+['"]([^'"]+)['"]""",
    re.MULTILINE,
)
_FUNCTION = re.compile(r'^(?:export\s+)?(?:async\s+)?function\*?\s+(\w+)', re.MULTILINE)
_CLASS = re.compile(r'^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)', re.MULTILINE)
_ARROW_CONST = re.compile(
    r'^(?:export\s+)?const\s+(\w+)\s*(?::[^=\n]+)?\s*=\s*(?:async\s+)?'
    r'(?:\([^)]*\)|[\w_]+)\s*=>',
    re.MULTILINE,
)
_INTERFACE = re.compile(r'^(?:export\s+)?interface\s+(\w+)', re.MULTILINE)
_TYPE_ALIAS = re.compile(r'^(?:export\s+)?type\s+(\w+)\s*(?:<[^>]*>)?\s*=', re.MULTILINE)


def _first_comment(text: str) -> str:
    m = re.search(r'^/\*\*\s*\n(.*?)\*/', text, re.DOTALL)
    if m:
        lines = [ln.strip().lstrip('*').strip() for ln in m.group(1).splitlines()]
        return ' '.join(ln for ln in lines if ln and not ln.startswith('@'))[:240].strip()
    m = re.match(r'^\s*//\s*(.+)', text.lstrip())
    if m:
        return m.group(1).strip()[:240]
    return ""


def parse_file(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = path.relative_to(ROOT).as_posix()

    exports: list[str] = []
    exports.extend(m.group(1) for m in _EXPORT_DECL.finditer(text))
    for m in _EXPORT_BRACE.finditer(text):
        for token in re.split(r',', m.group(1)):
            name = token.strip().split(' as ')[0].strip()
            if re.match(r'^\w+$', name):
                exports.append(name)
    if _EXPORT_DEFAULT.search(text):
        exports.append('(default)')

    entities: set[str] = set()
    for pattern in (_FUNCTION, _CLASS, _ARROW_CONST, _INTERFACE, _TYPE_ALIAS):
        entities.update(m.group(1) for m in pattern.finditer(text))

    exports_set = set(exports)
    return {
        "path": rel,
        "purpose": _first_comment(text),
        "exports": list(dict.fromkeys(exports)),            # ordered, deduped
        "internal": sorted(entities - exports_set),         # not exported
        "imports": [m.group(1) for m in _IMPORT_FROM.finditer(text)],
        "lines": text.count('\n') + 1,
    }


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def _resolve(importer: str, spec: str, all_paths: set[str]) -> str | None:
    """Resolve a relative import specifier to a tracked source path, or None."""
    if not spec.startswith('.'):
        return None
    base = Path(importer).parent
    raw = (base / spec).as_posix()
    for candidate in (raw, raw + '.ts', raw + '/index.ts'):
        ts = re.sub(r'\.js$', '.ts', candidate)   # ESM .js → .ts
        if ts in all_paths:
            return ts
        if candidate in all_paths:
            return candidate
    return None


def build_graph(files: list[dict[str, Any]]) -> dict[str, Any]:
    all_paths = {f["path"] for f in files}
    nodes = {
        f["path"]: {k: f[k] for k in ("path", "purpose", "exports", "internal", "lines")}
        for f in files
    }
    edges = [
        {"from": f["path"], "to": resolved, "type": "imports"}
        for f in files
        for imp in f["imports"]
        if (resolved := _resolve(f["path"], imp, all_paths))
    ]
    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------------
# CONTEXT.md generator
# ---------------------------------------------------------------------------

def _mermaid(edges: list[dict[str, Any]]) -> str:
    if not edges:
        return ""
    lines = ["```mermaid", "graph LR"]
    seen: set[str] = set()
    for e in edges:
        src_id = re.sub(r'[^a-zA-Z0-9]', '_', e["from"])
        tgt_id = re.sub(r'[^a-zA-Z0-9]', '_', e["to"])
        src_label = Path(e["from"]).name
        tgt_label = Path(e["to"]).name
        key = f"{src_id}-->{tgt_id}"
        if key not in seen:
            lines.append(f'  {src_id}["{src_label}"] --> {tgt_id}["{tgt_label}"]')
            seen.add(key)
    lines.append("```")
    return "\n".join(lines)


def generate_context(files: list[dict[str, Any]], graph: dict[str, Any], generated_at: str) -> str:
    date = generated_at[:10]
    total_lines = sum(f["lines"] for f in files)
    edges: list[dict[str, Any]] = graph["edges"]

    # Build consumer index: file → list of files that import it
    consumers: dict[str, list[str]] = {}
    for e in edges:
        consumers.setdefault(e["to"], []).append(e["from"])

    out: list[str] = [
        "# Codebase Graph",
        f"> Generated {date} by `scripts/graphify.py`. Run `npm run graph` to refresh.",
        "",
        "**Start here.** Gives a complete codebase picture without traversing files — designed",
        "to eliminate context-bloat in fresh agent sessions.",
        "",
        "## Quick Orientation",
        "",
        "- **Project:** Curie Claims Protocol — agentic medical-claims negotiation on Somnia blockchain",
        "- **Stack:** TypeScript strict + `somnia-agent-kit` v3 (contracts, signing, event streams)",
        f"- **Scale:** {len(files)} source files · ~{total_lines} lines (early-MVP skeleton phase)",
        "- **Entry:** `npm run dev` → `src/index.ts` → `createKit()` → contract/agent calls",
        "- **No REST layer, no DB** — all state lives on-chain via `somnia-agent-kit`",
        "",
    ]

    # Architecture diagram
    mermaid = _mermaid(edges)
    if mermaid:
        out += ["## Dependency Graph", "", mermaid, ""]

    # Module catalog
    out += ["## Module Catalog", ""]
    for f in sorted(files, key=lambda x: x["path"]):
        out.append(f"### `{f['path']}`  ·  {f['lines']} lines")
        if f["purpose"]:
            out.append(f"> {f['purpose']}")
        if f["exports"]:
            out.append("- **Exports:** " + ", ".join(f"`{e}`" for e in f["exports"][:14]))
        if f["internal"]:
            out.append("- **Internal:** " + ", ".join(f"`{e}`" for e in f["internal"][:8]))
        if f["path"] in consumers:
            out.append("- **Imported by:** " + ", ".join(f"`{c}`" for c in consumers[f["path"]]))
        out.append("")

    # Export index — quick symbol → file lookup
    all_exports = [
        (exp, f["path"])
        for f in sorted(files, key=lambda x: x["path"])
        for exp in f["exports"]
    ]
    if all_exports:
        out += ["## Export Index", "", "| Symbol | Defined in |", "|--------|------------|"]
        for sym, path in sorted(all_exports, key=lambda x: x[0].lower()):
            out.append(f"| `{sym}` | `{path}` |")
        out.append("")

    # Patterns and gotchas — agent-critical notes
    out += [
        "## Patterns & Gotchas",
        "",
        "| # | Rule |",
        "|---|------|",
        "| 1 | Call `loadConfig()` from `src/config/env.ts` — never read `process.env` elsewhere |",
        "| 2 | `SOMNIA_NETWORKS` in `src/config/networks.ts` is the source of truth for chainId/RPC/explorer |",
        "| 3 | `createKit(config)` must be **awaited** — `kit.initialize()` does an async RPC handshake |",
        "| 4 | Kit exposes `kit.contracts.registry / .manager / .executor / .vault` after `initialize()` |",
        "| 5 | If `PRIVATE_KEY` is absent, kit is read-only; write calls will throw |",
        "| 6 | **No PHI on-chain ever** — all blockchain writes must be de-identified |",
        "",
        "## What Doesn't Exist Yet _(future work)_",
        "",
        "- Smart contracts (CoverageException lifecycle state machine)",
        "- Agent mediation logic (provider / payer / mediator roles)",
        "- Event listeners / WebSocket subscriptions",
        "- Test suite",
        "",
        "## Regenerating This File",
        "",
        "```bash",
        "python scripts/graphify.py   # direct",
        "npm run graph                # via npm script",
        "```",
        "",
        "Runs automatically on `SessionStart` when stale (>1 hr or any `src/**/*.ts` changed).",
    ]

    return "\n".join(out) + "\n"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if "--check" in sys.argv:
        sys.exit(1 if is_stale() else 0)

    if not SRC_DIR.exists():
        print(f"[graphify] No src/ directory at {SRC_DIR}", file=sys.stderr)
        sys.exit(1)

    ts_files = sorted(SRC_DIR.rglob("*.ts"))
    if not ts_files:
        print("[graphify] No .ts files found in src/")
        sys.exit(0)

    print(f"[graphify] Parsing {len(ts_files)} TypeScript files...")
    files = [parse_file(p) for p in ts_files]

    graph = build_graph(files)

    GRAPH_DIR.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc).isoformat()

    GRAPH_FILE.write_text(
        json.dumps(
            {"generated_at": generated_at, "nodes": graph["nodes"], "edges": graph["edges"]},
            indent=2,
        ),
        encoding="utf-8",
    )

    context = generate_context(files, graph, generated_at)
    CONTEXT_FILE.write_text(context, encoding="utf-8")

    META_FILE.write_text(
        json.dumps(
            {"generated_at": generated_at, "src_hash": _src_hash(), "file_count": len(ts_files)},
            indent=2,
        ),
        encoding="utf-8",
    )

    print("[graphify] Done.")
    print(f"  .claude/graph/CONTEXT.md  — {len(context.splitlines())} lines")
    print(f"  .claude/graph/graph.json  — {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")
    print(f"  .claude/graph/meta.json   — staleness tracker (local-only)")


if __name__ == "__main__":
    main()

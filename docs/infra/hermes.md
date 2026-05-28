# Hermes — Discord communication layer

[Hermes-Agent](https://github.com/NousResearch/hermes-agent) by Nous
Research, running on the `cliqueue-dev` EC2 as a persistent gateway
process so the team can talk to it from Discord.

**Choice of record:** Hermes lives **only on the EC2 box**, not in
git. If the box dies, this document is the rebuild recipe. That was a
deliberate trade for ops-on-the-box simplicity over version-controlled
infra; if it bites us, the answer is to move Hermes into its own
`tspugh/hermes-ops` repo rather than fold it into the Curie product
repo.

---

## 1. What this is

A self-improving AI agent (Nous Research's Hermes-Agent v0.14+) that:

- listens on Discord (and optionally Telegram / Slack / Signal — same gateway, more env vars)
- thinks via [OpenRouter](https://openrouter.ai) (200+ models, swappable with `hermes model`)
- has a built-in skills system, FTS5 session search, cron-scheduled automations, and isolated subagent delegation
- per-user session isolation inside shared channels by default (Alice and Bob in `#research` get separate transcripts even when typing in the same channel)

What it is **not**, in our setup yet:

- not wired up to invoke Claude Code CLI as a tool — that's a v2 add via Hermes's tool registry
- not configured with persistent skills beyond the defaults
- not exposed on any platform besides Discord

---

## 2. Architecture on the box

```
   Discord ──── WebSocket gateway ────► hermes-gateway.service (systemd, user=hermes)
                                             │
                                             │ HTTPS
                                             ▼
                                       OpenRouter API
                                       (the "brain")
```

| Where | What |
|---|---|
| `/home/hermes/` | hermes system user home; `0750 hermes:hermes`. |
| `/home/hermes/.hermes/` | Hermes data dir. Holds `config.yaml`, `.env`, session DB, audio cache, cron state, SOUL.md. |
| `/home/hermes/.hermes/hermes-agent/` | Git checkout of the Hermes-Agent project. |
| `/home/hermes/.local/bin/hermes` | The CLI entrypoint. |
| `/etc/hermes/env` | Credentials & runtime overrides. `0640 root:hermes`. **Source of truth for secrets.** |
| `/etc/systemd/system/hermes-gateway.service` | systemd unit running `hermes gateway`. |
| `/usr/local/sbin/autoshutdown.sh` | Patched to count an active `hermes-gateway.service` as "the box is in use" — see [dev-instance.md §2](./dev-instance.md). |

---

## 3. Rebuild recipe (run on a fresh `cliqueue-dev`)

Everything below is one-shot — script lives at `/tmp/` until you copy it
into a real config-mgmt path. The original commands also live in this
repo's git history under commits authored 2026-05-19.

### 3a. OS deps + dedicated user

```bash
sudo apt-get install -y ripgrep ffmpeg build-essential python3-dev libffi-dev
sudo useradd --system --create-home --home-dir /home/hermes --shell /bin/bash --comment "Hermes Agent" hermes
sudo install -d -o root -g hermes -m 0750 /etc/hermes
```

### 3b. Install Hermes-Agent as the hermes user

```bash
sudo -u hermes -H bash -c '
  cd "$HOME"
  curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh \
    | bash -s -- --skip-setup --skip-browser
'
# Verify:
sudo -u hermes -H bash -lc 'hermes --version'
```

`--skip-setup` keeps the install non-interactive (we provide config via
env file instead). `--skip-browser` skips the ~300 MiB Playwright /
Chromium download — Hermes browser tools won't work, but the Discord
gateway and OpenRouter brain do not need them.

### 3c. Credentials

Edit `/etc/hermes/env` (the install script creates a template):

```ini
# Discord
DISCORD_BOT_TOKEN=MT...
DISCORD_ALLOWED_USERS=284102345871466496,198765432109876543,...
# DISCORD_FREE_RESPONSE_CHANNELS=<channel-id-where-no-@-needed>
# DISCORD_HOME_CHANNEL=<channel-id-for-proactive-cron-output>

# OpenRouter brain
OPENROUTER_API_KEY=sk-or-v1-...

# Hermes wiring (don't change unless you know why)
HERMES_HOME=/home/hermes/.hermes
HOME=/home/hermes
```

Permissions: `chown root:hermes /etc/hermes/env && chmod 0640 /etc/hermes/env`.

### 3d. systemd unit

`/etc/systemd/system/hermes-gateway.service` — already on the live
box, regeneration script is at `/tmp/hermes-systemd.sh` if you need
it. Service contents are reproduced in §6 below for recovery.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hermes-gateway.service
sudo systemctl status hermes-gateway.service
sudo journalctl -u hermes-gateway.service -f   # tail logs
```

### 3e. Autoshutdown awareness

`/usr/local/sbin/autoshutdown.sh` is patched to count an
**enabled+active** `hermes-gateway.service` as activity. The box
therefore stays up while Hermes is running and idles down only when
Hermes is intentionally stopped (`systemctl stop hermes-gateway`).
The fresh-box variant of this script (which has no Hermes check) lives
in [`cliqueue-dev-userdata.yaml`](./cliqueue-dev-userdata.yaml) — that
yaml has been updated to bake in the Hermes-aware variant so future
rebuilds match.

---

## 4. Day-to-day operations

```bash
# Status / start / stop / restart
sudo systemctl status  hermes-gateway
sudo systemctl restart hermes-gateway
sudo systemctl stop    hermes-gateway    # also lets the box auto-stop

# Logs (follow live)
sudo journalctl -u hermes-gateway -f

# Logs (last hour, no follow)
sudo journalctl -u hermes-gateway --since "1 hour ago"

# Run hermes commands as the hermes user (e.g. switch models, list tools)
sudo -u hermes -H bash -lc 'hermes model'
sudo -u hermes -H bash -lc 'hermes tools'
sudo -u hermes -H bash -lc 'hermes config get'

# Update Hermes itself
sudo -u hermes -H bash -lc 'hermes update'
sudo systemctl restart hermes-gateway
```

After editing `/etc/hermes/env`, you **must** `systemctl restart hermes-gateway` — systemd reads the env file once at process start.

---

## 5. Hard rules

- **PHI never enters Discord.** Discord is not BAA-eligible and stores
  messages indefinitely. The Hermes system prompt (set in `config.yaml`
  or via per-channel prompts) must enforce this; if a user posts PHI,
  Hermes responds with a redact warning and does not echo the content.
  This is the project-wide rule from `CLAUDE.md` carried into the chat
  layer.
- **`DISCORD_ALLOWED_USERS` is the auth boundary.** With no allowed
  users / roles set, the gateway denies all messages. New teammates
  must be added to this list (and `systemctl restart hermes-gateway`)
  before they can talk to the bot.
- **Don't put credentials in `config.yaml`.** `/etc/hermes/env` is the
  one place. `config.yaml` is committed to nowhere right now but the
  rule prevents future drift.
- **Default model is cost-conscious.** Hermes's `--skip-setup` install
  shipped with `anthropic/claude-opus-4.6` as the default — that's
  ~$15/$75 per 1M tokens and unacceptable for a chat-style daemon.
  Current default is whatever's set under `model.default` in
  `/home/hermes/.hermes/config.yaml`; swap there + `systemctl restart
  hermes-gateway` to apply. Anything bigger than mid-tier (e.g.
  `claude-sonnet-4`, `gpt-4o`) as default needs an explicit per-user
  budget cap first — a runaway thread on Opus / `gpt-5-pro` racks up
  real dollars fast. Per-call escalation to a bigger model can still
  happen via the `/model` slash command in Discord (per-session) or
  via the `auxiliary:` config block (per-task — see §13 below).
- **Pin `provider:` explicitly to `"openrouter"`** under `model:` in
  `~/.hermes/config.yaml`. Never leave it on `auto`. The EC2 has AWS
  credentials in scope (via the IAM role), and `provider: auto` will
  route chat calls to AWS Bedrock — silently breaking any model
  Bedrock doesn't host. The symptom is `ConverseStream operation: The
  provided model identifier is invalid`. Same caution for any future
  `auxiliary:` slot that names a provider.

---

## 6. systemd unit (verbatim, for recovery)

```ini
[Unit]
Description=Hermes-Agent gateway (Discord, etc.)
Documentation=https://hermes-agent.nousresearch.com/docs/
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=hermes
Group=hermes
WorkingDirectory=/home/hermes
EnvironmentFile=/etc/hermes/env
Environment=HOME=/home/hermes
Environment=PATH=/home/hermes/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/hermes/.local/bin/hermes gateway
Restart=on-failure
RestartSec=15s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hermes-gateway

NoNewPrivileges=true
ProtectSystem=full
ProtectHome=read-only
ReadWritePaths=/home/hermes
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true

[Install]
WantedBy=multi-user.target
```

---

## 6a. CLI smoke test

Whenever you change `model.default`, `provider:`, rotate
`OPENROUTER_API_KEY`, or run `hermes update`, run this before walking
away — it round-trips the configured provider without going through
Discord:

```bash
sudo -u hermes -H bash -lc \
  'set -a; . /etc/hermes/env; set +a; hermes -z "Reply with the single word: pong" --yolo'
```

Expected: `pong`. Three non-obvious bits:

- `-z` = non-interactive prompt (one-shot, no TUI).
- `--yolo` skips tool-approval prompts that would hang waiting for stdin.
- `set -a; . /etc/hermes/env; set +a` is essential — `/etc/hermes/env`
  is `EnvironmentFile=` for the systemd service, but a manual
  `sudo -u hermes` shell does NOT auto-source it. A `No LLM provider
  configured` error from this test almost always means you forgot the
  sourcing step, not a real config problem.

A Bedrock-shaped error (`ConverseStream operation: The provided model
identifier is invalid`) means provider-routing is wrong — pin
`provider: "openrouter"` in `config.yaml` and restart.

---

## 6b. Claude Code authentication for the `hermes` user

Hermes delegates "do real coding work" requests to the bundled
[`claude-code` skill](https://github.com/NousResearch/hermes-agent/blob/main/skills/autonomous-ai-agents/claude-code/SKILL.md)
(at `/home/hermes/.hermes/skills/autonomous-ai-agents/claude-code/` on
this box). Claude Code needs to be authenticated AS the `hermes` user,
since that's who the gateway runs as.

### Current state (2026-05-19)

- Authenticated as `tspoonthegamer@gmail.com`, `subscriptionType: max`,
  `apiProvider: firstParty`. Credentials in `/home/hermes/.claude/`.
- Smoke-tested working end-to-end via print mode from
  `/src/curie-coding-blockchain`.

### Re-authenticating (when the token expires or someone changes account)

OAuth on a headless EC2 needs the URL to be opened in Thomas's local
browser, with the resulting code pasted back into a still-alive `claude
auth login` process on the box. The trick: keep the auth process alive
between the two halves of the round-trip with tmux.

**Half 1 — start auth and capture URL** (one SSM call):

```bash
sudo -u hermes -H bash -lc 'tmux kill-session -t claude-auth 2>/dev/null || true'
sudo -u hermes -H bash -lc 'tmux new-session -d -s claude-auth \
  "claude auth login --claudeai --email <YOUR_EMAIL>"'
sleep 5
sudo -u hermes -H bash -lc 'tmux capture-pane -t claude-auth -p'
```

The pane contents will include `If the browser didn't open, visit:
https://claude.com/cai/oauth/authorize?...`. Stitch that URL together
(remove the terminal line-wraps) and open it in your browser. Complete
the Anthropic login (with 2FA). The callback page at
`platform.claude.com/oauth/code/callback` shows a code formatted as
`<random>#<state>`. **State must match** the `state=` param in the
original URL — confirmation that you're closing the same PKCE
session.

**Half 2 — paste code back** (second SSM call):

```bash
sudo -u hermes -H bash -lc \
  "tmux send-keys -t claude-auth -- '<PASTE_CODE_HERE>' Enter"
sleep 6
sudo -u hermes -H bash -lc 'claude auth status'
```

`claude auth status` should now report `"loggedIn": true`. The tmux
session exits when `claude auth login` succeeds (which kills the
session) — that's expected.

### Verifying Claude Code works after auth

```bash
sudo -u hermes -H bash -lc \
  'cd /src/curie-coding-blockchain && \
   claude -p "Reply with only the word: ready" \
          --dangerously-skip-permissions --output-format json' \
  | head -3
```

`subtype: "success"` with `result: "ready"` confirms the whole path
works. First call costs ~$0.19 on Max plan (cache creation overhead);
subsequent calls within 1h reuse the cache and run ~$0.01–0.05.

### Don't run `claude doctor` on this box

It hangs (TTY probing / network checks that don't terminate via
SSM). Use `claude --version` + `claude auth status` for sanity instead.

---

## 6d. GitHub auth for the `hermes` user

Hermes needs to be able to `git push` and use `gh` (for PRs, issues,
comments). Per-user, separate from anything the `ubuntu` user has
configured.

### Current state (2026-05-19)

- **`gh` authenticated** as `tspugh` via a fine-grained PAT scoped to
  *only* `tspugh/curie-coding-blockchain`. Token in
  `/home/hermes/.config/gh/hosts.yml`. Token expires per its GitHub
  setting (90-day default recommended).
- **Git HTTPS credential helper** wired to `gh` via
  `gh auth setup-git` — `git push` over HTTPS transparently uses the
  PAT, no token in `.git/config`.
- **Git identity**: `user.name = "Hermes Bot"`, `user.email =
  "hermes@cliqueue-dev"`. Email doesn't match any GitHub user, so
  commits appear on GitHub as "Hermes Bot" without linking to a
  human's profile — clearly machine-attributed.
- **Writable clone**: `/home/hermes/repos/curie-coding-blockchain` —
  fresh clone the hermes user owns. Remote `origin` is the HTTPS URL
  so the credential helper kicks in automatically.
- **Gateway `WorkingDirectory`** is now this clone (was `/src/...`),
  so Hermes auto-loads `AGENTS.md` from a tree it can actually write
  to. The shared read-only `/src/curie-coding-blockchain` clone stays
  in place for teammates SSH-ing in as `ubuntu`.

### Required PAT permissions (for rotation)

Generate at <https://github.com/settings/tokens?type=beta>:

- **Token name**: anything (`cliqueue-dev-hermes` is the convention)
- **Repository access**: Only select repositories →
  `tspugh/curie-coding-blockchain`
- **Repository permissions**:
  - Contents: Read and write (git push)
  - Pull requests: Read and write (`gh pr ...`)
  - Issues: Read and write (`gh issue ...`)
  - Metadata: Read (auto-set, required)
- All other permissions: No access

Why fine-grained over a deploy key: deploy keys can't authenticate
`gh` CLI. A PAT covers both git and gh with one credential, has
explicit expiration (forcing rotation), and per-call audit.

### Rotation procedure

```bash
# On the box, as the hermes user (via SSM):
echo '<NEW_TOKEN>' | sudo -u hermes -H bash -lc \
  'gh auth login --hostname github.com --git-protocol https --with-token'
# gh auth setup-git is idempotent; the new token is now active.
# Don't forget to revoke the old token in the GitHub UI.
```

No `systemctl restart hermes-gateway` needed — the gateway uses the
git/gh credentials only when it shells out to `git`/`gh` (via the
`terminal` tool), which re-reads creds each invocation.

### Verifying auth

```bash
sudo -u hermes -H bash -lc 'gh auth status'
sudo -u hermes -H git -C /home/hermes/repos/curie-coding-blockchain push --dry-run origin master
```

"Everything up-to-date" = working. A 403 / "permission denied" means
either the PAT lacks the right Contents permission, or it's expired
and needs rotation.

---

## 6c. Observability — claude-invocation log

Every Claude Code invocation Hermes makes through the bundled
`claude-code` skill is logged as JSONL to
`/home/hermes/.hermes/logs/claude-invocations.jsonl`. Useful for spot-
checking what Hermes has been asking Claude to do, watching burn rate
against the Max plan, and catching bad delegations early.

**How it works:** a Hermes shell hook on `post_tool_call` (matcher
`"terminal"`) at `/home/hermes/.hermes/agent-hooks/log-claude.sh`.
Fires on every terminal call, bash-filters for commands starting with
`claude`, parses the embedded `--output-format json` result if
present, and appends one JSONL record per invocation.

Hooks system docs: <https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks>.

### Sample JSONL record

```json
{
  "ts": "2026-05-19T01:41:42Z",
  "session": "test-session-001",
  "cwd": "/src/curie-coding-blockchain",
  "cmd": "claude -p 'synthetic test' --dangerously-skip-permissions --output-format json",
  "exit_code": 0,
  "duration_ms": 2500,
  "total_cost_usd": 0.0123,
  "num_turns": 2,
  "result": "synthetic OK"
}
```

(`session` is the Hermes session id, not Claude's. `result` is
truncated to 500 chars.)

### Common queries

```bash
# tail the live log
sudo tail -F /home/hermes/.hermes/logs/claude-invocations.jsonl | jq .

# today's invocations
sudo grep "$(date -u +%Y-%m-%d)" /home/hermes/.hermes/logs/claude-invocations.jsonl | jq .

# sum cost (api-equivalent, against Max plan quota — not $)
sudo jq -s 'map(.total_cost_usd // 0) | add' /home/hermes/.hermes/logs/claude-invocations.jsonl

# anything that exited non-zero
sudo jq 'select(.exit_code != 0 and .exit_code != null)' /home/hermes/.hermes/logs/claude-invocations.jsonl
```

### Rotation (manual for now)

There's no logrotate set up. The hook script will keep appending. When
it grows annoying:

```bash
sudo -u hermes -H truncate -s 0 /home/hermes/.hermes/logs/claude-invocations.jsonl
```

If/when this becomes a real concern, add a `/etc/logrotate.d/hermes`
config that rotates daily and keeps 14 days.

### Output verbosity (Discord)

Hermes ships chatty by default — per-tool narration, mid-turn "thinking
aloud" updates, token streaming. We've quieted it. Settings live under
`~/.hermes/config.yaml`:

```yaml
display:
  tool_progress: off                # was: all   — kills per-tool narration
  interim_assistant_messages: false # was: true  — kills mid-turn updates
  # also valid: new | all | verbose. Per-platform override available via
  # display.platforms.discord.tool_progress if you want CLI verbose and
  # Discord quiet.
streaming:
  enabled: false                    # already the default; affirmed
discord:
  reactions: true                   # leave on — inline emojis (👀/✅/❌)
                                    # are useful "I'm working" signal
                                    # without filling the channel
```

After editing config.yaml: `systemctl restart hermes-gateway`. Net
effect on Discord: one message per turn, only the final result. SOUL.md
reinforces this with a "speak once per request" rule so the LLM
doesn't fight the config.

### Where the hook is registered

In `/home/hermes/.hermes/config.yaml`:

```yaml
hooks_auto_accept: true   # required for systemd gateway (no TTY for approval prompt)

hooks:
  post_tool_call:
    - matcher: "terminal"
      command: "/home/hermes/.hermes/agent-hooks/log-claude.sh"
      timeout: 5
```

`hermes hooks list` shows the registered chain. `hermes hooks revoke
<command>` removes from the allowlist. There is no `hermes hooks add`
— hooks are declared in `config.yaml`, not via CLI.

---

## 13. Model tiers, fallback, and per-session override

Hermes-Agent supports three independent mechanisms for routing
different work to different models — all upstream-documented at
<https://hermes-agent.nousresearch.com/docs/user-guide/configuring-models.md>:

| Mechanism | Where it lives | Use for |
|---|---|---|
| `/model <id>` Discord slash command | per-Discord-session map (`_session_model_overrides`) | "Use a smarter model just for this thread." Append `--global` to persist. |
| `auxiliary:` block in `config.yaml` | 8 task slots: `compression`, `vision`, `web_extract`, `title_gen`, `approval`, `skills`, `mcp`, `goal_judge` | Per-task tiering. Cheap model for boring tasks (title generation); expensive model for sensitive ones (approval). Each defaults to `provider: auto` → main model. **Pin provider explicitly per slot for the same reason as §5.** |
| `fallback_providers:` list, managed via `hermes fallback {add,list,remove,clear}` | top-level in `config.yaml` | Auto-route to next provider on 429/500/502/503 (after retries), 401/403/404 (immediate), or malformed responses. Independent fallback for auxiliary tasks too. |

### Current state (2026-05-19)

```
Primary:   qwen/qwen3.6-flash  (via openrouter)
Fallback:  deepseek/deepseek-v4-flash  (via openrouter)
```

Verify with `hermes fallback list` (or `hermes fallback ls`).

### Adding / removing fallbacks

The CLI subcommand `hermes fallback add` is an interactive TUI — it
won't drive over SSM `RunShellScript`. Two paths:

**Direct config.yaml edit (SSM-friendly):**

```yaml
# at top level of /home/hermes/.hermes/config.yaml
fallback_providers:
  - provider: openrouter
    model: deepseek/deepseek-v4-flash
  - provider: anthropic
    model: claude-haiku-4-5             # only if ANTHROPIC_API_KEY is set
```

Restart `hermes-gateway` after editing. Schema reference:
<https://hermes-agent.nousresearch.com/docs/user-guide/features/fallback-providers>
(table of supported `provider:` values + required env vars).

**Interactive (real SSM session):**

```bash
sudo -u hermes -H bash -lc 'set -a; . /etc/hermes/env; set +a; hermes fallback'
```

Example — pin a cheap `qwen/qwen3-8b` for `title_gen` (runs on every
new Discord thread, so even small per-call savings add up):

```yaml
# in /home/hermes/.hermes/config.yaml
auxiliary:
  title_gen:
    provider: openrouter
    model: qwen/qwen3-8b
```

After any `auxiliary:` or `fallback_providers:` change: `systemctl
restart hermes-gateway`.

---

## 7. v2 roadmap (planned, not built)

In rough priority order:

1. **Claude Code as a Hermes tool.** Wire the local `claude` CLI into
   Hermes's tool registry so "do real repo work" requests can spawn a
   bounded Claude Code subagent against a per-user clone in `/src`.
   Owns its own per-request cost budget.
2. **Hermes-aware per-user budget caps via OpenRouter.** Stop one
   curious teammate from racking up $500 in `o1-pro` calls.
3. **Persistent skills tuned for this project.** Skills for "summarize
   the latest research findings under `docs/research/`", "open a PR
   against curie with this diff", "post a daily standup digest to
   `#standup`".
4. **GitHub event integration.** Hermes posts PR / issue activity into
   designated channels; replies to PR comments are mirrored back to
   GitHub.
5. **Migration path off direct-on-box if/when this hurts.** Move
   `/etc/hermes/env` provenance into AWS Secrets Manager; move the
   systemd unit + install script into a `tspugh/hermes-ops` repo;
   keep Hermes itself one `hermes update` away.

---

## 8. Teardown

```bash
sudo systemctl disable --now hermes-gateway.service
sudo rm /etc/systemd/system/hermes-gateway.service
sudo rm -rf /etc/hermes /home/hermes
sudo userdel hermes  # safe; --remove was implicit via -rf above
sudo systemctl daemon-reload
```

Don't forget to revoke the Discord bot token (Developer Portal → Bot
→ Reset Token) and delete the OpenRouter API key — leaving them live
costs nothing but leaks if either ever escapes.

# Shared AWS Dev Instance — `cliqueue-dev`

This document describes the shared development EC2 instance for the
`cliqueue-coding-blockchain` project: how to connect, how to start/stop it,
what it costs, and how to rebuild it from scratch if needed.

**Audience:** repo collaborators with their own IAM user in the
`471112593726` AWS account.

> Status (2026-05-17): instance provisioned, connect verified, three
> developer IAM users created (`ols.violet`, `ripperda.grant`,
> `pugh.thomas`).

---

## 1. What and why

A small, always-reachable Linux box that mirrors a Raspberry Pi 4/5 in
shape (ARM64, 2 vCPU, 2 GiB RAM) so the team can:

- run shared development sessions against the repo without each person
  needing a working local environment,
- run experiments that need a stable public IP or AWS-side network
  access (a Pi behind a home NAT can't be reached by AWS services
  cleanly), and
- have a single host to develop and later run agents from when we wire
  up databases / blob storage / Somnia RPC endpoints.

The goal is **Pi-sized and cheap**, not "general-purpose dev cloud." If
we outgrow this, we resize the instance (one `aws ec2 modify-instance-attribute`
call) rather than restarting from scratch.

---

## 2. Architecture at a glance

```
       your terminal
            │
            ▼  aws ssm start-session
   ┌──────────────────────┐
   │   AWS SSM endpoint   │  (TLS, IAM-authenticated)
   └──────────┬───────────┘
              │   Systems Manager session
              ▼
┌─────────────────────────────────────────────────────────┐
│  EC2 instance  i-08277e97e32de4767                      │
│  Name: cliqueue-dev   Type: t4g.medium (ARM Graviton2)  │
│  AMI : Ubuntu 24.04 LTS arm64                           │
│  Disk: 30 GiB gp3, encrypted, persists across stops     │
│                                                         │
│  • SSM agent (snap)  ──▶ AWS SSM control plane          │
│  • autoshutdown.timer ─▶ stops self after 60 min idle   │
│  • IAM role: cliqueue-dev-ec2-role                      │
│      └─ AmazonSSMManagedInstanceCore                    │
└─────────────────────────────────────────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │  default VPC subnet  │   us-east-1a   sg: cliqueue-dev-sg
   │  (public IP, no      │   No inbound rules.
   │   inbound exposure)  │   Outbound: all.
   └──────────────────────┘
```

**Key design choices:**

- **No SSH port open.** All shell access goes through AWS SSM
  Session Manager. There is no port 22 to brute-force, no shared
  private key to leak, and no bastion to maintain. Authentication is
  the user's IAM identity.
- **ARM (`t4g`) over x86 (`t3`).** Same architecture as a Raspberry Pi,
  ~20% cheaper for equivalent vCPU/RAM, and anything we build here
  runs identically on a Pi.
- **EBS persists when stopped.** Stopping the instance removes compute
  billing but keeps the 30 GB root volume. Home directories and the
  cloned repo survive across stop/start cycles. Only termination loses
  the disk.
- **Activity-based auto-shutdown, no Lambda.** A 5-minute systemd timer
  on the instance itself checks for any logged-in user, any tmux
  session, any live SSM session worker, **or an active
  `hermes-gateway.service`**, and triggers `shutdown -h` after 60
  minutes of no activity. Zero AWS-side infrastructure. The
  Hermes-aware branch is a no-op on fresh boxes where the unit isn't
  installed.

---

## 3. Resource inventory

All resources live in **`us-east-1`** under account **`471112593726`**.

| Resource | Identifier | Notes |
|---|---|---|
| IAM admin user | `cliqueue-admin` | Used by Claude / Thomas to administer the box. AdministratorAccess. |
| IAM role (EC2) | `cliqueue-dev-ec2-role` | Trust: ec2.amazonaws.com. Policy: AmazonSSMManagedInstanceCore. |
| Instance profile | `cliqueue-dev-ec2-role` | Same name as the role. Attached to the instance. |
| VPC | `vpc-0ed7e218b626886eb` | Default VPC (`172.31.0.0/16`), created 2026-05-17. |
| Subnet | `subnet-0096b300d5e0a668c` | us-east-1a, public, `172.31.0.0/20`. |
| Security group | `sg-0255a1168297d43ce` | `cliqueue-dev-sg`. No inbound. |
| EC2 instance | `i-08277e97e32de4767` | `cliqueue-dev`. t4g.medium (resized up from t4g.small 2026-05-26 — 2 GiB was too small for the in-repo `claude --dangerously-skip-permissions` agent workload, which RAM-saturated the box and wedged SSM). |
| Root volume | (attached to instance) | 30 GiB gp3, encrypted, delete-on-termination. |
| GitHub repo | `tspugh/curie-coding-blockchain` (private) | <https://github.com/tspugh/curie-coding-blockchain>. |
| Deploy key | `cliqueue-dev (i-08277e97e32de4767)` id `151779932`, read-write | Lives at `/home/ubuntu/.ssh/curie-deploy` on the box. Trusted for `github.com` via `~ubuntu/.ssh/config`. |
| Shared clone | `/src/curie-coding-blockchain` | Owned `ubuntu:ubuntu` mode `2775` (setgid). Reference tree on the box — see §8 for per-user vs. shared-tree tradeoff. |
| Hermes-Agent gateway | `hermes-gateway.service` (systemd), user `hermes`, install at `/home/hermes/.hermes/` | Discord communication layer powered by OpenRouter. **Lives only on the box, not in git** — full rebuild recipe in [`hermes.md`](./hermes.md). |

---

## 4. Cost model

On-demand pricing, us-east-1, as of 2026-05.

| Component | Rate | Always-on (730 h/mo) | Stopped 16 h/day weekdays + weekends (~160 h/mo) |
|---|---|---|---|
| t4g.medium compute | $0.0336 / hr | $24.53 / mo | $5.38 / mo |
| EBS gp3, 30 GiB | $0.08 / GiB-mo | $2.40 / mo | $2.40 / mo |
| Outbound data transfer | 100 GiB/mo free | ~$0 | ~$0 |
| Security group, IAM, SSM | $0 | $0 | $0 |
| **Total** | | **~$14.66 / mo** | **~$5.09 / mo** |

The 60-minute idle auto-shutdown should land us close to the
right-hand column in practice. Compute is only billed while the
instance is in `running` state; the EBS volume is billed continuously
until it is deleted.

---

## 5. Connect from your local machine

### One-time setup (per developer)

1. **Have an IAM user in account `471112593726`** with permission to
   call `ssm:StartSession` on this instance. (For Thomas this is
   `cliqueue-admin`; teammate users will be created as documented in
   §9.)
2. **Configure an AWS CLI profile** with that user's access keys:

   ```bash
   aws configure --profile cliqueue-admin
   # AWS Access Key ID:     <paste>
   # AWS Secret Access Key: <paste>
   # Default region:        us-east-1
   # Default output format: json
   ```
3. **Install the AWS Session Manager plugin** (one-time, per machine).
   Ubuntu / Debian ARM64:

   ```bash
   curl -fsSLO "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_arm64/session-manager-plugin.deb"
   sudo dpkg -i session-manager-plugin.deb
   rm session-manager-plugin.deb
   ```

   For x86_64, swap `ubuntu_arm64` → `ubuntu_64bit`. For macOS, see
   <https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html>.

### Connect

```bash
aws --profile cliqueue-admin ssm start-session --target i-08277e97e32de4767
```

That drops you into a shell as `ssm-user`. To work as a normal user
with `sudo`:

```bash
sudo -iu ubuntu
```

**Reconnect-safe long-running work:** start a `tmux` session so your
work survives disconnect AND keeps the auto-shutdown timer from
triggering:

```bash
tmux new -s work     # first time
tmux attach -t work  # subsequent
```

---

## 6. Start / stop the instance

```bash
# Status
aws --profile cliqueue-admin ec2 describe-instances \
  --instance-ids i-08277e97e32de4767 \
  --query 'Reservations[0].Instances[0].State.Name' --output text

# Start (about 30 s to be SSM-reachable again)
aws --profile cliqueue-admin ec2 start-instances --instance-ids i-08277e97e32de4767

# Stop manually (don't wait for the idle timer)
aws --profile cliqueue-admin ec2 stop-instances --instance-ids i-08277e97e32de4767
```

A stopped instance bills only for its EBS volume (~$2.40/mo).

### How the auto-shutdown works

A systemd unit on the instance runs `/usr/local/sbin/autoshutdown.sh`
every 5 minutes (`systemctl list-timers autoshutdown.timer`). The
script counts the instance as **active** if any of:

- `who` returns at least one logged-in user
- `tmux ls` (for the `ubuntu` user) returns any sessions
- a live `ssm-session-worker` process exists

If none of those is true, it records the time. After 60 minutes of
continuous idleness it calls `shutdown -h now`, which lands the
instance in `stopped` state (because `InstanceInitiatedShutdownBehavior`
defaults to `stop` for EBS-backed instances).

**Edit the threshold** by SSM-shelling in and editing
`/usr/local/sbin/autoshutdown.sh` — change `IDLE_THRESHOLD_MIN=60` and
no daemon restart is needed (the timer re-reads the script each fire).

---

## 7. Rebuild from scratch

If the instance is corrupted, lost, or we want to bump its size:

```bash
# Terminate (destroys the EBS volume too — back up anything you care about first)
aws --profile cliqueue-admin ec2 terminate-instances --instance-ids i-08277e97e32de4767

# Re-launch (drop-in replacement, same shape; bump --instance-type to upgrade)
aws --profile cliqueue-admin ec2 run-instances \
  --image-id "$(aws --profile cliqueue-admin ssm get-parameter \
      --name /aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id \
      --query Parameter.Value --output text)" \
  --instance-type t4g.small \
  --subnet-id subnet-0096b300d5e0a668c \
  --security-group-ids sg-0255a1168297d43ce \
  --iam-instance-profile Name=cliqueue-dev-ec2-role \
  --user-data file://docs/infra/cliqueue-dev-userdata.yaml \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true,"Encrypted":true}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cliqueue-dev},{Key=Project,Value=cliqueue-coding-blockchain},{Key=Env,Value=dev}]'
```

The cloud-init user-data that boot-strapped this instance is checked
in at [`docs/infra/cliqueue-dev-userdata.yaml`](./cliqueue-dev-userdata.yaml).
Edit it before re-launching if you want to change the autoshutdown
threshold, installed packages, or the systemd timer cadence.

**To resize instead of rebuild** (no data loss):

```bash
aws --profile cliqueue-admin ec2 stop-instances --instance-ids i-08277e97e32de4767
aws --profile cliqueue-admin ec2 wait instance-stopped --instance-ids i-08277e97e32de4767
aws --profile cliqueue-admin ec2 modify-instance-attribute --instance-id i-08277e97e32de4767 --instance-type t4g.medium
aws --profile cliqueue-admin ec2 start-instances --instance-ids i-08277e97e32de4767
```

---

## 8. Clone the repo

The remote is **<https://github.com/tspugh/curie-coding-blockchain>**
(private). Two ways to consume it on the box:

### 8a. Shared reference clone at `/src/curie-coding-blockchain` (already exists)

A read-write clone is pre-installed at `/src/curie-coding-blockchain`,
owned `ubuntu:ubuntu` mode `2775` (setgid). It authenticates to
GitHub via the deploy key at `/home/ubuntu/.ssh/curie-deploy`
(registered on the repo as `cliqueue-dev (i-08277e97e32de4767)`,
deploy-key id `151779932`).

To pull updates:

```bash
sudo -u ubuntu git -C /src/curie-coding-blockchain pull
```

**Caveat — author attribution.** All teammates currently `sudo -iu ubuntu`
to a shared OS user, so any commit pushed from `/src/...` is attributed
to whoever set the global `git config user.{name,email}` first. For
that reason, treat the shared clone as a *reference / build host* and
do active commit work in a per-user clone (§8b).

### 8b. Per-user clone in your home directory (recommended for active dev)

```bash
# Once per user, after `sudo -iu ubuntu`:
git config --global user.name "<Your Name>"
git config --global user.email "<your.email>"
gh auth login   # picks your own GitHub identity; stored under ~/.config/gh
git clone https://github.com/tspugh/curie-coding-blockchain.git ~/curie
```

`gh auth login` configures the `gh` git credential helper, so HTTPS
clones over your own GitHub identity work without copying tokens
around. Commits get correctly attributed to you, not to a shared
deploy key.

### Deploy-key rotation / revocation

```bash
# List
gh repo deploy-key list --repo tspugh/curie-coding-blockchain
# Revoke (e.g., after terminating the instance)
gh repo deploy-key delete <KEY_ID> --repo tspugh/curie-coding-blockchain
```

---

## 9. Developer IAM users

The following developer IAM users exist (created 2026-05-17). Each has
the inline `cliqueue-dev-access` policy (SSM connect to the dev
instance + start/stop on any resource tagged `Project=cliqueue-coding-blockchain`),
plus `IAMUserChangePassword` for self-service password rotation:

| User | Email | Extra |
|---|---|---|
| `ols.violet` | violet.ols.dev@gmail.com | — |
| `ripperda.grant` | grantripperda@gmail.com | — |
| `pugh.thomas` | tspugh02@gmail.com | `AdministratorAccess` (project lead) |

Each user received a temporary console password (force-change on first
login) and a programmatic access key, delivered out-of-band. Console
sign-in URL: <https://471112593726.signin.aws.amazon.com/console>.

### To add a future user

Replace `<USERNAME>` and `<EMAIL>` below:

```bash
USERNAME=<USERNAME>
aws --profile cliqueue-admin iam create-user --user-name "$USERNAME" \
  --tags Key=Email,Value=<EMAIL> Key=Project,Value=cliqueue-coding-blockchain

# Per-user policy: start SSM session + start/stop the dev instance only
cat > /tmp/cliqueue-dev-user-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:StartSession"],
      "Resource": [
        "arn:aws:ec2:us-east-1:471112593726:instance/i-08277e97e32de4767",
        "arn:aws:ssm:us-east-1::document/AWS-StartSSHSession",
        "arn:aws:ssm:us-east-1::document/SSM-SessionManagerRunShell"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:TerminateSession","ssm:ResumeSession"],
      "Resource": "arn:aws:ssm:*:*:session/${aws:username}-*"
    },
    {
      "Effect": "Allow",
      "Action": ["ec2:StartInstances","ec2:StopInstances","ec2:DescribeInstances","ec2:DescribeInstanceStatus"],
      "Resource": "*",
      "Condition": {"StringEquals": {"ec2:ResourceTag/Project": "cliqueue-coding-blockchain"}}
    }
  ]
}
EOF
aws --profile cliqueue-admin iam put-user-policy --user-name "$USERNAME" \
  --policy-name cliqueue-dev-access --policy-document file:///tmp/cliqueue-dev-user-policy.json

# Programmatic access key — share securely (1Password / Bitwarden). Show once.
aws --profile cliqueue-admin iam create-access-key --user-name "$USERNAME"
```

The teammate then follows §5 ("Connect from your local machine") with
those credentials.

---

## 10. Future expansion — extending the EC2 role for AWS resources

Today the instance's IAM role (`cliqueue-dev-ec2-role`) has only
`AmazonSSMManagedInstanceCore`. When we add AWS resources the agents
or app need to talk to, attach the relevant policy to **the role**, not
to each user — that way every shell on the box (and any background
agent) inherits access without anyone juggling keys.

Likely additions, in priority order:

- **Secrets Manager (read).** For DB passwords, GitHub PATs, Somnia RPC
  API keys. Attach `SecretsManagerReadWrite` scoped by tag, or write a
  bespoke `secretsmanager:GetSecretValue` policy keyed to project-tagged
  secrets.
- **S3 (per-bucket).** For storing claim packages off-chain (the
  PHI-bearing payloads that the chain only sees as hashes — see
  `docs/research/agreement-layer/`). Bespoke policy with
  `s3:GetObject`/`PutObject`/`ListBucket` on the specific bucket ARN.
- **RDS / DynamoDB.** If we add a managed database. RDS uses standard
  IAM-authenticated connection, DynamoDB uses table-scoped IAM.
- **Somnia RPC endpoint.** Not an AWS resource; just an HTTPS URL plus
  a key stored in Secrets Manager.

Pattern for adding any new permission:

```bash
# Create a managed policy (reusable) or inline policy (one-off)
aws --profile cliqueue-admin iam put-role-policy \
  --role-name cliqueue-dev-ec2-role \
  --policy-name <descriptive-name> \
  --policy-document file://policy.json
```

Changes take effect immediately on the instance — no restart required.

**PHI / compliance note:** per `CLAUDE.md` and `AGENTS.md`, PHI never
goes on-chain. Any AWS resource we add that stores PHI (S3 buckets,
RDS, etc.) must be encrypted at rest, access-logged, and KMS-keyed.
Document each such addition here.

---

## 11. Security posture & known gaps

What we have:

- IMDSv2 required on the instance (`HttpTokens=required`).
- EBS encrypted at rest (default AWS-managed KMS key).
- No inbound network exposure. All access via IAM-authenticated SSM.
- Cloudtrail records every `ssm:StartSession` and `ec2:*` API call.

Known gaps to address before this becomes anything more than a dev box:

- **AWS account root user still has active access keys.** These should
  be deleted (`aws iam delete-access-key`) once we are confident the
  `cliqueue-admin` user works for all admin tasks. Root should only be
  reachable via console + MFA, never programmatically.
- **No MFA on `cliqueue-admin`.** Add a virtual MFA device and require
  it for IAM-mutating actions.
- **No CloudTrail trail explicitly configured.** AWS records management
  events for 90 days for free; for longer retention, create a trail
  writing to an S3 bucket.
- **SSM session logs are not persisted.** By default, sessions are not
  recorded. If we ever want an audit trail of *what* people typed,
  enable session logging to S3 / CloudWatch Logs in the SSM session
  preferences document.

---

## 12. Tear down (delete everything)

If we ever want to fully zero the AWS spend:

```bash
PROF=cliqueue-admin
aws --profile $PROF ec2 terminate-instances --instance-ids i-08277e97e32de4767
aws --profile $PROF ec2 wait instance-terminated --instance-ids i-08277e97e32de4767
aws --profile $PROF ec2 delete-security-group --group-id sg-0255a1168297d43ce
aws --profile $PROF iam remove-role-from-instance-profile --instance-profile-name cliqueue-dev-ec2-role --role-name cliqueue-dev-ec2-role
aws --profile $PROF iam delete-instance-profile --instance-profile-name cliqueue-dev-ec2-role
aws --profile $PROF iam detach-role-policy --role-name cliqueue-dev-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws --profile $PROF iam delete-role --role-name cliqueue-dev-ec2-role
# (optional) delete the default VPC — leaves nothing behind in us-east-1
aws --profile $PROF ec2 delete-vpc --vpc-id vpc-0ed7e218b626886eb
```

Leaving the IAM users and the (empty) default VPC in place costs
nothing.

---

## 13. Preinstalled developer tools

The cloud-init that bootstraps the box (see
[`cliqueue-dev-userdata.yaml`](./cliqueue-dev-userdata.yaml)) installs
the following **system-wide** so every IAM user shares one copy. Each
human auths separately on first use — there is no shared API key.

| Tool | Source | Verified version (2026-05-17) | Per-user auth needed? |
|---|---|---|---|
| Python 3 + pip + venv | Ubuntu apt (default) | 3.12.3 | No |
| Node.js 22 LTS + npm | NodeSource apt repo | node 22.22.2 / npm 10.9.7 | No |
| Claude Code CLI | `@anthropic-ai/claude-code` global npm | 2.1.143 | **Yes** — run `claude` once, follow prompts |
| uv (Astral) | Official installer → `/usr/local/bin` | 0.11.14 | No |
| GitHub CLI | GitHub's apt repo | 2.92.0 | **Yes** — `gh auth login` once |
| Git, tmux, htop, build-essential, jq, curl, unzip, ca-certificates | Ubuntu apt | — | No |

### First-time per-user setup

After your first `aws ... ssm start-session` and `sudo -iu ubuntu`:

```bash
# 1. Authenticate Claude Code with your own Anthropic account
claude  # follow the OAuth/API-key prompt; credentials land in ~/.claude/

# 2. Authenticate gh (web flow, ~1 min)
gh auth login   # GitHub.com → HTTPS → Yes (auth git) → Login with browser
```

### Adding a new system-wide tool

**Spec-first.** Add it to
[`cliqueue-dev-userdata.yaml`](./cliqueue-dev-userdata.yaml) (the
`install-devtools.sh` `write_files` block — keep it idempotent so it
re-runs cleanly on rebuilds), update this table, then apply to the
live instance via:

```bash
aws --profile pugh.thomas ssm send-command \
  --instance-ids i-08277e97e32de4767 \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["bash /usr/local/sbin/install-devtools.sh"]' \
  --timeout-seconds 600
```

(`install-devtools.sh` is laid down on the box by cloud-init, so it's
already present and just needs re-running.) For tools needed by only
one user, install in their `~/` instead and skip the spec change.

### What's deliberately NOT installed

- **Rust toolchain.** uv ships precompiled; project is pure
  TypeScript; no Rust deps in `package.json`. Adds ~1.5 GiB to root
  volume for no current benefit. Easy to add if a future package
  demands it.
- **pnpm / yarn.** Project's `package.json` uses plain npm; no
  workspaces. corepack is bundled with Node, so any of them are one
  `corepack prepare ... --activate` away.
- **Docker.** No current container workflow. Adds ~400 MiB. Add when
  needed.
- **Global TypeScript.** The project pins its own version
  (`typescript ^5.6.0` in devDependencies); a global copy would
  introduce version-drift confusion.

---

## Appendix A — Cheat sheet

```bash
# Connect
aws --profile cliqueue-admin ssm start-session --target i-08277e97e32de4767

# Start / stop
aws --profile cliqueue-admin ec2 start-instances --instance-ids i-08277e97e32de4767
aws --profile cliqueue-admin ec2 stop-instances  --instance-ids i-08277e97e32de4767

# State
aws --profile cliqueue-admin ec2 describe-instances --instance-ids i-08277e97e32de4767 \
  --query 'Reservations[0].Instances[0].State.Name' --output text

# Live cost-month estimate (running hours so far this month × $0.0168 + $2.40)
```

---

**See also** — this box hosts the headless research + bonsai loop driven by [[../loop-prompts/iteration-prompt|iteration-prompt]] (parent) and [[../loop-prompts/bonsai-cleanup|bonsai-cleanup]] (companion). Loop output lands in the research graph indexed at [[../research/topics/README|topic-hub index]].

export const meta = {
  name: 'spec-implementation-loop',
  description: 'One generalized spec-implementation tick: plan a focused unit, build it (TDD then dev), run the configured verification gates, loop until green, then optionally commit + push.',
  whenToUse: 'Generalization of docs/loop-prompts/spec-4-implementation-loop.md. Pass which spec(s) to implement, which gates to enforce, and which branch/repo to work in. Wrap in /loop for continuous operation.',
  phases: [
    { title: 'Orient', detail: 'git state + loop-state + open findings' },
    { title: 'Plan', detail: 'pick one focused unit from the specs (Sonnet)' },
    { title: 'Build', detail: 'TDD writes the failing test, dev implements (Sonnet)' },
    { title: 'Verify', detail: 'run the configured gates in parallel; loop until green' },
    { title: 'Commit', detail: 'single conventional commit + push if all gates green' },
  ],
}

// ---------------------------------------------------------------------------
// Args (all optional — defaults reproduce the spec-4 loop):
//   specs        : string[]  spec file paths/globs to implement. Default: every
//                            docs/specs/NNNN-*.md whole-number spec (skips frac ledgers).
//   focusSpecs   : string[]  subset to prioritize this tick (e.g. ["0003","0004"]).
//   repoPath     : string    repo root the agents operate in. Default ".".
//   branch       : string    working branch (assert + push target). Default current.
//   baseRef      : string    diff base for the gates. Default "origin/main".
//   gates        : string[]  which gates to enforce. Default: all that apply.
//                            Keys: tests coverage design secret solidity security strict browser
//   focus        : string    explicit unit description — skips the planning agent.
//   mode         : string    "impl" (default) | "creativity".
//   maxRounds    : number    build→verify retries before giving up. Default 3.
//   commit       : boolean   commit + push when green. Default true.
//   stateFile    : string    loop-state path. Default "docs/progress/loop-state.md".
// ---------------------------------------------------------------------------

const a = args || {}
const repo = a.repoPath || '.'
const baseRef = a.baseRef || 'origin/main'
const branch = a.branch || ''
const mode = a.mode || 'impl'
const maxRounds = a.maxRounds || 3
const doCommit = a.commit !== false
const stateFile = a.stateFile || 'docs/progress/loop-state.md'

// Default spec set: whole-number specs only (fractional NNNN.N-*.md are temporary
// violation ledgers per the app repo's CLAUDE.md, not durable build targets).
const specGlob = (a.specs && a.specs.length)
  ? a.specs.join(', ')
  : 'docs/specs/[0-9][0-9][0-9][0-9]-*.md (every whole-number spec; ignore NNNN.N fractional ledgers)'
const focusNote = (a.focusSpecs && a.focusSpecs.length)
  ? `Prioritize these specs this tick: ${a.focusSpecs.join(', ')}.`
  : ''

// Gate registry. model + phase per the spec-4 table; `applies` decides whether a
// gate is auto-included based on what the unit touches (callers can force a subset
// via args.gates). Each gate agent reviews the working-tree diff and returns a
// structured verdict — they are read-only, so they fan out in parallel.
const GATES = [
  {
    key: 'tests', model: 'sonnet', label: 'tests',
    applies: () => true,
    prompt: (u, diff) => `Run the full automated test suite in ${repo} (the chain defined in package.json scripts.test, plus any web E2E). Report pass/fail counts. A single failing test = gate FAIL. Do not edit code; only run and report. Unit under test: ${u}. Diff base: ${diff}.`,
  },
  {
    key: 'coverage', model: 'sonnet', label: 'coverage',
    applies: (touch) => touch.src || touch.contracts || touch.web,
    prompt: (u) => `Run the coverage tool in ${repo} and report per-spec line+branch coverage across src/, contracts/, web/src/. Threshold: >= 85% line AND branch. Below threshold on any tree = FAIL; list the under-covered files. Write findings to docs/progress/coverage.md. Unit: ${u}.`,
  },
  {
    key: 'design', model: 'sonnet', label: 'design-conformance',
    applies: (touch) => touch.web,
    prompt: (u) => `Compare ${repo}/web/src/ to the UI prototype source under docs/reference/ui-prototype-handoff/project/ (read the JSX/HTML directly — this is NOT a pixel diff). Score component-tree alignment + key text + key affordances. Threshold: >= 90% conformance. Below = FAIL with the specific gaps. Write docs/progress/design-conformance.md. Unit: ${u}.`,
  },
  {
    key: 'secret', model: 'sonnet', label: 'secret-scan',
    applies: () => true,
    prompt: (u, diff) => `Secret-scan the diff in ${repo} vs ${diff} (and any untracked files). Use \`gitleaks detect --no-banner --redact\` if installed, else regex for: PEM private-key headers, 0x[0-9a-fA-F]{64}, sk-[A-Za-z0-9]{32,}, xox[bpa]- tokens, AWS/GCP key patterns. ANY hit = FAIL (redact the value in your report — never echo a key). Zero findings required. Unit: ${u}.`,
  },
  {
    key: 'solidity', model: 'opus', label: 'solidity-compliance',
    applies: (touch) => touch.contracts,
    prompt: (u, diff) => `TOTAL-STICKLER review of the contracts/ diff in ${repo} vs ${diff}. Check: reentrancy, missing access control, over/underflow beyond 0.8.x checks, unbounded loops, missing event emits, storage-layout breaks, gas anti-patterns, OZ-pattern non-adherence. Write docs/progress/solidity-compliance.md. ZERO findings required. Unit: ${u}.`,
  },
  {
    key: 'security', model: 'opus', label: 'security-review',
    applies: () => true,
    prompt: (u, diff) => `TOTAL-STICKLER security review of the diff in ${repo} vs ${diff}, applying the /security-review mental model. Hard gate: NO PHI / clinical data on-chain or in fixtures (synthetic only); no secrets; signing-key hygiene. Write docs/progress/security-findings.md. ZERO findings required. Unit: ${u}.`,
  },
  {
    key: 'strict', model: 'opus', label: 'strict-review',
    applies: () => true,
    prompt: (u, diff) => `TOTAL-STICKLER gatekeeper review of the diff in ${repo} vs ${diff} against the relevant R-numbered requirements + whole-codebase context. Flag: over-engineering/abstraction bloat, weak tests (assert presence not correctness; mocks where integration is required), missing edge cases (empty/large input, concurrent calls, reverts), dead code/unused exports, comments that lie or restate code, spec drift from R-intent, unjustified backwards-compat hacks, copy-paste that should be DRY (or premature abstraction). Write docs/progress/strict-review-findings.md. ZERO findings required. Unit: ${u}.`,
  },
  {
    key: 'browser', model: 'sonnet', label: 'browser-verify',
    applies: (touch) => touch.web,
    prompt: (u) => `Drive the live web UI in ${repo} via the agent-browser skill (.claude/skills/agent-browser/SKILL.md; run \`agent-browser skills get core\` first for the version-matched guide). The CLI is at ~/.npm-global/bin/agent-browser — \`export PATH="$HOME/.npm-global/bin:$PATH"\` before any browser command. Run the scenarios in web/tests/agent-browser/run.sh that exercise this unit end-to-end against the deployed Somnia-testnet contract. Write docs/progress/browser-verify.md. ALL scenarios green required. Unit: ${u}.`,
  },
]

// ----- schemas ----------------------------------------------------------------
const ORIENT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['clean', 'branch', 'tick', 'summary', 'openFindings'],
  properties: {
    clean: { type: 'boolean', description: 'working tree clean?' },
    branch: { type: 'string' },
    tick: { type: 'string', description: 'current tick from loop-state, or "0"' },
    summary: { type: 'string', description: '2-4 sentence state of play' },
    openFindings: { type: 'array', items: { type: 'string' }, description: 'unresolved findings to prioritize' },
    touches: {
      type: 'object', additionalProperties: false,
      description: 'which trees recent/queued work involves',
      properties: { src: { type: 'boolean' }, contracts: { type: 'boolean' }, web: { type: 'boolean' } },
    },
  },
}

const UNIT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['description', 'acceptanceCriterion', 'specRefs', 'touches'],
  properties: {
    description: { type: 'string', description: 'ONE focused unit of work' },
    acceptanceCriterion: { type: 'string', description: 'how we know it is done' },
    targetFiles: { type: 'array', items: { type: 'string' } },
    specRefs: { type: 'array', items: { type: 'string' }, description: 'spec + R-numbers satisfied' },
    touches: {
      type: 'object', additionalProperties: false,
      required: ['src', 'contracts', 'web'],
      properties: { src: { type: 'boolean' }, contracts: { type: 'boolean' }, web: { type: 'boolean' } },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['gate', 'status', 'findings'],
  properties: {
    gate: { type: 'string' },
    status: { type: 'string', enum: ['pass', 'fail'] },
    findings: { type: 'array', items: { type: 'string' }, description: 'empty when status=pass' },
  },
}

// ----- Phase 1: Orient --------------------------------------------------------
phase('Orient')
const orient = await agent(
  `You are orienting one tick of a spec-implementation loop in repo "${repo}".

IMPORTANT — repo scoping: "${repo}" may be a git repo NESTED inside a parent/outer
git repo (e.g. an app repo inside a PM repo). You MUST inspect ONLY "${repo}".
Run EVERY git command with the \`-C ${repo}\` flag — never a bare \`git status\`/
\`git log\` (a bare command reports your shell's cwd, which may be the OUTER repo).
The reported \`branch\` and \`clean\` fields MUST describe "${repo}" exclusively;
completely ignore the state, branch, and untracked files of any parent or sibling
repo. If the outer repo is dirty but "${repo}" is clean, report clean: true.
${branch ? `The checked-out branch of "${repo}" MUST be "${branch}" — assert it via \`git -C ${repo} rev-parse --abbrev-ref HEAD\`.` : 'Report the checked-out branch of "${repo}".'}
Steps: \`git -C ${repo} status --porcelain\` (clean ⇔ empty output) and \`git -C ${repo} rev-parse --abbrev-ref HEAD\`; read ${repo}/${stateFile} if it exists (mode, tick, queue, last focus); \`git -C ${repo} log --oneline -10\`.
Report whether THE "${repo}" tree is clean, the current tick, a short state summary, any unresolved findings to prioritize, and which trees (src/contracts/web) the recent + queued work touches.
Do NOT modify anything.`,
  { schema: ORIENT_SCHEMA, model: 'sonnet', phase: 'Orient' },
)

if (orient && orient.clean === false) {
  log(`⚠ Working tree not clean on ${orient.branch}. A tick needs a clean start — commit/stash before re-running.`)
  return { aborted: 'dirty-tree', orient }
}
if (branch && orient && orient.branch && orient.branch !== branch) {
  log(`⚠ On branch ${orient.branch}, expected ${branch}. Aborting.`)
  return { aborted: 'wrong-branch', orient }
}

// ----- Phase 2: Plan ----------------------------------------------------------
phase('Plan')
let unit
if (a.focus) {
  unit = { description: a.focus, acceptanceCriterion: 'as stated in the provided focus', specRefs: [], touches: { src: true, contracts: true, web: true } }
  log(`Using caller-provided focus; skipping planning agent.`)
} else if (mode === 'creativity') {
  unit = await agent(
    `Creativity mode for repo "${repo}". Read the specs (${specGlob}) and ROADMAP, then propose ONE small roadmap-listed-but-unspecced idea to explore on a fresh creativity/<feature> branch. ${focusNote} Return it as a focused unit.`,
    { schema: UNIT_SCHEMA, model: 'sonnet', phase: 'Plan' },
  )
} else {
  unit = await agent(
    `Plan ONE focused unit of work for this implementation tick in repo "${repo}".
Read end-to-end: the specs (${specGlob}); ${repo}/${stateFile} (queue + last focus); the most recent strict-review + security findings under ${repo}/docs/progress/.
${focusNote}
Current open findings to weigh: ${(orient && orient.openFindings || []).join(' | ') || '(none reported)'}.
Pick the single highest-priority unit — small enough to land cleanly in one commit with no half-state. Prefer addressing an open strict-review/security finding over net-new scope. State a crisp acceptance criterion, the spec + R-numbers it satisfies, the files it will touch, and which trees (src/contracts/web) it touches.`,
    { schema: UNIT_SCHEMA, model: 'sonnet', phase: 'Plan' },
  )
}

if (!unit) return { aborted: 'no-plan', orient }
log(`Unit: ${unit.description}`)

// Which gates run this tick: caller override, else every gate whose `applies` matches
// what the unit touches. `tests`, `secret`, `security`, `strict` always apply.
const touch = unit.touches || { src: true, contracts: true, web: true }
const activeGates = a.gates && a.gates.length
  ? GATES.filter((g) => a.gates.includes(g.key))
  : GATES.filter((g) => g.applies(touch))
log(`Gates this tick: ${activeGates.map((g) => g.label).join(', ')}`)

// ----- Phases 3-5: Build → Verify, loop until green ---------------------------
let priorFindings = []
let verdicts = []
let green = false
let round = 0

while (round < maxRounds) {
  round += 1
  const budgetOk = !budget.total || budget.remaining() > 60_000
  if (!budgetOk) { log(`Token budget exhausted before round ${round}; stopping with last verdicts.`); break }

  // --- Build (TDD red → dev green; sequential, since both edit the shared tree) ---
  phase('Build')
  const fixContext = priorFindings.length
    ? `\nThis is retry round ${round}. The previous attempt FAILED these gates — fix every one:\n- ${priorFindings.join('\n- ')}`
    : ''

  await agent(
    `TDD step for repo "${repo}". Unit: ${unit.description}
Acceptance: ${unit.acceptanceCriterion}. Spec refs: ${(unit.specRefs || []).join(', ')}.
Write the FAILING test(s) first that pin the acceptance criterion to real behavior — no mocking of the database/contract/agent where the spec claims integration coverage (integration tests hit Somnia testnet chain 50312 + a real agent call). PHI never in fixtures — synthetic only. Run the test and confirm it currently fails for the right reason. Do not implement production code.${fixContext}`,
    { label: `tdd r${round}`, model: 'sonnet', phase: 'Build' },
  )

  await agent(
    `Implement the unit in repo "${repo}" so the failing test(s) pass. Unit: ${unit.description}
Acceptance: ${unit.acceptanceCriterion}. Touch only what's needed. TypeScript-only; chain access via somnia-agent-kit (no REST); no PHI on-chain or in fixtures.
After implementing: run the repo lint command and the test suite; reconcile so the new test passes and nothing else breaks; remove any TODO/FIXME/commented-out scaffolding you introduced. Leave no half-state.${fixContext}`,
    { label: `dev r${round}`, model: 'sonnet', phase: 'Build' },
  )

  // --- Verify (all active gates in parallel — they are read-only) ---
  phase('Verify')
  verdicts = (await parallel(
    activeGates.map((g) => () =>
      agent(g.prompt(unit.description, baseRef), {
        label: `${g.label} r${round}`, model: g.model, phase: 'Verify', schema: VERDICT_SCHEMA,
      }).then((v) => v || { gate: g.label, status: 'fail', findings: ['gate agent returned nothing'] }),
    ),
  )).filter(Boolean)

  const failed = verdicts.filter((v) => v.status !== 'pass')
  if (failed.length === 0) { green = true; log(`Round ${round}: all ${verdicts.length} gates green ✓`); break }

  priorFindings = failed.flatMap((v) => v.findings.map((f) => `[${v.gate}] ${f}`))
  log(`Round ${round}: ${failed.length} gate(s) failed — ${failed.map((v) => v.gate).join(', ')}. Re-building.`)
}

// ----- Phase 6: Commit --------------------------------------------------------
let committed = false
if (green && doCommit && mode !== 'creativity') {
  phase('Commit')
  const pushTarget = branch || orient && orient.branch || 'HEAD'
  const res = await agent(
    `All gates are green for repo "${repo}". Make ONE clean commit and push.
- Single conventional commit: feat(<scope>): / fix(<scope>): <unit>. Body: 2-4 bullets — what landed, the test added, which spec R-numbers it satisfies. Footer: \`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>\`.
- Update ${repo}/${stateFile}: increment tick, record this focus as done, refresh the verdict table.
- Pre-commit secret-scan must pass; NEVER use --no-verify or --force-push.
- \`git -C ${repo} push origin ${pushTarget}\`.
Unit: ${unit.description}. Spec refs: ${(unit.specRefs || []).join(', ')}.
Report the commit SHA and confirm the push succeeded.`,
    { label: 'commit+push', model: 'sonnet', phase: 'Commit' },
  )
  committed = true
  log(`Committed + pushed. ${res ? res.split('\n')[0] : ''}`)
} else if (green && mode === 'creativity') {
  phase('Commit')
  await agent(
    `Creativity unit is ready in repo "${repo}". Push the creativity/<feature> branch and open a PR against main via \`gh pr create\` (owner credentials tspugh). Record the PR number in ${repo}/${stateFile}. Unit: ${unit.description}.`,
    { label: 'creativity PR', model: 'sonnet', phase: 'Commit' },
  )
  committed = true
} else if (green && !doCommit) {
  log('All gates green — commit skipped (commit:false). Working tree holds the change for review.')
} else {
  log(`Not green after ${round} round(s). Leaving findings for the next tick; no commit.`)
}

return {
  unit: unit.description,
  mode,
  rounds: round,
  green,
  committed,
  gates: verdicts.map((v) => ({ gate: v.gate, status: v.status })),
  openFindings: green ? [] : priorFindings,
}

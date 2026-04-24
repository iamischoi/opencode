# Source Diagnostic Assessment for `packages/opencode`

## TL;DR
> **Summary**: Diagnose whether `packages/opencode` currently has real source-level issues without fixing anything. Use package-local typecheck and test entry points, separate true failures from expected stderr noise, and finish with a tri-state verdict: `CLEAN`, `REAL ISSUE`, or `INCONCLUSIVE`.
> **Deliverables**:
> - Evidence-backed diagnostic verdict for `packages/opencode`
> - Command-by-command execution record with exit codes / diagnostic counts
> - Classified list of real failures or inconclusive conditions
> **Effort**: Short
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2/3 → 4 → 5 → 6 → 7

## Context
### Original Request
- User request: "소스코드를 확인해서 오류가 없는지 진단해봐 수정은 하지말고"
- Operating mode: automated planning only; no user interview; no code changes.

### Interview Summary
- No interview was performed because automated mode explicitly required immediate planning.
- Requirements derived from prompt and repo state:
  - inspect current source health
  - do not edit source code
  - do not broaden scope outside `packages/opencode`
  - diagnose, classify, and report rather than fix

### Metis Review (gaps addressed)
- Lock scope to `packages/opencode` only.
- Treat `bun run typecheck` as the authoritative static gate.
- Treat `lsp_diagnostics` as corroboration only because `src/lsp/diagnostic.ts` filters to severity-1 and caps output.
- Do not treat stderr/plugin noise as failure unless paired with non-zero exit or failing Bun summary.
- If the outer command harness times out before Bun prints its final summary, classify the full-suite result as `INCONCLUSIVE`, not `REAL ISSUE`.
- Run targeted noisy tests before any full-suite verdict.

## Work Objectives
### Core Objective
Produce a decision-complete, evidence-backed diagnostic result for `packages/opencode` without changing source code, configs, snapshots, dependencies, or generated assets.

### Deliverables
- A tri-state verdict: `CLEAN`, `REAL ISSUE`, or `INCONCLUSIVE`
- Per-step evidence in `.sisyphus/evidence/task-{N}-{slug}.txt`
- A final summary mapping each signal to its source:
  - typecheck status
  - LSP error count
  - targeted test status
  - full-suite status
  - any noisy stderr lines that were explicitly classified as non-failures

### Definition of Done (verifiable conditions with commands)
- `bun run typecheck` completes from `packages/opencode` with exit code `0`.
- `lsp_diagnostics(filePath="D:/sources/poc/ai/opencode/packages/opencode/src", severity="error")` returns `0` errors.
- `bun test --timeout 30000 test/util/log.test.ts` completes with exit code `0` and Bun prints a passing summary.
- `bun test --timeout 30000 test/effect/runner.test.ts` completes with exit code `0` and Bun prints a passing summary.
- `bun test --timeout 30000` either:
  - exits `0` with a final passing summary, or
  - is explicitly classified `INCONCLUSIVE` because the outer tool timed out before Bun printed its summary while targeted tests passed.
- Final report contains a single verdict and cites the exact evidence file for every gate.

### Must Have
- Package-local execution only (`D:/sources/poc/ai/opencode/packages/opencode`)
- Read-only diagnostics only
- Separate treatment of:
  - static typecheck signal
  - LSP error signal
  - targeted test signal
  - full-suite signal
  - stderr/plugin noise
- Exact stop rules for `CLEAN`, `REAL ISSUE`, and `INCONCLUSIVE`

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No edits under `src/`, `test/`, `script/`, `package.json`, or config files
- No dependency installs
- No snapshot updates
- No SDK regeneration
- No workspace-root testing
- No CI/JUnit artifact generation unless a disposable non-repo path is explicitly configured first
- No classification based on "logs look scary" alone
- No repeated full-suite reruns beyond one confirmation attempt

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after only; existing Bun test framework via `bun test`
- QA policy: every task below has explicit happy/failure scenarios and evidence targets
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.txt`
- Authoritative failure signals:
  - non-zero exit code
  - positive `lsp_diagnostics` error count
  - Bun final summary reporting failed tests
- Non-authoritative signals (must not fail the assessment by themselves):
  - stderr/plugin error lines during negative-path tests
  - partial output from a command killed by an outer timeout
  - sampled LSP success without full corroboration

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Test commands stay serial even when they are in the same wave because mixed stdout/stderr would destroy noise classification.

Wave 1: baseline + static-analysis setup
- Task 1: capture environment baseline and evidence convention
- Task 2: run authoritative package typecheck
- Task 3: run package `src/` LSP error corroboration

Wave 2: targeted noise isolation
- Task 4: analyze LSP formatter and limits from source
- Task 5: run targeted `test/util/log.test.ts`
- Task 6: run targeted `test/effect/runner.test.ts`

Wave 3: broad confirmation + verdict
- Task 7: attempt full suite with extended outer timeout and explicit inconclusive rule
- Task 8: consolidate results into one tri-state diagnostic report

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | - | 2, 3, 5, 6, 7, 8 |
| 2 | 1 | 7, 8 |
| 3 | 1 | 8 |
| 4 | 1 | 8 |
| 5 | 1 | 7, 8 |
| 6 | 1 | 7, 8 |
| 7 | 2, 5, 6 | 8 |
| 8 | 2, 3, 4, 5, 6, 7 | F1-F4 |

### Agent Dispatch Summary
| Wave | Task Count | Categories |
|---|---:|---|
| 1 | 3 | quick, unspecified-low |
| 2 | 3 | quick, unspecified-low |
| 3 | 2 | quick, unspecified-low |
| Final Verification | 4 | oracle, unspecified-high, deep |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Capture baseline, scope, and evidence format

  **What to do**: Start in `D:/sources/poc/ai/opencode/packages/opencode`. Record the working directory, Bun version, current date/time, and the exact evidence file naming convention that will be used for all later tasks. Record that diagnostics are read-only and scoped to this package only.
  **Must NOT do**: Do not run from repo root. Do not create CI/JUnit artifacts. Do not edit any repo files.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: simple read-only environment capture
  - Skills: `[]` - no extra skill required
  - Omitted: `["playwright"]` - no browser/UI work involved

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2, 3, 5, 6, 7, 8 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `package.json:8-18` - package-local scripts to use instead of ad hoc alternatives
  - Pattern: `bunfig.toml:3-6` - package-level Bun test preload and timeout note

  **Acceptance Criteria** (agent-executable only):
  - [ ] Evidence file records the package working directory exactly as `D:/sources/poc/ai/opencode/packages/opencode`
  - [ ] Evidence file records Bun version and timestamp
  - [ ] Evidence file states "read-only diagnostics; no source edits"

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Happy path baseline capture
    Tool: Bash
    Steps: Run a read-only command set that prints current directory and Bun version from packages/opencode; write the captured output to .sisyphus/evidence/task-1-baseline.txt
    Expected: Output shows packages/opencode as cwd and a Bun version string; no repo files outside .sisyphus/evidence are touched
    Evidence: .sisyphus/evidence/task-1-baseline.txt

  Scenario: Failure path wrong scope detected
    Tool: Bash
    Steps: Verify the current working directory before any later command; if it is not packages/opencode, stop immediately and record scope violation
    Expected: Execution halts before running diagnostics outside package scope
    Evidence: .sisyphus/evidence/task-1-baseline-scope-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `none`

- [x] 2. Run the authoritative typecheck gate

  **What to do**: Execute `bun run typecheck` from `packages/opencode`. Capture full stdout/stderr and the exit code. Treat this as the primary static-analysis signal because `package.json` explicitly defines the package’s supported typecheck entry point.
  **Must NOT do**: Do not substitute `tsc`. Do not run from repo root. Do not infer success from partial output; capture exit code explicitly.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: one package script with direct pass/fail signal
  - Skills: `[]` - no extra skill required
  - Omitted: `["git-master"]` - no git operation involved

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7, 8 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `package.json:8-18` - `typecheck` is defined as `tsgo --noEmit`
  - API/Type: `tsconfig.json:3-23` - package-specific TypeScript configuration, paths, and Effect language service plugin

  **Acceptance Criteria** (agent-executable only):
  - [ ] Command run from `D:/sources/poc/ai/opencode/packages/opencode`
  - [ ] Exit code is exactly `0`
  - [ ] Captured output contains no `error TS` lines

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Happy path typecheck passes
    Tool: Bash
    Steps: Run `bun run typecheck` from packages/opencode with a generous outer timeout; capture exit code and full output
    Expected: Exit code 0; no TypeScript error lines in output
    Evidence: .sisyphus/evidence/task-2-typecheck.txt

  Scenario: Failure path typecheck reports real issue
    Tool: Bash
    Steps: If the command exits non-zero or prints TypeScript error lines, stop broad execution and record the first failing file/message exactly
    Expected: Result is classified as REAL ISSUE, not retried blindly
    Evidence: .sisyphus/evidence/task-2-typecheck-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `none`

- [x] 3. Run LSP error corroboration on `src/`

  **What to do**: Run `lsp_diagnostics` on `D:/sources/poc/ai/opencode/packages/opencode/src` with `severity="error"`. Record the file count scanned and total error count. Use this only to corroborate the typecheck gate, never to replace it.
  **Must NOT do**: Do not claim repo-wide correctness from this result alone. Do not treat warning/hint absence as proven.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: direct read-only diagnostic tool call
  - Skills: `[]` - no extra skill required
  - Omitted: `["playwright"]` - not a browser task

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/lsp/diagnostic.ts:3-27` - local formatter only emits severity-1 diagnostics and truncates per file
  - API/Type: `tsconfig.json:3-23` - package TS setup that diagnostics should reflect

  **Acceptance Criteria** (agent-executable only):
  - [ ] `lsp_diagnostics` returns `0` error diagnostics, or any returned errors are copied exactly into evidence
  - [ ] Evidence notes that this is corroboration, not the sole source of truth

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Happy path zero LSP errors
    Tool: lsp_diagnostics
    Steps: Run diagnostics on packages/opencode/src with severity=error and save the returned summary
    Expected: Total diagnostics 0, or exact numeric count captured for later classification
    Evidence: .sisyphus/evidence/task-3-lsp-errors.txt

  Scenario: Failure path positive LSP errors
    Tool: lsp_diagnostics
    Steps: If diagnostics are returned, record each file/message pair and stop before running the full suite
    Expected: Result is classified as REAL ISSUE candidate pending final report
    Evidence: .sisyphus/evidence/task-3-lsp-errors-found.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `none`

- [x] 4. Inspect the repo’s diagnostic and test-noise semantics before classifying logs

  **What to do**: Read the source and test harness files that define how diagnostics and live tests behave. Record the exact rules that affect classification: severity-1-only formatting, per-file truncation, temp-dir cleanup, `it.live` usage, and Effect test logging behavior.
  **Must NOT do**: Do not execute code changes. Do not skip this interpretation step and jump straight from stderr noise to failure conclusions.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: read-only source interpretation and evidence capture
  - Skills: `[]` - no extra skill required
  - Omitted: `["review-work"]` - this is pre-verification context gathering, not post-implementation review

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/lsp/diagnostic.ts:20-26` - only severity-1 errors are emitted by `report()` and output is capped at 20 per file
  - Pattern: `test/util/log.test.ts:10-44` - log tests intentionally create, stabilize, and validate rotating temp log files
  - Pattern: `test/effect/runner.test.ts:193-243` - runner tests intentionally use timing and Promise.race failure messages
  - Pattern: `test/effect/runner.test.ts:315-334` - cancel/timeout behavior is intentionally exercised
  - Test: `test/AGENTS.md:83-133` - `it.live(...)` is expected for real-time/filesystem/process behavior
  - Test: `test/lib/effect.ts:11-20` - Effect test runner logs pretty errors on failures
  - Test: `test/lib/effect.ts:22-53` - `effect` vs `live` helpers define execution behavior

  **Acceptance Criteria** (agent-executable only):
  - [ ] Evidence file lists at least four concrete classification rules derived from repo files
  - [ ] Evidence file explicitly states that stderr/plugin logs alone are not sufficient for failure classification

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Happy path semantics captured
    Tool: Read
    Steps: Read the referenced files and summarize the exact log-classification and timing-sensitive behaviors they imply
    Expected: Evidence contains repo-backed rules that later tasks can apply mechanically
    Evidence: .sisyphus/evidence/task-4-semantics.txt

  Scenario: Failure path missing semantic basis
    Tool: Read
    Steps: If any referenced file is missing or contradicts expected behavior, record that contradiction and force final verdict to INCONCLUSIVE unless another task already proved a REAL ISSUE
    Expected: No unsupported assumptions remain in the final report
    Evidence: .sisyphus/evidence/task-4-semantics-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `none`

- [x] 5. Run targeted log-noise isolation via `test/util/log.test.ts`

  **What to do**: Execute `bun test --timeout 30000 test/util/log.test.ts` from `packages/opencode`. Capture exit code, Bun’s final summary line, and any stderr/plugin noise that appears. This task exists to prove whether noisy output can coexist with a passing targeted test.
  **Must NOT do**: Do not classify stderr alone as failure. Do not run this in parallel with another test command.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: one bounded targeted test command
  - Skills: `[]` - no extra skill required
  - Omitted: `["playwright"]` - no UI involved

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 7, 8 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Test: `test/util/log.test.ts:10-44` - temp log mutation is intentional test behavior
  - Test: `bunfig.toml:3-6` - Bun test preload and timeout note
  - Test: `test/AGENTS.md:77-81` - temp directories are expected and automatically cleaned up

  **Acceptance Criteria** (agent-executable only):
  - [ ] Exit code is `0`, or non-zero output is captured exactly
  - [ ] Evidence records whether Bun printed a final passing/failing summary
  - [ ] Evidence explicitly labels any stderr/plugin output as either accompanying a pass or accompanying a fail

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Happy path targeted log test passes with or without noise
    Tool: Bash
    Steps: Run `bun test --timeout 30000 test/util/log.test.ts` from packages/opencode and capture complete output plus exit code
    Expected: Exit code 0 and Bun prints a passing summary; any stderr noise is recorded as non-failing accompaniment
    Evidence: .sisyphus/evidence/task-5-log-test.txt

  Scenario: Failure path targeted log test fails
    Tool: Bash
    Steps: If the test exits non-zero or Bun prints a failing summary, record the exact failing assertion/test name and stop before full-suite execution
    Expected: Result is classified as REAL ISSUE candidate
    Evidence: .sisyphus/evidence/task-5-log-test-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `none`

- [x] 6. Run targeted runner-noise isolation via `test/effect/runner.test.ts`

  **What to do**: Execute `bun test --timeout 30000 test/effect/runner.test.ts` from `packages/opencode`. Capture exit code, final Bun summary, elapsed time, and any stderr/plugin/timing noise. This is the high-risk targeted canary because it uses live timing, cancellation, and Promise.race-based failure messages.
  **Must NOT do**: Do not run concurrently with another test command. Do not widen to unrelated test files if this single file already exposes a reproducible failure.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: one bounded but signal-rich targeted test command
  - Skills: `[]` - no extra skill required
  - Omitted: `["review-work"]` - this is direct diagnostic execution, not review orchestration

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 7, 8 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Test: `test/effect/runner.test.ts:193-243` - timing-sensitive deadlock/timeout checks
  - Test: `test/effect/runner.test.ts:315-334` - cancel interruption behavior
  - Test: `test/AGENTS.md:110-125` - `it.live(...)` is expected for real OS behavior
  - Test: `test/lib/effect.ts:11-20` - Effect failure logging behavior

  **Acceptance Criteria** (agent-executable only):
  - [ ] Exit code is `0`, or the first failing test name/message is captured exactly
  - [ ] Evidence records whether Bun reached its final summary
  - [ ] Timing-related log lines are not treated as failures unless paired with non-zero exit or failing summary

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Happy path targeted runner test passes
    Tool: Bash
    Steps: Run `bun test --timeout 30000 test/effect/runner.test.ts` from packages/opencode with enough outer timeout to finish normally
    Expected: Exit code 0 and Bun prints a passing summary even if timing/cancellation logs appear
    Evidence: .sisyphus/evidence/task-6-runner-test.txt

  Scenario: Failure path targeted runner test exposes real defect or platform instability
    Tool: Bash
    Steps: If the test exits non-zero or never reaches its Bun summary, rerun the same single file once; if it reproduces, classify as REAL ISSUE, otherwise classify as INCONCLUSIVE
    Expected: One confirmation pass distinguishes reproducible defect from one-off infrastructure noise
    Evidence: .sisyphus/evidence/task-6-runner-test-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `none`

- [x] 7. Attempt one full-suite confirmation with explicit timeout rules

  **What to do**: Execute `bun test --timeout 30000` from `packages/opencode` with an outer tool timeout of at least 10 minutes. Capture complete output, exit code, elapsed time, whether Bun printed its final summary, and the last visible test/output lines if the outer harness interrupts execution.
  **Must NOT do**: Do not use the JUnit/CI script by default because it writes artifacts. Do not rerun the full suite more than once. Do not classify outer-tool timeout as failure when targeted gates passed and Bun never printed a failing summary.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: one broad read-only package test command
  - Skills: `[]` - no extra skill required
  - Omitted: `["playwright"]` - no UI/browser work involved

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 8 | Blocked By: 2, 5, 6

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `package.json:11-12` - package test and test:ci entry points
  - Pattern: `bunfig.toml:3-6` - Bun test timeout note; per-test timeout is already passed via CLI
  - Test: `test/effect/runner.test.ts:193-243` - evidence that some tests intentionally exercise long/timing-sensitive paths

  **Acceptance Criteria** (agent-executable only):
  - [ ] If Bun exits `0` with a final passing summary, task status is pass
  - [ ] If Bun exits non-zero or prints a failing summary, task status is REAL ISSUE
  - [ ] If the outer harness kills the command before Bun prints its final summary, task status is INCONCLUSIVE and the last visible output lines are preserved

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Happy path full suite passes
    Tool: Bash
    Steps: Run `bun test --timeout 30000` from packages/opencode with an outer timeout of at least 600000 ms and capture full output
    Expected: Exit code 0 and Bun prints a final passing summary
    Evidence: .sisyphus/evidence/task-7-full-suite.txt

  Scenario: Failure/edge case full suite times out externally
    Tool: Bash
    Steps: If the outer tool times out before Bun prints its summary, save elapsed time plus final visible lines and compare against targeted task results
    Expected: Classification is INCONCLUSIVE, not REAL ISSUE, unless earlier targeted tasks already failed reproducibly
    Evidence: .sisyphus/evidence/task-7-full-suite-timeout.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `none`

- [x] 8. Produce the final tri-state diagnostic report

  **What to do**: Synthesize Tasks 2-7 into one final report with exactly one verdict: `CLEAN`, `REAL ISSUE`, or `INCONCLUSIVE`. The report must list each command/tool, exit code or diagnostic count, whether Bun printed its final summary, and the evidence file path for that conclusion. If there is a real issue, list the first failing file/test and exact message. If inconclusive, state why the evidence is insufficient.
  **Must NOT do**: Do not hedge with multiple simultaneous verdicts. Do not omit evidence links. Do not recommend fixes.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: structured evidence synthesis and classification
  - Skills: `[]` - no extra skill required
  - Omitted: `["git-master"]` - no commit or git history work required

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: F1, F2, F3, F4 | Blocked By: 2, 3, 4, 5, 6, 7

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/lsp/diagnostic.ts:20-26` - why LSP error count is corroborative only
  - Pattern: `package.json:8-18` - authoritative package commands used for typecheck/test
  - Pattern: `test/util/log.test.ts:10-44` - temp-log behavior may produce benign noise
  - Pattern: `test/effect/runner.test.ts:193-243` - timing-sensitive tests can cause inconclusive outer timeouts
  - Test: `test/lib/effect.ts:11-20` - failed Effect tests print pretty errors; use those as failure evidence

  **Acceptance Criteria** (agent-executable only):
  - [ ] Final report contains exactly one of `CLEAN`, `REAL ISSUE`, `INCONCLUSIVE`
  - [ ] Final report includes a table with task number, command/tool, exit code/diagnostic count, summary presence, and evidence path
  - [ ] Final report contains no remediation steps

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Happy path consolidated clean verdict
    Tool: Read
    Steps: Read evidence from tasks 2-7 and write a summary that marks the package CLEAN only if every required gate passed
    Expected: Report contains one CLEAN verdict with evidence for every gate
    Evidence: .sisyphus/evidence/task-8-final-report.txt

  Scenario: Failure/edge case inconclusive or real issue verdict
    Tool: Read
    Steps: If any gate failed or full-suite output is truncated by outer timeout, produce either REAL ISSUE or INCONCLUSIVE according to the stop rules, citing exact evidence
    Expected: Report chooses one verdict mechanically with no unsupported judgment call
    Evidence: .sisyphus/evidence/task-8-final-report-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `none`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Diagnostic Evidence Audit — unspecified-high
- [x] F3. Real Manual QA Replay — unspecified-high
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Plan creation phase: if a commit is ever requested later, commit only `.sisyphus/plans/source-diagnostic-assessment.md`.
- Diagnostic execution phase: no commit. The work is read-only.
- Any generated evidence must remain under `.sisyphus/evidence/` only and must not be treated as source changes.

## Success Criteria
- The executor can run the plan without asking any follow-up questions.
- Every gate has an exact command/tool, timeout behavior, pass/fail rule, and evidence target.
- The final result is mechanically classifiable as `CLEAN`, `REAL ISSUE`, or `INCONCLUSIVE`.
- No source code, config, dependency, or generated artifact changes are required to complete the assessment.

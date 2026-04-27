# GitLab Auto-Clone API Remediation

## Objective
Make `POST /project/analyze` reliably clone the correct repositories, run planning in the intended workspace, and return the generated plan content without relying on brittle path assumptions.

## Current Findings
- The route already exists at `src/server/routes/instance/experimental.ts`.
- `AgentAnalysis.analyzeDirectory()` asks the plan agent to save into `.sisyphus/plans`, but plan mode actually uses `Session.plan(...)`, which resolves to `.opencode/plans` for git-backed projects in `src/session/session.ts`.
- `AgentAnalysis.analyzeDirectory()` then scans `.sisyphus/plans` in the current instance context, so it can miss the real generated file or read the wrong file.
- The analysis flow is not explicit about running inside the cloned target workspace, which risks incorrect plan-path resolution and tool scope.
- `Gitlab.Service` reads and mutates `process.env` directly, loads properties during layer construction, and barely uses the `ConfigGitlab` schema as runtime truth.
- The route hardcodes `/swdata/repository/${groupCode}` instead of deriving the base path from one configuration source.
- There are no targeted tests for GitLab parsing, clone-path selection, or analysis-plan retrieval.

## Scope
- Keep the existing feature shape.
- Prefer minimal corrective changes over broad redesign.
- Do not refactor unrelated route, session, or agent infrastructure.

## Files To Modify
- `src/agent/analysis.ts`
- `src/server/routes/instance/experimental.ts`
- `src/gitlab/service.ts`
- `src/config/gitlab.ts` only if the runtime contract needs small schema cleanup
- Add focused tests under `test/`

## Implementation Plan
1. Fix the plan-output contract.
- Stop instructing the plan agent to save into `.sisyphus/plans`.
- Use the actual session plan location from `Session.plan(session)` as the source of truth.
- After prompting completes, read that exact file instead of scanning a directory or returning the first markdown entry found.

2. Run analysis in the correct instance/workspace.
- Bind the analysis run to the cloned target directory with the correct instance context so tools and plan-file resolution operate against the intended workspace.
- Decide explicitly whether `targetDir` is the group container directory or a single repo root, and keep that consistent across clone and analysis steps.

3. Normalize GitLab config loading.
- Move app/group/repository/branch/base-path resolution behind one runtime path instead of mixing `process.env`, property loading, and hardcoded route values.
- Keep parsing helpers small and deterministic.
- Preserve current clone-or-pull behavior, but make empty mappings and disabled auto-clone cases explicit.

4. Harden the route behavior.
- Return a failure when `appName` has no group mapping, when a group has no repositories, or when planning completes without a readable plan file.
- Keep the current response shape unless implementation proves a caller needs `planPath` or `clonedPaths`.

5. Add focused tests.
- GitLab parsing tests:
  - `appName -> groupCode`
  - repository string parsing
  - branch override parsing
  - auto-clone disabled behavior
- Analysis service test:
  - verifies the session plan file is read from the correct workspace
- Route or service-level integration test:
  - happy path from app name to returned plan content

## Verification
- Run `bun run typecheck` from `packages/opencode`
- Run the new targeted tests from `packages/opencode`
- Confirm the analyze flow returns plan content sourced from the actual generated plan file
- Confirm no runtime dependency on `.sisyphus/plans` remains in the feature path

## Key References
- `src/server/routes/instance/experimental.ts:328-371`
- `src/agent/analysis.ts:23-57`
- `src/session/session.ts:254-259`
- `src/session/prompt.ts:270-283`
- `src/gitlab/service.ts:32-145`
- `src/config/gitlab.ts:1-19`

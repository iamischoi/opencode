# Prometheus Plan: GitLab Auto-Clone and Analysis API

Implementing an automated workflow to clone GitLab repositories based on application mapping and perform deep source code analysis using the internal agent system.

## 1. Analysis of Existing Infrastructure

- **API Layer**: `src/server/routes/instance/experimental.ts` (Hono-based) and `src/server/routes/instance/httpapi/` (Effect HttpApi). Experimental routes are better suited for this feature.
- **Configuration**: `opencode-server.properties` is loaded into `process.env` at startup via `src/util/properties.ts`. Configuration parsing logic should live in a dedicated service or utility.
- **Git Operations**: `src/git/index.ts` provides a `Git.Service` using `ChildProcessSpawner`. It supports arbitrary git commands.
- **Project/Worktree**: `src/project/` and `src/worktree/` manage local project directories. `Worktree.Service` can create sandboxed directories.
- **Agent/Session**: `SessionProcessor.Service` and `LLM.Service` handle the execution loop. `Session.Service` manages persistence.

## 2. Implementation Steps

### Phase 1: Configuration & GitLab Service
- [ ] **Define Schema**: Create `src/config/gitlab.ts` with a Zod/Effect schema for `GITLAB_HOST`, `GITLAB_USERNAME`, `GITLAB_TOKEN`, `GITLAB_AUTO_CLONE`, `OPENCODE_APP_CONFIG`, and `REPOSITORIES`.
- [ ] **Create GitLab Service**: Implement `src/gitlab/service.ts`.
    - Function to parse `OPENCODE_APP_CONFIG` and find group code for a given `appName`.
    - Function to parse `REPOSITORIES` and find all `.git` URLs for a group code.
    - Integration with `Git.Service` to perform authenticated clones into a target directory.
- [ ] **QA**: Unit tests for parsing logic with various complex `REPOSITORIES` strings.

### Phase 2: Internal Agent Orchestrator
- [ ] **Create Analysis Service**: Implement `src/agent/analysis.ts`.
    - Function `analyzeDirectory(path: string)`:
        1. Programmatically create a `Session`.
        2. Programmatically create a `User` message with a prompt to "analyze this project and generate a work plan as a markdown file in .opencode/plans/".
        3. Use `SessionProcessor.process` to execute the agent.
        4. Wait for the `assistant` message to complete.
        5. Locate the generated `.md` file in the project's plans directory.
- [ ] **QA**: Integration test using a mock LLM or a small local directory.

### Phase 3: API Integration
- [ ] **Define Endpoint**: Add `POST /instance/project/analyze` to `src/server/routes/instance/experimental.ts`.
- [ ] **Implementation**:
    1. Extract `appName` from payload.
    2. Lookup repositories via `GitLabService`.
    3. Determine a temp workspace directory (e.g., `os.tmpdir()` or a managed `worktree` sandbox).
    4. Clone repositories.
    5. Trigger `AnalysisService.analyzeDirectory`.
    6. Read the resulting Markdown file.
    7. Return JSON response.
- [ ] **QA**: End-to-end test using `curl` against the experimental route.

## 3. Detailed Task Breakdown

### Task 1: GitLab Config & Service
- **Files**: `src/config/gitlab.ts`, `src/gitlab/service.ts`
- **Logic**: 
    - `REPOSITORIES` parsing: `S01/project-a.git;project-a|S02/project-b.git;project-b` -> Map `S01` to `[host/S01/project-a.git]`.
    - Clone command: `git clone https://<username>:<token>@<host>/<path> <dest>`.
- **Verification**: `gitlab.service.test.ts` verifying mapping and URL construction.

### Task 2: Programmatic Agent Execution
- **Files**: `src/agent/analysis.ts`
- **Logic**:
    - Wrap `Session.create`, `MessageV2.updateMessage`, and `SessionProcessor.create` in a single `Effect.gen`.
    - Monitor `Bus` events or poll `SessionStatus` to know when the agent finishes.
- **Verification**: Script to trigger analysis on a local folder and assert `.md` file creation.

### Task 3: Experimental API Endpoint
- **Files**: `src/server/routes/instance/experimental.ts`
- **Input**: `{ "appName": string }`
- **Output**: `{ "status": "success", "plan": string }`
- **Verification**: Verify that the API waits for the LLM (potential timeout management needed for large projects).

## 4. Architectural Constraints
- Use `Effect.gen` and `yield*` for all service calls.
- Adhere to the `Module shape` (flat exports + self-reexport).
- Use `InstanceState` for any per-analysis state.
- Ensure `GitLab` credentials are treated as `Redacted` or at least handled securely via `process.env`.

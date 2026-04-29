/**
 * Prometheus E2E flow test
 *
 * Validates the full lifecycle:
 *   1. Prometheus writes a plan .md file (hook allows it)
 *   2. Prometheus writes boulder.json (hook allows it)
 *   3. findPrometheusPlans detects the written files
 *   4. getPlanProgress parses checkboxes correctly
 *   5. Arbitrary files outside .sisyphus/ are still blocked
 */

import { describe, test, expect, beforeEach, afterEach, mock, afterAll } from "bun:test"
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"

// Force JSON (non-sqlite) mode so tests don't depend on DB
mock.module("../../shared/opencode-storage-detection", () => ({
  isSqliteBackend: () => false,
  resetSqliteBackendCache: () => {},
}))

afterAll(() => { mock.restore() })

const { createPrometheusMdOnlyHook } = await import("./index")
const { MESSAGE_STORAGE } = await import("../../features/hook-message-injector")
const { findPrometheusPlans, getPlanProgress, writeBoulderState } = await import("../../features/boulder-state/storage")
const { setSessionAgent, clearSessionAgent } = await import("../../features/claude-code-session-state")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpProject() {
  const dir = join(tmpdir(), `prometheus-e2e-${randomUUID()}`)
  mkdirSync(join(dir, ".sisyphus", "plans"), { recursive: true })
  return dir
}

function setupSession(sessionID: string, agent: string) {
  setSessionAgent(sessionID, agent)
  // Also set up a message dir entry as fallback
  const msgDir = join(MESSAGE_STORAGE, sessionID)
  mkdirSync(msgDir, { recursive: true })
  writeFileSync(
    join(msgDir, "msg_001.json"),
    JSON.stringify({ agent, model: { providerID: "test", modelID: "test" } }),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Prometheus E2E: plan file creation and execution flow", () => {
  const SESSION_ID = `ses_prometheus_e2e_${randomUUID()}`
  let projectDir: string
  let msgDir: string

  beforeEach(() => {
    projectDir = makeTmpProject()
    setupSession(SESSION_ID, "prometheus")
    msgDir = join(MESSAGE_STORAGE, SESSION_ID)
  })

  afterEach(() => {
    clearSessionAgent(SESSION_ID)
    rmSync(projectDir, { recursive: true, force: true })
    try { rmSync(msgDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  // -------------------------------------------------------------------------
  // 1. Hook allows writing plan .md
  // -------------------------------------------------------------------------
  describe("1. plan .md file creation", () => {
    test("hook allows prometheus to write a plan file", async () => {
      const hook = createPrometheusMdOnlyHook({ client: {}, directory: projectDir } as never)
      const planPath = join(projectDir, ".sisyphus", "plans", "my-feature.md")

      await expect(
        hook["tool.execute.before"](
          { tool: "Write", sessionID: SESSION_ID, callID: "c1" },
          { args: { filePath: planPath } },
        ),
      ).resolves.toBeUndefined()
    })

    test("hook allows relative plan path", async () => {
      const hook = createPrometheusMdOnlyHook({ client: {}, directory: projectDir } as never)

      await expect(
        hook["tool.execute.before"](
          { tool: "Write", sessionID: SESSION_ID, callID: "c2" },
          { args: { filePath: ".sisyphus/plans/feature.md" } },
        ),
      ).resolves.toBeUndefined()
    })

    test("hook allows Edit on an existing plan file", async () => {
      const hook = createPrometheusMdOnlyHook({ client: {}, directory: projectDir } as never)
      const planPath = join(projectDir, ".sisyphus", "plans", "existing.md")
      writeFileSync(planPath, "# Plan\n- [ ] 1. task one\n")

      await expect(
        hook["tool.execute.before"](
          { tool: "Edit", sessionID: SESSION_ID, callID: "c3" },
          { args: { filePath: planPath } },
        ),
      ).resolves.toBeUndefined()
    })

    test("hook injects workflow reminder when writing to plans/", async () => {
      const hook = createPrometheusMdOnlyHook({ client: {}, directory: projectDir } as never)
      const planPath = join(projectDir, ".sisyphus", "plans", "feature.md")
      const output: { args: Record<string, unknown>; message?: string } = {
        args: { filePath: planPath },
      }

      await hook["tool.execute.before"]({ tool: "Write", sessionID: SESSION_ID, callID: "c4" }, output)

      expect(output.message).toContain("PROMETHEUS MANDATORY WORKFLOW REMINDER")
    })

    test("hook blocks writing .md outside .sisyphus/", async () => {
      const hook = createPrometheusMdOnlyHook({ client: {}, directory: projectDir } as never)

      await expect(
        hook["tool.execute.before"](
          { tool: "Write", sessionID: SESSION_ID, callID: "c5" },
          { args: { filePath: join(projectDir, "README.md") } },
        ),
      ).rejects.toThrow("File operations restricted to .sisyphus/*.md plan files only")
    })
  })

  // -------------------------------------------------------------------------
  // 2. Hook allows writing boulder.json
  // -------------------------------------------------------------------------
  describe("2. boulder.json creation", () => {
    test("hook allows prometheus to write boulder.json", async () => {
      const hook = createPrometheusMdOnlyHook({ client: {}, directory: projectDir } as never)
      const boulderPath = join(projectDir, ".sisyphus", "boulder.json")

      await expect(
        hook["tool.execute.before"](
          { tool: "Write", sessionID: SESSION_ID, callID: "c6" },
          { args: { filePath: boulderPath } },
        ),
      ).resolves.toBeUndefined()
    })

    test("hook blocks writing arbitrary .json files", async () => {
      const hook = createPrometheusMdOnlyHook({ client: {}, directory: projectDir } as never)

      await expect(
        hook["tool.execute.before"](
          { tool: "Write", sessionID: SESSION_ID, callID: "c7" },
          { args: { filePath: join(projectDir, ".sisyphus", "config.json") } },
        ),
      ).rejects.toThrow("File operations restricted to .sisyphus/*.md plan files only")
    })
  })

  // -------------------------------------------------------------------------
  // 3. findPrometheusPlans detects written files
  // -------------------------------------------------------------------------
  describe("3. plan detection after write", () => {
    test("findPrometheusPlans returns empty array when no plans exist", () => {
      const emptyDir = makeTmpProject()
      // remove plans subdir
      rmSync(join(emptyDir, ".sisyphus", "plans"), { recursive: true, force: true })
      expect(findPrometheusPlans(emptyDir)).toEqual([])
      rmSync(emptyDir, { recursive: true, force: true })
    })

    test("findPrometheusPlans detects a plan written by prometheus", () => {
      const planPath = join(projectDir, ".sisyphus", "plans", "feature.md")
      writeFileSync(planPath, "# Feature Plan\n- [ ] 1. implement it\n")

      const plans = findPrometheusPlans(projectDir)
      expect(plans).toHaveLength(1)
      expect(plans[0]).toBe(planPath)
    })

    test("findPrometheusPlans detects multiple plans, newest first", async () => {
      const plan1 = join(projectDir, ".sisyphus", "plans", "first.md")
      const plan2 = join(projectDir, ".sisyphus", "plans", "second.md")
      writeFileSync(plan1, "# First\n")
      // Small delay to get different mtime
      await new Promise(r => setTimeout(r, 50))
      writeFileSync(plan2, "# Second\n")

      const plans = findPrometheusPlans(projectDir)
      expect(plans).toHaveLength(2)
      // Newest first
      expect(plans[0]).toBe(plan2)
      expect(plans[1]).toBe(plan1)
    })

    test("findPrometheusPlans ignores non-.md files", () => {
      writeFileSync(join(projectDir, ".sisyphus", "plans", "plan.md"), "# Plan\n")
      writeFileSync(join(projectDir, ".sisyphus", "plans", "notes.txt"), "ignored")

      const plans = findPrometheusPlans(projectDir)
      expect(plans).toHaveLength(1)
      expect(plans[0]).toContain("plan.md")
    })
  })

  // -------------------------------------------------------------------------
  // 4. getPlanProgress parses checkboxes
  // -------------------------------------------------------------------------
  describe("4. plan progress parsing", () => {
    test("parses simple plan with unchecked boxes", () => {
      const planPath = join(projectDir, ".sisyphus", "plans", "simple.md")
      writeFileSync(planPath, [
        "# My Plan",
        "",
        "- [ ] task one",
        "- [ ] task two",
        "- [x] task three",
      ].join("\n"))

      const progress = getPlanProgress(planPath)
      expect(progress.total).toBe(3)
      expect(progress.completed).toBe(1)
      expect(progress.isComplete).toBe(false)
    })

    test("parses structured plan with ## TODOs section", () => {
      const planPath = join(projectDir, ".sisyphus", "plans", "structured.md")
      writeFileSync(planPath, [
        "# Feature Plan",
        "",
        "## TODOs",
        "",
        "- [x] 1. setup project",
        "- [ ] 2. implement feature",
        "- [ ] 3. write tests",
        "",
        "## Notes",
        "",
        "- [ ] this should NOT be counted (no task label)",
      ].join("\n"))

      const progress = getPlanProgress(planPath)
      expect(progress.total).toBe(3)
      expect(progress.completed).toBe(1)
      expect(progress.isComplete).toBe(false)
    })

    test("marks plan as complete when all boxes checked", () => {
      const planPath = join(projectDir, ".sisyphus", "plans", "done.md")
      writeFileSync(planPath, [
        "# Done Plan",
        "- [x] task one",
        "- [x] task two",
      ].join("\n"))

      const progress = getPlanProgress(planPath)
      expect(progress.isComplete).toBe(true)
      expect(progress.completed).toBe(2)
    })

    test("returns isComplete=true for non-existent plan", () => {
      const progress = getPlanProgress(join(projectDir, ".sisyphus", "plans", "ghost.md"))
      expect(progress.total).toBe(0)
      expect(progress.isComplete).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 5. Full flow: write plan → write boulder.json → verify state
  // -------------------------------------------------------------------------
  describe("5. full prometheus → handover flow", () => {
    test("prometheus writes plan + boulder.json, handover state is readable", async () => {
      const hook = createPrometheusMdOnlyHook({ client: {}, directory: projectDir } as never)

      // Step 1: prometheus writes plan file
      const planPath = join(projectDir, ".sisyphus", "plans", "my-feature.md")
      const planContent = [
        "# My Feature",
        "",
        "## TODOs",
        "",
        "- [ ] 1. create the thing",
        "- [ ] 2. test the thing",
      ].join("\n")

      await hook["tool.execute.before"](
        { tool: "Write", sessionID: SESSION_ID, callID: "c8" },
        { args: { filePath: planPath } },
      )
      writeFileSync(planPath, planContent)

      // Step 2: prometheus writes boulder.json
      const boulderPath = join(projectDir, ".sisyphus", "boulder.json")
      await hook["tool.execute.before"](
        { tool: "Write", sessionID: SESSION_ID, callID: "c9" },
        { args: { filePath: boulderPath } },
      )
      writeBoulderState(projectDir, {
        active_plan: planPath,
        started_at: new Date().toISOString(),
        session_ids: [SESSION_ID],
        session_origins: { [SESSION_ID]: "direct" },
        plan_name: "my-feature",
        task_sessions: {},
      })

      // Step 3: verify plan is detectable
      const plans = findPrometheusPlans(projectDir)
      expect(plans).toHaveLength(1)
      expect(plans[0]).toBe(planPath)

      // Step 4: verify plan content is readable
      const writtenContent = readFileSync(planPath, "utf-8")
      expect(writtenContent).toContain("## TODOs")

      // Step 5: verify progress
      const progress = getPlanProgress(planPath)
      expect(progress.total).toBe(2)
      expect(progress.completed).toBe(0)
      expect(progress.isComplete).toBe(false)

      // Step 6: verify boulder.json is readable
      expect(existsSync(boulderPath)).toBe(true)
      const boulder = JSON.parse(readFileSync(boulderPath, "utf-8"))
      expect(boulder.active_plan).toBe(planPath)
      expect(boulder.plan_name).toBe("my-feature")
      expect(boulder.session_ids).toContain(SESSION_ID)
    })
  })
})

import type { PluginInput } from "@opencode-ai/plugin"
import { HOOK_NAME, BLOCKED_TOOLS, UNCONDITIONALLY_BLOCKED_TOOLS, PLANNING_CONSULT_WARNING, PROMETHEUS_WORKFLOW_REMINDER } from "./constants"
import { log } from "../../shared/logger"
import { SYSTEM_DIRECTIVE_PREFIX } from "../../shared/system-directive"
import { getAgentDisplayName } from "../../shared/agent-display-names"
import { getAgentFromSession } from "./agent-resolution"
import { isPrometheusAgent } from "./agent-matcher"
import { isAllowedFile } from "./path-policy"

const TASK_TOOLS = ["task", "call_omo_agent"]

export function createPrometheusMdOnlyHook(ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown>; message?: string }
    ): Promise<void> => {
      const agentName = await getAgentFromSession(input.sessionID, ctx.directory, ctx.client)

      if (!isPrometheusAgent(agentName)) {
        return
      }

      const toolName = input.tool

      // Inject planning-only warning for task tools called by Prometheus
       if (TASK_TOOLS.includes(toolName)) {
         const prompt = output.args.prompt as string | undefined
         if (prompt && !prompt.includes(SYSTEM_DIRECTIVE_PREFIX)) {
           output.args.prompt = PLANNING_CONSULT_WARNING + prompt
          log(`[${HOOK_NAME}] Injected planning warning to ${toolName}`, {
            sessionID: input.sessionID,
            tool: toolName,
            agent: agentName,
          })
        }
        return
      }

      if (!BLOCKED_TOOLS.includes(toolName)) {
        return
      }

      // bash and other shell tools must be blocked unconditionally —
      // they can create/delete directories and files without a filePath argument.
      if (UNCONDITIONALLY_BLOCKED_TOOLS.includes(toolName)) {
        log(`[${HOOK_NAME}] Blocked: Prometheus cannot run shell/bash commands`, {
          sessionID: input.sessionID,
          tool: toolName,
          agent: agentName,
        })
        throw new Error(
          `[${HOOK_NAME}] Prometheus is a planning agent. Shell command execution is not allowed. ` +
          `Use Write tool to create .sisyphus/plans/*.md plan files only. ` +
          `APOLOGIZE TO THE USER AND WRITE THE PLAN FILE DIRECTLY.`
        )
      }

      const filePath = (output.args.filePath ?? output.args.path ?? output.args.file) as string | undefined
      if (!filePath) {
        return
      }

       const repositoryBasePath = process.env.REPOSITORY_BASE_PATH
       if (!isAllowedFile(filePath, ctx.directory, repositoryBasePath)) {
         log(`[${HOOK_NAME}] Blocked: Prometheus can only write to .sisyphus/*.md`, {
           sessionID: input.sessionID,
           tool: toolName,
           filePath,
           ctxDirectory: ctx.directory,
           agent: agentName,
         })
       throw new Error(
          `[${HOOK_NAME}] Prometheus is a planning agent. File operations restricted to .sisyphus/*.md plan files only. Use task() to delegate implementation. ` +
          `Attempted to modify: ${filePath}. ` +
          `[debug: ctxDirectory=${ctx.directory}, repositoryBasePath=${process.env.REPOSITORY_BASE_PATH ?? "unset"}] ` +
          `APOLOGIZE TO THE USER, REMIND OF YOUR PLAN WRITING PROCESSES, TELL USER WHAT YOU WILL GOING TO DO AS THE PROCESS, WRITE THE PLAN`
        )
       }

      const normalizedPath = filePath.toLowerCase().replace(/\\/g, "/")
      if (normalizedPath.includes(".sisyphus/plans/") || normalizedPath.includes(".sisyphus\\plans\\")) {
        log(`[${HOOK_NAME}] Injecting workflow reminder for plan write`, {
          sessionID: input.sessionID,
          tool: toolName,
          filePath,
          agent: agentName,
        })
        output.message = (output.message || "") + PROMETHEUS_WORKFLOW_REMINDER
      }

      log(`[${HOOK_NAME}] Allowed: .sisyphus/*.md write permitted`, {
        sessionID: input.sessionID,
        tool: toolName,
        filePath,
        agent: agentName,
      })
    },
  }
}

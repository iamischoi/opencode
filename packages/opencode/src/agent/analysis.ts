import { Context, Effect, Layer } from "effect"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { SessionStatus } from "../session/status"
import { AppFileSystem } from "@opencode-ai/shared/filesystem"
import path from "path"
import { InstanceState } from "@/effect"

export interface Interface {
  readonly analyzeDirectory: (targetPath: string) => Effect.Effect<string, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AgentAnalysis") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const sessionSvc = yield* Session.Service
    const promptSvc = yield* SessionPrompt.Service
    const fs = yield* AppFileSystem.Service
    const statusSvc = yield* SessionStatus.Service

    const analyzeDirectory = Effect.fn("AgentAnalysis.analyzeDirectory")(function* (targetPath: string) {
      const session = yield* sessionSvc.create({})

      const promptText = `Please analyze the cloned project directories located in \`${targetPath}\` and generate a highly detailed implementation plan or diagnostic report. Save it as a markdown file in the \`.sisyphus/plans/\` folder. Once generated, please return the absolute path to the generated markdown file.`

      const finalAssistant = yield* promptSvc.prompt({
        sessionID: session.id,
        agent: "plan",
        parts: [{ type: "text", text: promptText }],
      })

      // Try to find the latest markdown file in `.sisyphus/plans/` of the current directory.
      // Wait, the agent writes to the *current project's* `.sisyphus/plans/`. 
      // The current instance is where the agent runs.
      const ctx = yield* InstanceState.context
      const plansDir = path.join(ctx.directory, ".sisyphus", "plans")
      
      const exists = yield* fs.existsSafe(plansDir)
      if (exists) {
        const files = yield* fs.readDirectoryEntries(plansDir).pipe(Effect.orDie)
        const mdFiles = files.filter(f => f.name.endsWith(".md"))
        if (mdFiles.length > 0) {
          const lastFile = path.join(plansDir, mdFiles[0].name)
          const content = yield* fs.readFileString(lastFile).pipe(Effect.orDie)
          return content
        }
      }

      const fallbackText = finalAssistant.parts
        .filter(p => p.type === "text")
        .map(p => (p as any).text)
        .join("\n")
      
      return fallbackText || "Plan generated but could not locate the exact markdown file."
    })

    return Service.of({ analyzeDirectory })
  })
)

export const defaultLayer = layer.pipe(
  Layer.provide(Session.defaultLayer),
  Layer.provide(SessionPrompt.defaultLayer),
  Layer.provide(SessionStatus.defaultLayer),
  Layer.provide(AppFileSystem.defaultLayer)
)

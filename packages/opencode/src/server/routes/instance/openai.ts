import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { SessionID, MessageID, PartID } from "@/session/schema"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { Bus } from "@/bus"
import { Agent } from "@/agent/agent"
import { jsonRequest, runRequest } from "./trace"
import { Auth } from "@/auth"
import { Plugin } from "@/plugin"
import { Effect, Option } from "effect"
import { AppRuntime } from "@/effect/app-runtime"
import { MessageV2 } from "@/session/message-v2"
import { Instance } from "@/project/instance"
import { ProviderID, ModelID } from "@/provider/schema"
import { Log } from "@/util"
import { START_WORK_TEMPLATE } from "../../../../../openagent/src/features/builtin-commands/templates/start-work"
import {
  findPrometheusPlans,
  getPlanName,
  getPlanProgress,
} from "../../../../../openagent/src/features/boulder-state/storage"
import { statSync } from "node:fs"

const log = Log.create({ service: "server.openai" })

export const OpenAiRoutes = () => {
  const routes = new Hono()

  // 1. Root /v1 check
  routes.get(
    "/",
    describeRoute({
      summary: "OpenAI connectivity check",
      description: "Returns status of the OpenAI-compatible API.",
    }),
    (c) => c.json({ status: "ok", message: "OpenCode OpenAI-compatible API" }),
  )

  // 2. Models list
  routes.get(
    "/models",
    describeRoute({
      summary: "List models (agents)",
      description: "Returns the agents based on application config.",
    }),
    async (c) => {
      return await runRequest("OpenAiRoutes.models", c, Effect.gen(function* () {
        // Dynamic models from env/config (fallback to process.env if config service doesn't have it yet)
        const appConfigsRaw = process.env.OPENCODE_APP_CONFIG || ""
        const agentTypesRaw = process.env.OPENCODE_AGENT_TYPES || ""

        const appConfigs = appConfigsRaw.split(",").map(s => s.trim()).filter(Boolean)
        const agentTypes = agentTypesRaw.split(",").map(s => s.trim()).filter(Boolean)

        log.info("listing models with config", { appConfigsRaw, agentTypesRaw, appConfigs, agentTypes })

        const models = []

        if (appConfigs.length > 0 && agentTypes.length > 0) {
          for (const app of appConfigs) {
            const [appName, rawCode] = app.split(":")
            // Pad code to 3 characters if it looks like a number or short string (e.g. S1 -> S01, 1 -> 001)
            const appCode = rawCode ? (rawCode.length < 3 && !isNaN(Number(rawCode.replace(/\D/g, ""))) ? rawCode.padStart(3, "0") : rawCode) : ""

            for (const type of agentTypes) {
              models.push({
                id: `${appName} ${type} AGENT`,
                object: "model",
                created: Math.floor(Date.now() / 1000),
                owned_by: "opencode"
              })
            }
          }
        } else {
          models.push({
            id: "SHLIFE-CODE-AGENT",
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: "opencode"
          })
        }

        return c.json({
          object: "list",
          data: models
        })
      }))
    }
  )

  // 3. Chat completions
  routes.post(
    "/chat/completions",
    describeRoute({
      summary: "OpenAI-compatible chat completions",
      description: "Send a message using OpenAI format. Streams response if requested.",
      operationId: "openai.chat.completions",
      responses: {
        200: {
          description: "Chat completion response",
        },
      },
    }),
    validator(
      "json",
      z.object({
        model: z.string().optional(),
        messages: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        })),
        stream: z.boolean().optional().default(false),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json")
      const { messages, stream: shouldStream, model } = body
      const lastMessage = messages[messages.length - 1]?.content || ""

      log.info("incoming chat completion request", {
        headers: c.req.header(),
        model,
        stream: shouldStream,
        messageCount: messages.length,
        prompt: lastMessage
      })

      return await runRequest("OpenAiRoutes.chat.completions", c, Effect.gen(function* () {
        const sessionSvc = yield* Session.Service
        const promptSvc = yield* SessionPrompt.Service
        const agentSvc = yield* Agent.Service
        const authSvc = yield* Auth.Service
        const pluginSvc = yield* Plugin.Service

        const auths = yield* authSvc.all()
        const isLoggedIn = Object.values(auths).some(auth => auth.type === "oauth")

        // 1. Resolve internal agent
        const useCustomProviders = process.env.OPENCODE_USE_CUSTOM_PROVIDERS?.toLowerCase() === "true"
        const agentTypesEnv = process.env.OPENCODE_API_TYPES || ""
        const agentModelsEnv = process.env.OPENCODE_AGENT_MODELS || ""

        // Parse OPENCODE_AGENT_MODELS once up-front (format: agentName:provider/model,...).
        // Previously the map was rebuilt on every resolveAgentModel() call — wasteful when the
        // function is called multiple times (prometheus + sisyphus handover).
        const agentModelMap: Record<string, string> = {}
        for (const s of agentModelsEnv.split(",")) {
          const trimmed = s.trim()
          if (!trimmed) continue
          const [rawAgent, rawModel] = trimmed.split(":")
          if (rawAgent && rawModel) {
            agentModelMap[rawAgent.trim().toLowerCase()] = rawModel.trim()
          }
        }

        const resolveAgentModel = (name: string) => {
          const modelStr = agentModelMap[name.toLowerCase()]
          if (!modelStr) return undefined
          const splitIdx = modelStr.indexOf("/")
          if (splitIdx <= 0) return undefined
          return {
            providerID: ProviderID.make(modelStr.substring(0, splitIdx)),
            modelID: ModelID.make(modelStr.substring(splitIdx + 1))
          }
        }

        const agentTypesMap: Record<string, boolean> = {}
        for (const s of agentTypesEnv.split(",")) {
          const trimmed = s.trim()
          if (!trimmed) continue
          const [intent, mode] = trimmed.split(":")
          if (intent && mode) {
            agentTypesMap[intent.trim()] = mode.trim().toLowerCase() === "auto"
          }
        }

        let agentName = "sisyphus"
        let promptModelOverride: { providerID: ProviderID; modelID: ModelID } | undefined = undefined
        let autoHandover = false

        if (model && (model.includes(" AGENT") || model === "SHLIFE-CODE-AGENT")) {
          log.info("detected dynamic agent request", { model })

          let agentType = "default"
          if (model.endsWith(" AGENT")) {
            const parts = model.split(" ")
            if (parts.length >= 3) {
              agentType = parts[parts.length - 2]
            }
          }

          autoHandover = agentTypesMap[agentType] ?? agentTypesMap["default"] ?? false
          agentName = "prometheus"
          // Only apply OPENCODE_AGENT_MODELS mapping when custom providers are explicitly enabled.
          // When useCustomProviders=false the corp endpoints are not active, so mapping to them
          // would point at an unreachable provider regardless of what AGENT_MODELS says.
          if (useCustomProviders) {
            promptModelOverride = resolveAgentModel("prometheus")
          }

          log.info("resolved agent configuration", { agentType, agentName, autoHandover, hasModelOverride: !!promptModelOverride })
        } else if (useCustomProviders) {
          // Mirror the same guard for the default sisyphus path.
          promptModelOverride = resolveAgentModel("sisyphus")
        }

        // Model selection when custom providers are disabled:
        //  - OAuth active (isLoggedIn=true)  → leave promptModelOverride as undefined so the
        //    prompt service picks the model saved in the user's opencode configuration
        //    (i.e. the recently-used / default model from the authenticated provider).
        //  - No OAuth                        → force the public free model so the request does
        //    not fail with an unauthenticated provider.
        if (!useCustomProviders && !isLoggedIn) {
          log.info("Custom providers disabled and no OAuth session. Falling back to free model.")
          promptModelOverride = {
            providerID: ProviderID.make("opencode"),
            modelID: ModelID.make("minimax-m2.5-free")
          }
        }

        let agent: any
        const result1 = yield* Effect.exit(agentSvc.get(agentName))
        if (result1._tag === "Success" && result1.value) {
          agent = result1.value
        } else {
          const planResult = yield* Effect.exit(agentSvc.get("plan"))
          if (planResult._tag === "Success" && planResult.value) {
            agent = planResult.value
          } else {
            const result2 = yield* Effect.exit(agentSvc.get("sisyphus"))
            if (result2._tag === "Success" && result2.value) {
              agent = result2.value
            } else {
              agent = yield* agentSvc.get("build")
            }
          }
        }

        let executionAgent = agent
        if (autoHandover) {
          const atlasResult = yield* Effect.exit(agentSvc.get("atlas"))
          if (atlasResult._tag === "Success" && atlasResult.value) {
            executionAgent = atlasResult.value
          } else {
            const sisyphusResult = yield* Effect.exit(agentSvc.get("sisyphus"))
            if (sisyphusResult._tag === "Success" && sisyphusResult.value) {
              executionAgent = sisyphusResult.value
            } else {
              executionAgent = yield* agentSvc.get("build")
            }
          }
        }

        // 2. Identify/Create session
        // For simplicity, we create a new session if none is clearly associated.
        // clients like Open WebUI often don't pass a session ID, so we might want to 
        // rely on recent sessions or a fresh one. Here we create a new one to be clean.
        const session = yield* sessionSvc.create({})
        const sessionID = session.id
        const projectDirectory = Instance.directory
        const snapshotPrometheusPlans = () => new Map(
          findPrometheusPlans(projectDirectory).map((planPath) => [planPath, statSync(planPath).mtimeMs]),
        )
        const findRunnablePrometheusPlan = (before: Map<string, number>) => findPrometheusPlans(projectDirectory).find((planPath) => {
          const previousMtime = before.get(planPath)
          if (previousMtime === undefined) return false
          const nextMtime = statSync(planPath).mtimeMs
          if (nextMtime <= previousMtime) return false
          return true
        }) ?? findPrometheusPlans(projectDirectory).find((planPath) => {
          if (before.has(planPath)) return false
          return true
        })
        const buildStartWorkParts = Effect.fn("OpenAiRoutes.buildStartWorkParts")(function* (planName: string) {
          return yield* pluginSvc.trigger(
            "command.execute.before",
            { command: "start-work", sessionID, arguments: planName },
            {
              parts: [{
                type: "text" as const,
                text: `<command-instruction>
${START_WORK_TEMPLATE}
</command-instruction>

<session-context>
Session ID: $SESSION_ID
Timestamp: $TIMESTAMP
</session-context>

<user-request>
${planName}
</user-request>`,
              }],
            },
          )
        })

        // Inject conversation history into the session for multi-turn support (OpenWebUI)
        if (messages.length > 1) {
          let currentParentID: MessageID | undefined = undefined;
          for (let i = 0; i < messages.length - 1; i++) {
            const msg = messages[i];
            const msgID = MessageID.ascending();
            yield* sessionSvc.updateMessage({
              id: msgID,
              sessionID: sessionID,
              role: msg.role === "assistant" ? "assistant" : "user",
              time: { created: Date.now(), updated: Date.now() },
              parentID: currentParentID
            } as any);
            
            yield* sessionSvc.updatePart({
              id: PartID.ascending(),
              messageID: msgID,
              sessionID: sessionID,
              type: "text",
              text: msg.content,
              time: { created: Date.now(), updated: Date.now() }
            } as any);
            currentParentID = msgID;
          }
        }

        if (shouldStream) {
          c.header("X-Accel-Buffering", "no")
          return streamSSE(c, async (sseStream) => {
            const created = Math.floor(Date.now() / 1000)
            const modelName = model || "SHLIFE-CODE-AGENT"

            // helper to format status
            const formatStatus = (msg: string) => `\n> ${msg}\n`

            // Helper to send deduplicated status update
            let lastSentStatus = "" // Move up for sendStatusUpdate
            const sendStatusUpdate = async (msg: string, asContent = false) => {
              if (msg === lastSentStatus) return
              lastSentStatus = msg
              
              const delta: any = {}

              if (asContent) {
                // For activity status, send to the main content stream
                delta.content = msg
              } else {
                // For internal thoughts, send to reasoning fields
                delta.reasoning_content = msg
                delta.thought = msg
                delta.thinking = msg
                delta.reasoning = msg
              }

              await sseStream.writeSSE({
                data: JSON.stringify({
                  id: sessionID, object: "chat.completion.chunk", created, model: modelName,
                  choices: [{
                    index: 0,
                    delta,
                    finish_reason: null
                  }]
                })
              })
            }

            await sseStream.writeSSE({
              data: JSON.stringify({
                id: sessionID,
                object: "chat.completion.chunk",
                created,
                model: modelName,
                choices: [{
                  index: 0,
                  delta: { role: "assistant", content: "" },
                  finish_reason: null
                }]
              })
            })

            // Subscribe to events FIRST
            let finished = false
            const toolCalls = new Map<string, { id: string, index: number, name: string, args: string }>()
            let toolCallCount = 0
            let lastActivity: "prompt" | "tool" | "agent" | "planning" | "none" = "prompt"
            // Phase tracking: route intermediate LLM text to reasoning, final answer to content
            const agentDisplayNameRaw = agent?.name || agentName || "Sisyphus"
            let currentAgentDisplayName = agentDisplayNameRaw.charAt(0).toUpperCase() + agentDisplayNameRaw.slice(1)
            let currentTaskSummary = ""
            let hasToolCallsInSession = false   // true once any tool is called in this turn
            let currentStepHasTools = false      // true if current step has tool calls
            let lastStepHadTools = false          // true if the previous step had tool calls
            let finalAnswerStarted = false        // true once we inject the separator
            let textBuffer = ""                     // accumulates text during tool-loop phases

            const trackedSessions = new Set<string>([sessionID])

            const unsub = Bus.subscribeAll(async (event) => {
              // 1. Track session hierarchy: if a new session is created as a child of a tracked session, track it too.
              if (event.type === "session.created") {
                const info = event.properties.info
                if (info && info.parentID && trackedSessions.has(info.parentID)) {
                  trackedSessions.add(event.properties.sessionID)
                  log.info("tracking child session", { sessionID: event.properties.sessionID, parentID: info.parentID })
                }
              }

              // 2. Filter events by session hierarchy
              if (!event.properties?.sessionID || !trackedSessions.has(event.properties.sessionID)) return

              // Detailed logging to help debug event flow
              log.debug("captured bus event", { type: event.type, properties: event.properties })

              try {
                // 1. Session Status Updates (Busy, Retry, etc.)
                if (event.type === "session.status") {
                  const { status } = event.properties
                  if (status.type === "busy") {
                    let thought = "🧠 진행 상황을 분석하고 최적의 대응 방안을 고민 중입니다..."
                    if (lastActivity === "prompt") thought = "🔍 요청하신 내용을 분석하며 해결 방법을 찾고 있습니다..."
                    if (lastActivity === "tool") thought = "✅ 도구 실행 결과를 검토하고 다음 단계를 계획 중입니다..."
                    if (lastActivity === "agent") thought = "🤖 새로운 에이전트가 작업 맥락을 파악하고 있습니다..."
                    if (lastActivity === "planning") thought = "📋 계획된 다음 단계 실행을 준비 중입니다..."

                    await sendStatusUpdate(formatStatus(thought), false) // Don't spam content with "thinking" placeholders
                  }
                  if (status.type === "retry") {
                    await sendStatusUpdate(formatStatus(`⚠️ 재시도 중... (시도 ${status.attempt})\n> 사유: ${status.message}`), false)
                  }
                }

                // 1.5 New Text Part Start - clear buffer so only the last text part remains
                // Within a step, the LLM may produce multiple text parts:
                // first for thinking, then for the actual answer. We only want the last one.
                if (event.type === "message.part.updated" && event.properties.part?.type === "text") {
                  const part = event.properties.part as { text: string }
                  if (part.text === "") {
                    // A new text part with empty text = start of a new text section
                    textBuffer = ""
                  }
                }

                // 2. Text Deltas - ALL text goes to reasoning during processing
                // The final answer buffer is flushed to content after prompt completion
                if (event.type === "message.part.delta" && event.properties.field === "text") {
                  const delta = event.properties.delta
                  textBuffer += delta

                  // Stream to reasoning so user can see progress in Thinking box
                  await sseStream.writeSSE({
                    data: JSON.stringify({
                      id: sessionID,
                      object: "chat.completion.chunk",
                      created,
                      model: modelName,
                      choices: [{
                        index: 0,
                        delta: {
                          reasoning_content: delta,
                          reasoning: delta,
                          thinking: delta,
                          thought: delta
                        },
                        finish_reason: null
                      }]
                    })
                  })
                }

                // 3. Reasoning Deltas (Internal CoT)
                if (event.type === "message.part.delta" && event.properties.field === "reasoning") {
                  const delta = event.properties.delta
                  
                  // If this is the start of reasoning and we have context, prepend it
                  let prefix = ""
                  if (!lastSentStatus.includes("생각 중") && currentAgentDisplayName) {
                    prefix = `[${currentAgentDisplayName}] ${currentTaskSummary || "생각 중..."}\n\n`
                    lastSentStatus = prefix // Mark as sent to avoid repeated prefixing
                  }

                  await sseStream.writeSSE({
                    data: JSON.stringify({
                      id: sessionID, object: "chat.completion.chunk", created, model: modelName,
                      choices: [{
                        index: 0,
                        delta: {
                          reasoning_content: prefix + delta,
                          reasoning: prefix + delta,
                          thinking: prefix + delta,
                          thought: prefix + delta
                        },
                        finish_reason: null
                      }]
                    })
                  })
                }

                // 4. Tool Call Start
                if (event.type === "message.part.created" && event.properties.type === "tool") {
                  const partID = event.properties.id
                  const toolName = event.properties.tool
                  const toolCallId = `call_${partID}`
                  const index = toolCallCount++
                  toolCalls.set(partID, { id: toolCallId, index, name: toolName, args: "" })

                  // Mark that this session and current step use tools
                  hasToolCallsInSession = true
                  currentStepHasTools = true
                  // Clear text buffer - any text before a tool call is intermediate thinking
                  // (already sent to reasoning stream, not needed for final answer)
                  textBuffer = ""

                  await sendStatusUpdate(formatStatus(`⚙️ **${toolName}** 준비 중...`))

                  // Also send the actual tool call chunk (OpenAI spec)
                  await sseStream.writeSSE({
                    data: JSON.stringify({
                      id: sessionID,
                      object: "chat.completion.chunk",
                      created,
                      model: modelName,
                      choices: [{
                        index: 0,
                        delta: {
                          tool_calls: [{
                            index,
                            id: toolCallId,
                            type: "function",
                            function: { name: toolName, arguments: "" }
                          }]
                        },
                        finish_reason: null
                      }]
                    })
                  })
                }

                // 5. Tool Call Arguments Delta
                if (event.type === "message.part.delta" && event.properties.field === "tool") {
                  const partID = event.properties.id
                  const tool = toolCalls.get(partID)
                  if (tool) {
                    tool.args += event.properties.delta
                    await sseStream.writeSSE({
                      data: JSON.stringify({
                        id: sessionID,
                        object: "chat.completion.chunk",
                        created,
                        model: modelName,
                        choices: [{
                          index: 0,
                          delta: {
                            tool_calls: [{
                              index: tool.index,
                              function: { arguments: event.properties.delta }
                            }]
                          },
                          finish_reason: null
                        }]
                      })
                    })
                  }
                }

                // 6. Tool Success/Error handled in #12 below

                // 7. Planning / Step Start
                if (event.type === "message.part.created" && event.properties.type === "step-start") {
                  lastActivity = "planning"
                  // Clear buffer at step start - previous step's text is intermediate
                  textBuffer = ""
                  await sendStatusUpdate(formatStatus(`🔍 다음 단계를 계획하고 있습니다...`))
                }

                // 8. Step Finish / Usage
                if (event.type === "message.part.created" && event.properties.type === "step-finish") {
                  const { reason, cost } = event.properties
                  await sendStatusUpdate(formatStatus(`🏁 단계 완료 (상태: ${reason}, 비용: $${cost.toFixed(4)})`))

                  // Track step transitions for phase detection
                  lastStepHadTools = currentStepHasTools
                  currentStepHasTools = false

                  if (reason === "tool-calls") {
                    // Step ended with tool-calls - clear the buffer since this text was intermediate
                    textBuffer = ""
                  }
                  // If reason is NOT "tool-calls" (e.g. "stop", "end_turn"),
                  // keep textBuffer - it will be flushed as final answer after prompt completes
                }

                // 9. File Changes (Patches)
                if (event.type === "message.part.created" && event.properties.type === "patch") {
                  const files = (event.properties.files || []) as string[]
                  await sendStatusUpdate(formatStatus(`📝 코드 변경 사항 반영 중:\n${files.map((f: string) => `  - ${f}`).join("\n")}`))
                }

                // 10. Retries
                if (event.type === "message.part.created" && event.properties.type === "retry") {
                  const { attempt, error } = event.properties
                  await sendStatusUpdate(formatStatus(`⚠️ 재시도 진행 중 (시도 ${attempt})...\n> 오류: ${error.message}`))
                }

                // 11. Agent Transitions
                if (event.type === "message.updated" && event.properties.info?.role === "assistant") {
                  log.debug("agent updated", { agent: event.properties.info.agent })
                }

                // 12. Detailed Tool Activity (Lifecycle: Running, Completed, Error)
                if (event.type === "message.part.updated" && event.properties.part?.type === "tool") {
                  const part = event.properties.part as MessageV2.ToolPart
                  const toolName = part.tool
                  const state = part.state
                  let msg = ""

                  const toolMap: Record<string, string> = {
                    bash: "터미널 명령",
                    read: "파일/데이터 읽기",
                    read_file: "파일 읽기",
                    view_file: "파일 내용 확인",
                    write_file: "파일 생성/저장",
                    replace_file_content: "파일 내용 수정",
                    multi_replace_file_content: "여러 파일 일괄 수정",
                    grep_search: "파일 내용 검색",
                    list_dir: "디렉토리 구조 분석",
                    search_web: "웹 검색",
                    google_search: "구글 검색",
                    question: "사용자 질문",
                    delegate_task: "에이전트 업무 위임",
                    task: "에이전트 업무 위임"
                  }
                  let name = toolMap[toolName]
                  if (!name) {
                    // Detect MCP server tools (format: server_toolname)
                    const mcpMatch = toolName.match(/^([^_]+)_(.+)$/)
                    if (mcpMatch) {
                      name = `[MCP ${mcpMatch[1]}] ${mcpMatch[2]}`
                    } else {
                      name = toolName
                    }
                  }

                  if (state.status === "running") {
                    lastActivity = "tool"
                    let argsDesc = ""
                    try {
                      const args = state.input

                      // Helper to format path with package context
                      const formatPath = (p: string) => {
                        const packageMatch = p.match(/packages\/([^/]+)\/(.+)/)
                        if (packageMatch) {
                          return `[${packageMatch[1]}] ${packageMatch[2]}`
                        }
                        const rootMatch = p.match(/opencode\/(.+)/)
                        if (rootMatch) {
                          return rootMatch[1]
                        }
                        return p.split("/").slice(-3).join("/") // Fallback to last 3 segments
                      }

                      // 1. Prioritize 'description' for high-level intent (common in bash/task tools)
                      if (args.description) {
                        argsDesc = `: ${args.description}`
                        currentTaskSummary = args.description
                      }
                      // 2. Question Tool
                      else if (args.questions && Array.isArray(args.questions) && args.questions[0]?.question) {
                        argsDesc = `: "${args.questions[0].question}"`
                        currentTaskSummary = "질문 작성 중"
                      }
                      // 3. Delegate Task Tool (Sisyphus orchestration)
                      else if (toolName === "delegate_task" || toolName === "task") {
                        const target = args.subagent_type || args.category || "알 수 없는 에이전트"
                        const taskDesc = args.description || "업무 수행"
                        argsDesc = `: **${target}**에게 **"${taskDesc}"** 위임`
                        currentTaskSummary = `${target}에게 업무 위임 중`
                      }
                      // 4. Specific Path Fields (File/Dir/Grep)
                      else if (args.filePath) argsDesc = `: \`${formatPath(args.filePath)}\``
                      else if (args.DirectoryPath) argsDesc = `: \`${formatPath(args.DirectoryPath)}\``
                      else if (args.SearchPath) argsDesc = `: \`${formatPath(args.SearchPath)}\``
                      else if (args.TargetFile) argsDesc = `: \`${formatPath(args.TargetFile)}\``
                      else if (args.AbsolutePath) argsDesc = `: \`${formatPath(args.AbsolutePath)}\``
                      else if (args.path) argsDesc = `: \`${formatPath(args.path)}\``
                      // 4. Command/Query/Url
                      else if (args.command) argsDesc = `: \`${args.command}\``
                      else if (args.query) argsDesc = `: \`${args.query}\``
                      else if (args.Url) argsDesc = `: \`${args.Url}\``
                      // 5. Fallbacks
                      else if (args.filename) argsDesc = `: \`${args.filename}\``
                    } catch (e: unknown) { }
                    msg = formatStatus(`⏳ ${name} 실행 중${argsDesc}...`)
                  } else if (state.status === "completed") {
                    lastActivity = "tool"
                    msg = formatStatus(`✅ ${name} 수행 완료`)
                  } else if (state.status === "error") {
                    msg = formatStatus(`❌ ${name} 수행 중 오류 발생: ${state.error}`)
                  }

                  if (msg) {
                    await sendStatusUpdate(msg)
                  }
                }

                // 13. Agent Transitions (Part created) - Internal OpenCode Agents
                if (event.type === "message.part.created" && event.properties.type === "agent") {
                  lastActivity = "agent"
                  const { name } = event.properties
                  const agentMap: Record<string, string> = {
                    build: "주 에이전트(Build)",
                    explore: "코드 분석 에이전트(Explore)",
                    general: "일반 업무 에이전트(General)",
                    plan: "기획 에이전트(Plan)",
                    reviewer: "검토 에이전트(Reviewer)",
                    coder: "개발 에이전트(Coder)"
                  }
                  const displayName = agentMap[name.toLowerCase()] || `분야별 에이전트(${name})`
                  currentAgentDisplayName = displayName
                  currentTaskSummary = "작업 계획 수립 및 수행 중"
                  await sendStatusUpdate(formatStatus(`🤖 작업 주체 전환: **${displayName}**`))
                  // Also inject into reasoning field for Thinking box context
                  await sendStatusUpdate(`\n[${displayName}] 작업 수행 중...\n`, false)
                }
              } catch (e) {
                log.error("failed to write SSE", { error: e })
              }
            })

            // Trigger prompt asynchronously
            log.info("starting prompt", {
              sessionID,
              agent: agent.name,
              modelOverride: promptModelOverride
                ? `${promptModelOverride.providerID}/${promptModelOverride.modelID}`
                : "(default - will use configured/recently-used model)",
              isLoggedIn,
              useCustomProviders,
            })
            try {
              const plansBeforePrompt = autoHandover ? snapshotPrometheusPlans() : undefined
              const finalParts: any[] = [{ type: "text", text: lastMessage }]
              
              if (autoHandover && agentName === "prometheus") {
                finalParts.unshift({ 
                  type: "text", 
                  text: "<system-reminder>\nYOU ARE IN AUTOMATED MODE. Do not interview the user. Do not ask for confirmation. Use your tools to gather context and generate a complete .sisyphus/plans/*.md file immediately. Once the plan is saved, conclude your turn.\n</system-reminder>" 
                })
              }

              await AppRuntime.runPromise(
                promptSvc.prompt({
                  sessionID,
                  parts: finalParts,
                  agent: agent.name,
                  model: promptModelOverride,
                })
              )

              // Auto-handover to Sisyphus if Prometheus finished planning
              if (autoHandover && agentName === "prometheus") {
                const verifiedPlanPath = plansBeforePrompt
                  ? findRunnablePrometheusPlan(plansBeforePrompt)
                  : undefined

                if (verifiedPlanPath) {
                  log.info("triggering automatic handover to execution agent", {
                    sessionID,
                    executionAgent: executionAgent.name,
                    verifiedPlanPath,
                  })
                  await sendStatusUpdate(formatStatus(`🚀 계획 파일 확인 완료 (${getPlanName(verifiedPlanPath)}). 자동으로 개발 작업을 시작합니다...`))

                  await AppRuntime.runPromise(
                    Effect.gen(function* () {
                      const startWork = yield* buildStartWorkParts(getPlanName(verifiedPlanPath))
                      return yield* promptSvc.prompt({
                        sessionID,
                        parts: startWork.parts,
                        agent: executionAgent.name,
                        model: useCustomProviders ? resolveAgentModel(executionAgent.name) : undefined,
                      })
                    })
                  )
                } else {
                  log.warn("skipping automatic handover because no runnable prometheus plan was verified", { sessionID, projectDirectory })
                  await sendStatusUpdate(formatStatus("⚠️ 계획은 끝났지만 실행 가능한 Prometheus plan 파일을 확인하지 못해 자동 개발 단계는 건너뜁니다."))
                }
              }

              // After the turn is FULLY complete (all tool loops done)
              // Flush any remaining buffered text as the final answer
              if (textBuffer.length > 0) {
                await sseStream.writeSSE({
                  data: JSON.stringify({
                    id: sessionID,
                    object: "chat.completion.chunk",
                    created,
                    model: modelName,
                    choices: [{
                      index: 0,
                      delta: { content: textBuffer },
                      finish_reason: null
                    }]
                  })
                })
                textBuffer = ""
              }

              await sseStream.writeSSE({
                data: JSON.stringify({
                  id: sessionID,
                  object: "chat.completion.chunk",
                  created,
                  model: modelName,
                  choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: "stop"
                  }]
                })
              })
              await sseStream.writeSSE({ data: "[DONE]" })
            } catch (err) {
              log.error("prompt failed", { err })
              // Send error chunk + [DONE] so the client doesn't hang waiting
              try {
                await sseStream.writeSSE({
                  data: JSON.stringify({
                    id: sessionID,
                    object: "chat.completion.chunk",
                    created,
                    model: modelName,
                    choices: [{
                      index: 0,
                      delta: { content: `\n\n⚠️ 처리 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}` },
                      finish_reason: "stop"
                    }]
                  })
                })
                await sseStream.writeSSE({ data: "[DONE]" })
              } catch (writeErr) {
                log.error("failed to write error SSE", { writeErr })
              }
            } finally {
              finished = true
              unsub()
            }
          })
        }

        // Non-streaming
        const plansBeforePrompt = autoHandover ? snapshotPrometheusPlans() : undefined
        const finalParts: any[] = [{ type: "text", text: lastMessage }]
        if (autoHandover && agentName === "prometheus") {
          finalParts.unshift({ 
            type: "text", 
            text: "<system-reminder>\nYOU ARE IN AUTOMATED MODE. Do not interview the user. Do not ask for confirmation. Use your tools to gather context and generate a complete .sisyphus/plans/*.md file immediately. Once the plan is saved, conclude your turn.\n</system-reminder>" 
          })
        }

        const msg = yield* promptSvc.prompt({
          sessionID,
          parts: finalParts,
          agent: agent.name,
          model: promptModelOverride,
        })

        let finalMessage = msg

        if (autoHandover && agentName === "prometheus") {
          const verifiedPlanPath = plansBeforePrompt
            ? findRunnablePrometheusPlan(plansBeforePrompt)
            : undefined

          if (verifiedPlanPath) {
            const startWork = yield* buildStartWorkParts(getPlanName(verifiedPlanPath))
            finalMessage = yield* promptSvc.prompt({
              sessionID,
              parts: startWork.parts,
              agent: executionAgent.name,
              model: useCustomProviders ? resolveAgentModel(executionAgent.name) : undefined,
            })
          } else {
            log.warn("skipping automatic handover because no runnable prometheus plan was verified", { sessionID, projectDirectory })
          }
        }

        const content = finalMessage.parts
          .filter((p): p is MessageV2.TextPart => p.type === "text")
          .map(p => p.text)
          .join("")

        return c.json({
          id: sessionID,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: model || "SHLIFE-CODE-AGENT",
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: content,
            },
            finish_reason: "stop"
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        })
      }) as any)
    },
  )

  return routes
}

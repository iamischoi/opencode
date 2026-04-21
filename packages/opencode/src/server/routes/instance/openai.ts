import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { SessionID, MessageID } from "@/session/schema"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { Bus } from "@/bus"
import { Agent } from "@/agent/agent"
import { jsonRequest, runRequest } from "./trace"
import { Effect, Option } from "effect"
import { AppRuntime } from "@/effect/app-runtime"
import { MessageV2 } from "@/session/message-v2"
import { Instance } from "@/project/instance"
import { ProviderID, ModelID } from "@/provider/schema"
import { Log } from "@/util"

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

        // 1. Resolve internal agent (build is the primary default)
        let agentName = "build"

        // Check if the model is one of our dynamic aliases
        const isDynamicModel = model && (model.endsWith(" AGENT") || model === "SHLIFE-CODE-AGENT")

        if (model && !isDynamicModel) {
          const exit = yield* Effect.exit(agentSvc.get(model))
          if (exit._tag === "Success" && exit.value) {
            agentName = exit.value.name
          }
        }

        const agent = (yield* agentSvc.get(agentName)) || (yield* agentSvc.get("build"))

        if (model && model.includes(" AGENT")) {
          log.info("detected dynamic agent request", { model })
          // You could extract app code/type here if needed for prompt injection
        }

        // 2. Identify/Create session
        // For simplicity, we create a new session if none is clearly associated.
        // clients like Open WebUI often don't pass a session ID, so we might want to 
        // rely on recent sessions or a fresh one. Here we create a new one to be clean.
        const session = yield* sessionSvc.create({})
        const sessionID = session.id

        if (shouldStream) {
          c.header("X-Accel-Buffering", "no")
          return streamSSE(c, async (sseStream) => {
            const created = Math.floor(Date.now() / 1000)
            const modelName = model || "SHLIFE-CODE-AGENT"

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
            let lastSentStatus = "" // For deduplication

            const unsub = Bus.subscribeAll(async (event) => {
              if (event.properties?.sessionID !== sessionID) return

              // Detailed logging to help debug event flow
              log.debug("captured bus event", { type: event.type, properties: event.properties })

              try {
                // helper to format status
                const formatStatus = (msg: string) => `\n> ${msg}\n`

                // Helper to send deduplicated status update
                const sendStatusUpdate = async (msg: string) => {
                  if (msg === lastSentStatus) return
                  lastSentStatus = msg
                  await sseStream.writeSSE({
                    data: JSON.stringify({
                      id: sessionID, object: "chat.completion.chunk", created, model: modelName,
                      choices: [{
                        index: 0,
                        delta: {
                          reasoning_content: msg,
                          thought: msg
                        },
                        finish_reason: null
                      }]
                    })
                  })
                }

                // 1. Session Status Updates (Busy, Retry, etc.)
                if (event.type === "session.status") {
                  const { status } = event.properties
                  if (status.type === "busy") {
                    let thought = "🧠 진행 상황을 분석하고 최적의 대응 방안을 고민 중입니다..."
                    if (lastActivity === "prompt") thought = "🔍 요청하신 내용을 분석하며 해결 방법을 찾고 있습니다..."
                    if (lastActivity === "tool") thought = "✅ 도구 실행 결과를 검토하고 다음 단계를 계획 중입니다..."
                    if (lastActivity === "agent") thought = "🤖 새로운 에이전트가 작업 맥락을 파악하고 있습니다..."
                    if (lastActivity === "planning") thought = "📋 계획된 다음 단계 실행을 준비 중입니다..."

                    await sendStatusUpdate(formatStatus(thought))
                  }
                  if (status.type === "retry") {
                    await sendStatusUpdate(formatStatus(`⚠️ 재시도 중... (시도 ${status.attempt})\n> 사유: ${status.message}`))
                  }
                }

                // 2. Text Deltas (Final Answer)
                if (event.type === "message.part.delta" && event.properties.field === "text") {
                  const delta = event.properties.delta
                  await sseStream.writeSSE({
                    data: JSON.stringify({
                      id: sessionID,
                      object: "chat.completion.chunk",
                      created,
                      model: modelName,
                      choices: [{
                        index: 0,
                        delta: { content: delta },
                        finish_reason: null
                      }]
                    })
                  })
                }

                // 3. Reasoning Deltas (Internal CoT)
                if (event.type === "message.part.delta" && event.properties.field === "reasoning") {
                  const delta = event.properties.delta
                  await sseStream.writeSSE({
                    data: JSON.stringify({
                      id: sessionID, object: "chat.completion.chunk", created, model: modelName,
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

                // 4. Tool Call Start
                if (event.type === "message.part.created" && event.properties.type === "tool") {
                  const partID = event.properties.id
                  const toolName = event.properties.tool
                  const toolCallId = `call_${partID}`
                  const index = toolCallCount++
                  toolCalls.set(partID, { id: toolCallId, index, name: toolName, args: "" })

                  // Instead of simple preparation, we'll rely more on the 'running' state in #12
                  // but we can show a quick start emoji here.
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
                  await sendStatusUpdate(formatStatus(`🔍 다음 단계를 계획하고 있습니다...`))
                }

                // 8. Step Finish / Usage
                if (event.type === "message.part.created" && event.properties.type === "step-finish") {
                  const { reason, cost } = event.properties
                  await sendStatusUpdate(formatStatus(`🏁 단계 완료 (상태: ${reason}, 비용: $${cost.toFixed(4)})`))
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
                    google_search: "구글 검색"
                  }
                  const name = toolMap[toolName] || toolName

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
                      }
                      // 2. Specific Path Fields (File/Dir/Grep)
                      else if (args.filePath) argsDesc = `: \`${formatPath(args.filePath)}\``
                      else if (args.DirectoryPath) argsDesc = `: \`${formatPath(args.DirectoryPath)}\``
                      else if (args.SearchPath) argsDesc = `: \`${formatPath(args.SearchPath)}\``
                      else if (args.TargetFile) argsDesc = `: \`${formatPath(args.TargetFile)}\``
                      else if (args.AbsolutePath) argsDesc = `: \`${formatPath(args.AbsolutePath)}\``
                      else if (args.path) argsDesc = `: \`${formatPath(args.path)}\``
                      // 3. Command/Query/Url
                      else if (args.command) argsDesc = `: \`${args.command}\``
                      else if (args.query) argsDesc = `: \`${args.query}\``
                      else if (args.Url) argsDesc = `: \`${args.Url}\``
                      // 4. Fallbacks
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
                  await sendStatusUpdate(formatStatus(`🤖 작업 주체 전환: **${displayName}**`))
                }
              } catch (e) {
                log.error("failed to write SSE", { error: e })
              }
            })

            // Trigger prompt asynchronously
            try {
              await AppRuntime.runPromise(
                promptSvc.prompt({
                  sessionID,
                  parts: [{ type: "text", text: lastMessage }],
                  agent: agent.name,
                })
              )

              // After the turn is FULLY complete (all tool loops done)
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
            } finally {
              finished = true
              unsub()
            }

            // Connection keep-alive while awaiting turn completion
            while (!finished) {
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          })
        }

        // Non-streaming
        const msg = yield* promptSvc.prompt({
          sessionID,
          parts: [{ type: "text", text: lastMessage }],
          agent: agent.name,
        })

        const content = msg.parts
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

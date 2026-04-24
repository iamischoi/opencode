/**
 * opencode API 테스트 공통 유틸리티
 *
 * 서버 URL, 공통 fetch 헬퍼, SSE 스트림 파서를 제공합니다.
 * 모든 시나리오에서 이 파일을 import해서 사용합니다.
 */

// ─── 설정 ────────────────────────────────────────────────────────────────────

export const SERVER_URL = process.env.OPENCODE_TEST_URL ?? "http://127.0.0.1:3333"
export const API_BASE = `${SERVER_URL}/v1`

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  stream: boolean
}

export interface SseDelta {
  content?: string
  reasoning_content?: string
  thought?: string
}

export interface SseChunk {
  id: string
  object: string
  choices: Array<{
    index: number
    delta: SseDelta
    finish_reason: string | null
  }>
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

/** 색상 출력 헬퍼 */
export const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
}

/** 구분선 출력 */
export function section(title: string) {
  console.log("\n" + c.bold(c.cyan("═".repeat(60))))
  console.log(c.bold(c.cyan(`  ${title}`)))
  console.log(c.bold(c.cyan("═".repeat(60))))
}

/** 서버 연결 확인 */
export async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

/** 모델 목록 조회 */
export async function listModels() {
  const res = await fetch(`${API_BASE}/models`)
  if (!res.ok) throw new Error(`모델 목록 조회 실패: ${res.status}`)
  return (await res.json()) as { data: Array<{ id: string }> }
}

/** Non-streaming 채팅 요청 */
export async function chatSync(req: ChatRequest) {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, stream: false }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`요청 실패 (${res.status}): ${text}`)
  }
  return res.json()
}

/**
 * Streaming SSE 채팅 요청
 * - onContent: 본문 텍스트 델타 콜백
 * - onReasoning: 내부 사고(reasoning) 텍스트 델타 콜백
 * - onDone: 스트림 종료 콜백
 */
export async function chatStream(
  req: ChatRequest,
  opts: {
    onContent?: (delta: string) => void
    onReasoning?: (delta: string) => void
    onDone?: () => void
  } = {},
): Promise<{ fullContent: string; fullReasoning: string }> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, stream: true }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text()
    throw new Error(`스트림 요청 실패 (${res.status}): ${text}`)
  }

  let fullContent = ""
  let fullReasoning = ""
  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") {
        opts.onDone?.()
        continue
      }
      try {
        const chunk = JSON.parse(data) as SseChunk
        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        if (delta.content) {
          fullContent += delta.content
          opts.onContent?.(delta.content)
        }
        if (delta.reasoning_content || delta.thought) {
          const r = delta.reasoning_content ?? delta.thought ?? ""
          fullReasoning += r
          opts.onReasoning?.(r)
        }
      } catch {
        // 파싱 불가 청크는 무시
      }
    }
  }

  return { fullContent, fullReasoning }
}

/** elapsed time 포맷 */
export function elapsed(startMs: number) {
  const sec = ((Date.now() - startMs) / 1000).toFixed(1)
  return c.dim(`(${sec}s)`)
}

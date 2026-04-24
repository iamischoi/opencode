/**
 * 시나리오: 개발:auto 모드 테스트
 *
 * OPENCODE_API_TYPES=개발:auto 설정 하에서
 * "SOLT1 개발 AGENT" 모델로 실제 개발 의뢰 형태의 프롬프트를 전송합니다.
 *
 * 기대 동작:
 *  - agentName = "prometheus" (플래닝 에이전트)
 *  - autoHandover = true
 *  - prometheus가 AUTOMATED MODE system-reminder 수신 → 즉시 계획서 작성
 *  - 계획서 저장 완료 후 자동으로 sisyphus 핸드오버 발생
 *  - 스트림에서 "자동으로 개발 작업을 시작합니다" 상태 메시지 출력 확인
 *  - sisyphus가 이어서 실제 구현 작업 수행
 */

import { checkServer, chatStream, section, c, elapsed, SERVER_URL } from "../client.ts"

// ─── 개발 의뢰 샘플 프롬프트 ─────────────────────────────────────────────────

const PROMPT = `
다음 기능을 구현해 주세요.

## 개발 요청: 간단한 헬스체크 API 엔드포인트 추가

### 요구사항
현재 Express 앱에 헬스체크 엔드포인트가 없어 로드밸런서와 모니터링 시스템에서
서버 상태를 확인할 수 없습니다.

다음 스펙으로 구현해 주세요:

\`\`\`
GET /health
응답 (200 OK):
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345,
  "version": "1.0.0"
}
\`\`\`

### 세부 조건
- uptime은 process.uptime() 으로 소수점 없이 초 단위 정수
- version은 package.json 의 version 필드에서 읽어옴
- 데이터베이스 연결 확인 로직은 제외 (추후 추가 예정)
- 기존 라우터 파일(src/routes/index.js 또는 app.js)에 추가
- Jest 단위 테스트 포함

### 현재 프로젝트 구조 (참고)
\`\`\`
src/
  app.js          # Express 앱 메인
  routes/
    index.js      # 라우트 모음
  package.json
\`\`\`
`.trim()

// ─── 실행 ─────────────────────────────────────────────────────────────────────

section("🚀 개발:auto 모드 테스트")
console.log(c.gray(`  서버: ${SERVER_URL}`))
console.log(c.gray(`  모델: SOLT1 개발 AGENT`))
console.log(c.gray(`  기대: prometheus 플래닝 → 자동 sisyphus 핸드오버 → 구현 수행\n`))

const ok = await checkServer()
if (!ok) {
  console.error(c.red("  ✗ 서버에 연결할 수 없습니다."))
  console.error(c.yellow(`  → opencode serve --port 3333 을 먼저 실행하세요.\n`))
  process.exit(1)
}
console.log(c.green("  ✓ 서버 연결 확인"))

console.log(`\n  ${c.bold("프롬프트 미리보기")}`)
console.log(c.dim("  " + PROMPT.split("\n").slice(0, 4).join("\n  ") + "\n  ..."))

console.log(`\n  ${c.bold("스트리밍 시작...")}`)
console.log(c.dim("  (auto 모드는 prometheus → sisyphus 두 단계 수행이라 시간이 걸릴 수 있습니다)\n"))

const t0 = Date.now()

let autoHandoverDetected = false
let planFileDetected = false
let sisyphusWorkDetected = false
let contentLines = 0
let reasoningLines = 0
let phase: "prometheus" | "handover" | "sisyphus" = "prometheus"

const { fullContent, fullReasoning } = await chatStream(
  {
    model: "SOLT1 개발 AGENT",
    messages: [{ role: "user", content: PROMPT }],
    stream: true,
  },
  {
    onContent: (delta) => {
      // 핸드오버 메시지 감지 시 시각적으로 구분
      if (delta.includes("자동으로 개발 작업을 시작합니다")) {
        autoHandoverDetected = true
        phase = "handover"
        process.stdout.write("\n\n" + c.yellow("  ── sisyphus 핸드오버 ──") + "\n")
      }

      if (phase === "handover" && delta.trim() && !delta.includes("자동으로 개발 작업을 시작합니다")) {
        phase = "sisyphus"
      }

      if (delta.includes(".sisyphus/plans/")) {
        planFileDetected = true
      }

      // sisyphus 작업 중 코드 생성 감지
      if (phase === "sisyphus" && (delta.includes("function") || delta.includes("const ") || delta.includes("GET /health"))) {
        sisyphusWorkDetected = true
      }

      process.stdout.write(phase === "sisyphus" ? c.cyan(delta) : c.gray(delta))
      contentLines++
    },
    onReasoning: (_delta) => {
      reasoningLines++
    },
    onDone: () => {
      process.stdout.write("\n")
    },
  },
)

console.log(`\n\n  ${c.bold("─── 검증 결과")} ${elapsed(t0)}`)

// 검증 1: autoHandover 발생 확인
if (autoHandoverDetected) {
  console.log(c.green("  ✓ [PASS] sisyphus 자동 핸드오버 발생 (auto 모드 정상)"))
} else {
  console.log(c.red("  ✗ [FAIL] sisyphus 핸드오버 미발생"))
  console.log(c.yellow("    → OPENCODE_API_TYPES 에서 '개발:auto' 가 올바르게 설정됐는지 확인하세요."))
  console.log(c.yellow("    → 모델명이 'SOLT1 개발 AGENT' 형식인지 확인하세요. (OPENCODE_AGENT_TYPES 에 '개발' 포함 필요)"))
}

// 검증 2: 플랜 파일 작성 확인
if (planFileDetected) {
  console.log(c.green("  ✓ [PASS] prometheus가 .sisyphus/plans/ 에 계획서를 작성했습니다"))
} else {
  console.log(c.yellow("  △ [INFO] .sisyphus/plans/ 경로 미감지 — 출력에 경로가 포함되지 않았거나 다른 경로 사용 가능"))
}

// 검증 3: sisyphus 작업 수행 확인
if (sisyphusWorkDetected) {
  console.log(c.green("  ✓ [PASS] sisyphus가 실제 구현 작업을 수행했습니다"))
} else if (autoHandoverDetected) {
  console.log(c.yellow("  △ [INFO] 핸드오버는 발생했으나 코드 생성 미감지 (정상일 수 있음)"))
}

// 검증 4: 응답 있음 확인
if (fullContent.length > 0) {
  console.log(c.green(`  ✓ [PASS] 응답 수신 (${fullContent.length}자, reasoning ${reasoningLines}회 델타)`))
} else {
  console.log(c.red("  ✗ [FAIL] 응답 내용 없음"))
}

console.log()

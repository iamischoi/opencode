/**
 * 시나리오: 의뢰:manual 모드 테스트
 *
 * OPENCODE_API_TYPES=의뢰:manual 설정 하에서
 * "SOLT1 의뢰" 모델로 실제 업무 의뢰서 형태의 프롬프트를 전송합니다.
 *
 * 기대 동작:
 *  - agentName = "prometheus" (플래닝 에이전트)
 *  - autoHandover = false  → prometheus 턴만 완료되고 sisyphus로 넘어가지 않음
 *  - prometheus가 .sisyphus/plans/*.md 파일에 작업 계획서를 작성하고 종료
 *  - 스트림에서 sisyphus 핸드오버 상태 메시지("자동으로 개발 작업을 시작합니다") 미출력 확인
 */

import { checkServer, chatStream, section, c, elapsed, SERVER_URL } from "../client.ts"

// ─── 의뢰서 샘플 프롬프트 ────────────────────────────────────────────────────

const PROMPT = `
안녕하세요. 다음 기능 개발을 의뢰드립니다.

## 의뢰 내용: 사용자 알림 기능 추가

### 배경
현재 시스템에는 중요 이벤트(에러, 배포 완료, 승인 요청 등) 발생 시 담당자에게
실시간으로 알려주는 기능이 없습니다.

### 요구사항
1. **이메일 알림**: 에러 발생 시 담당자 이메일로 알림 발송
2. **슬랙 알림**: 배포 완료 및 승인 요청 시 지정 채널에 메시지 전송  
3. **알림 설정 관리**: 사용자별 알림 수신 여부 및 채널 설정 가능
4. **알림 이력**: 발송된 알림의 이력 조회 기능

### 기술 스택
- Backend: Node.js (Express)
- Database: PostgreSQL
- 이메일: SendGrid API
- 슬랙: Slack Webhook

### 참고 사항
- 기존 인증 시스템(JWT)과 통합 필요
- 알림 발송 실패 시 재시도 로직 포함
- 단위 테스트 커버리지 80% 이상 유지

위 요구사항을 검토하여 작업 계획서를 작성해 주세요.
`.trim()

// ─── 실행 ─────────────────────────────────────────────────────────────────────

section("📝 의뢰:manual 모드 테스트")
console.log(c.gray(`  서버: ${SERVER_URL}`))
console.log(c.gray(`  모델: SOLT1 의뢰`))
console.log(c.gray(`  기대: prometheus 플래닝 후 종료 (sisyphus 핸드오버 없음)\n`))

const ok = await checkServer()
if (!ok) {
  console.error(c.red("  ✗ 서버에 연결할 수 없습니다."))
  console.error(c.yellow(`  → opencode serve --port 3333 을 먼저 실행하세요.\n`))
  process.exit(1)
}
console.log(c.green("  ✓ 서버 연결 확인"))

console.log(`\n  ${c.bold("프롬프트 미리보기")}`)
console.log(c.dim("  " + PROMPT.split("\n").slice(0, 4).join("\n  ") + "\n  ..."))

console.log(`\n  ${c.bold("스트리밍 시작...")} `)

const t0 = Date.now()

let autoHandoverDetected = false
let planFileDetected = false
let contentLines = 0
let reasoningLines = 0

const { fullContent, fullReasoning } = await chatStream(
  {
    model: "SOLT1 의뢰GENT",
    messages: [{ role: "user", content: PROMPT }],
    stream: true,
  },
  {
    onContent: (delta) => {
      process.stdout.write(c.gray(delta))
      contentLines++
      if (delta.includes("자동으로 개발 작업을 시작합니다")) {
        autoHandoverDetected = true
      }
      if (delta.includes(".sisyphus/plans/")) {
        planFileDetected = true
      }
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

// 검증 1: autoHandover 비활성 확인
if (!autoHandoverDetected) {
  console.log(c.green("  ✓ [PASS] sisyphus 자동 핸드오버 없음 (manual 모드 정상)"))
} else {
  console.log(c.red("  ✗ [FAIL] 예상치 못한 sisyphus 핸드오버 발생 — autoHandover가 true로 설정됐을 수 있음"))
  console.log(c.yellow("    → OPENCODE_API_TYPES 에서 '의뢰:manual' 이 올바르게 설정됐는지 확인하세요."))
}

// 검증 2: 플랜 파일 작성 확인
if (planFileDetected) {
  console.log(c.green("  ✓ [PASS] .sisyphus/plans/ 경로 언급 감지 — prometheus가 계획서를 작성한 것으로 보임"))
} else {
  console.log(c.yellow("  △ [INFO] .sisyphus/plans/ 경로 미감지 — prometheus가 아직 계획서를 작성하지 않았거나 다른 경로를 사용했을 수 있음"))
}

// 검증 3: 응답 있음 확인
if (fullContent.length > 0) {
  console.log(c.green(`  ✓ [PASS] 응답 수신 (${fullContent.length}자, reasoning ${reasoningLines}회 델타)`))
} else {
  console.log(c.red("  ✗ [FAIL] 응답 내용 없음"))
}

console.log()

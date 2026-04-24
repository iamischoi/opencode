/**
 * run-all.ts — 전체 시나리오 순차 실행
 *
 * bun run test 로 실행하면 아래 순서로 모든 시나리오를 실행합니다:
 *  1. 모델 목록 조회
 *  2. 의뢰:manual 모드 테스트
 *  3. 개발:auto 모드 테스트
 */

import { checkServer, section, c, SERVER_URL } from "./client.ts"

console.log(c.bold("\n  opencode API 통합 테스트"))
console.log(c.gray(`  서버: ${SERVER_URL}`))
console.log(c.gray(`  실행 시각: ${new Date().toLocaleString("ko-KR")}\n`))

const ok = await checkServer()
if (!ok) {
  console.error(c.red("  ✗ 서버에 연결할 수 없습니다."))
  console.error(c.yellow(`  → opencode serve --port 3333 을 먼저 실행하고 다시 시도하세요.\n`))
  process.exit(1)
}

// 1. 모델 목록
await import("./scenarios/list-models.ts")

// 2. manual 모드
await import("./scenarios/manual-mode.ts")

// 3. auto 모드
await import("./scenarios/auto-mode.ts")

section("✅ 전체 시나리오 완료")
console.log()

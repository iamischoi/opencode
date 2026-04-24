/**
 * 시나리오: 모델 목록 조회
 *
 * GET /v1/models 로 서버가 노출하는 에이전트 모델 목록을 확인합니다.
 * OPENCODE_APP_CONFIG / OPENCODE_AGENT_TYPES 설정이 올바르게 반영됐는지 검증합니다.
 */

import { API_BASE, SERVER_URL, checkServer, listModels, section, c, elapsed } from "../client.ts"

section("📋 모델 목록 조회")
console.log(c.gray(`  서버: ${SERVER_URL}`))

const ok = await checkServer()
if (!ok) {
  console.error(c.red("\n  ✗ 서버에 연결할 수 없습니다."))
  console.error(c.yellow(`  → opencode serve --port 3333 을 먼저 실행하세요.\n`))
  process.exit(1)
}
console.log(c.green("  ✓ 서버 연결 확인\n"))

const t0 = Date.now()
const { data: models } = await listModels()
console.log(`  ${c.bold("등록된 모델")} ${elapsed(t0)}`)

for (const m of models) {
  console.log(`    • ${c.cyan(m.id)}`)
}

console.log(`\n  총 ${c.bold(String(models.length))}개의 모델\n`)

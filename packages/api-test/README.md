# @opencode/api-test

opencode API 서버의 `의뢰:manual` / `개발:auto` 모드를 실제 HTTP 요청으로 검증하는 독립 테스트 패키지입니다.

> **이 패키지는 삭제 가능합니다.**
> `packages/opencode` 코드에 의존성이 없으며 `package.json` 의 `workspaces` 에도 등록하지 않아도 됩니다.
> 삭제: `rm -rf packages/api-test`

---

## 필수 조건

- [Bun](https://bun.sh) 설치
- opencode 서버 실행 중 (`opencode serve --port 3333`)

---

## 서버 실행 방법

```bash
# packages/opencode 디렉토리에서
cd packages/opencode
bun run dev serve --port 3333

# 또는 빌드된 바이너리가 있다면
opencode serve --port 3333
```

`opencode-server.properties` 에 다음 설정이 있어야 모드가 올바르게 동작합니다:

```properties
OPENCODE_API_TYPES=의뢰:manual,검토:manual,검증:manual,개발:auto,default:manual
OPENCODE_APP_CONFIG=SOLT1:S01,SOLT2:S02
OPENCODE_AGENT_TYPES=의뢰,검토,개발,검증
```

---

## 테스트 실행

```bash
cd packages/api-test

# 전체 시나리오 실행
bun run test

# 개별 실행
bun run test:models    # 모델 목록 확인
bun run test:manual    # 의뢰:manual 모드 단독 실행
bun run test:auto      # 개발:auto 모드 단독 실행
```

### 다른 포트/서버 URL 사용

```bash
OPENCODE_TEST_URL=http://127.0.0.1:4000 bun run test
```

---

## 시나리오 설명

### `test:models` — 모델 목록 조회

`GET /v1/models` 를 호출하여 `OPENCODE_APP_CONFIG` + `OPENCODE_AGENT_TYPES` 조합으로
생성된 모델 목록이 올바르게 반환되는지 확인합니다.

예상 출력 예시:
```
• SOLT1 의뢰
• SOLT1 개발
• SOLT2 의뢰
• SOLT2 개발
```

---

### `test:manual` — 의뢰:manual 모드

**모델:** `SOLT1 의뢰`
**프롬프트:** 사용자 알림 기능 추가 의뢰서 (이메일/슬랙 알림, 이력 조회)

| 검증 항목 | 기대값 |
|---|---|
| sisyphus 자동 핸드오버 | **없어야 함** |
| prometheus 응답 수신 | 계획서 내용 |
| .sisyphus/plans/ 경로 언급 | 있으면 PASS, 없어도 INFO |

---

### `test:auto` — 개발:auto 모드

**모델:** `SOLT1 개발`
**프롬프트:** Express 헬스체크 API 엔드포인트 구현 요청

| 검증 항목 | 기대값 |
|---|---|
| sisyphus 자동 핸드오버 | **있어야 함** (`🚀 자동으로 개발 작업을 시작합니다...` 메시지) |
| prometheus 계획서 작성 | .sisyphus/plans/ 파일 생성 |
| sisyphus 구현 작업 | 코드 생성 또는 파일 수정 |

---

## 삭제 방법

```bash
# 프로젝트 루트에서
rm -rf packages/api-test
```

다른 패키지에 의존성이 없으므로 그냥 삭제해도 됩니다.

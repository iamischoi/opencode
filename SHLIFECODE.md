# shlifecode - opencode 폐쇄망 커스터마이징 가이드

> opencode를 폐쇄망(air-gapped) 환경에서 "shlifecode"로 리브랜딩하여 운용하기 위한 전체 변경사항 및 운영 가이드.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [변경 원칙](#2-변경-원칙)
3. [완료된 작업](#3-완료된-작업)
   - [3.1 외부 접근 On/Off 게이트](#31-외부-접근-onoff-게이트)
   - [3.2 컨테이너 외부 인자 주입](#32-컨테이너-외부-인자-주입)
   - [3.3 API 모델 선택 헤더](#33-api-모델-선택-헤더)
   - [3.4 HTTP 헤더 리네임](#34-http-헤더-리네임)
   - [3.5 config 파일/디렉토리 리네임](#35-config-파일디렉토리-리네임)
4. [전체 API 목록 (serve 모드)](#4-전체-api-목록-serve-모드)
5. [OpenAPI 스펙 추출](#5-openapi-스펙-추출)
6. [serve 모드 운영 가이드](#6-serve-모드-운영-가이드)
7. [변경 파일 목록](#7-변경-파일-목록)
8. [선택적 추가 작업](#8-선택적-추가-작업)

---

## 1. 프로젝트 개요

**목표**: 폐쇄망 환경에서 opencode를 "shlifecode"로 리브랜딩하여 배포. 외부 접근 On/Off, 컨테이너 인자 주입, vLLM 모델 헤더 지원, API 명세 확보까지 완료하여 서버(API) + Web 모두 운용 가능한 상태로 만드는 것.

**배경**: vLLM에 오픈소스 모델을 올려놓고 사용하는 폐쇄망 환경에서 TUI / Web / API 세 가지 인터페이스를 동일하게 지원.

---

## 2. 변경 원칙

| 항목                        | 원칙                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| 패키지명 (`@opencode-ai/*`) | **변경하지 않음** — npm scope, import path 유지                  |
| 환경변수 (`OPENCODE_*`)     | **변경하지 않음** — 기존 env 변수명 유지                         |
| HTTP 헤더 (`x-opencode-*`)  | `x-shlifecode-*`로 **전부 변경**                                 |
| config 파일/디렉토리        | `.opencode` → `.shlifecode`, `opencode.json` → `shlifecode.json` |
| backward-compat             | 기존 `.opencode`/`opencode.json`도 읽기 가능                     |
| migration helper            | `.opencode` → `.shlifecode` 자동 이전                            |
| 외부 접근 제어              | 코드 삭제가 아닌 **On/Off 방식** (주석 처리 수준)                |
| 외부 접근 차단              | `OPENCODE_DISABLE_EXTERNAL_ACCESS=true` 하나로 전체 차단         |

---

## 3. 완료된 작업

### 3.1 외부 접근 On/Off 게이트

`OPENCODE_DISABLE_EXTERNAL_ACCESS=true` 환경변수로 외부 네트워크 호출을 일괄 차단.

**차단 대상 (도구):**

| 파일                                       | 차단 대상               |
| ------------------------------------------ | ----------------------- |
| `packages/opencode/src/tool/webfetch.ts`   | 웹 페이지 fetch         |
| `packages/opencode/src/tool/websearch.ts`  | 웹 검색                 |
| `packages/opencode/src/tool/codesearch.ts` | 코드 검색 (grep.app 등) |
| `packages/opencode/src/tool/mcp-exa.ts`    | Exa MCP 검색            |

**차단 대상 (서비스):**

| 파일                                        | 차단 대상                  |
| ------------------------------------------- | -------------------------- |
| `packages/opencode/src/npm/index.ts`        | npm registry 접근          |
| `packages/opencode/src/share/share-next.ts` | 세션 공유 업로드           |
| `packages/opencode/src/provider/models.ts`  | models.dev 모델 목록 fetch |

**차단 대상 (console):**

| 파일                                                  | 차단 대상          |
| ----------------------------------------------------- | ------------------ |
| `packages/console/core/src/billing.ts`                | Stripe 결제        |
| `packages/console/core/src/aws.ts`                    | AWS SES 이메일     |
| `packages/console/app/src/routes/stripe/webhook.ts`   | Stripe webhook     |
| `packages/console/app/src/routes/discord.ts`          | Discord 리다이렉트 |
| `packages/console/app/src/routes/feishu.ts`           | Feishu 리다이렉트  |
| `packages/console/app/src/routes/desktop-feedback.ts` | 피드백 전송        |
| `packages/console/app/src/lib/github.ts`              | GitHub API         |
| `packages/console/function/src/auth.ts`               | OAuth auth worker  |
| `packages/console/function/src/log-processor.ts`      | 로그 프로세서      |

**플래그 위치:**

- `packages/opencode/src/flag/flag.ts` — `OPENCODE_DISABLE_EXTERNAL_ACCESS` 정의
- `packages/console/core/src/flag.ts` — console-core 전용 `external` 플래그

---

### 3.2 컨테이너 외부 인자 주입

`docker-entrypoint.sh`와 `docker-compose.yml`에서 다음 환경변수를 지원:

```bash
# docker-compose.yml 또는 docker run -e 로 주입
OPENCODE_PORT=3000           # 서버 포트
OPENCODE_HOSTNAME=0.0.0.0    # 바인드 주소
OPENCODE_ARGS="--flag value" # 추가 CLI 인자
```

**사용 예시:**

```bash
docker run -e OPENCODE_PORT=8080 \
           -e OPENCODE_HOSTNAME=0.0.0.0 \
           -e OPENCODE_DISABLE_EXTERNAL_ACCESS=true \
           -e OPENCODE_SERVER_PASSWORD=mysecret \
           shlifecode:latest
```

---

### 3.3 API 모델 선택 헤더

vLLM 등 OpenAI-compatible 백엔드 사용을 위해 `x-shlifecode-model` 헤더로 모델을 동적 선택.

**동작 방식:**

1. 클라이언트가 `x-shlifecode-model: vllm/my-model` 헤더 전송
2. 서버 session endpoint에서 헤더 파싱 → `PromptInput.model`에 주입
3. body의 `model` 필드가 있으면 body 우선, 없으면 헤더 사용

**적용 endpoint:**

- `POST /session/:id/message` (prompt)
- `POST /session/:id/prompt_async`
- `POST /session/:id/command`
- `POST /session/:id/shell`

**SDK 자동 전파:**

- `OPENCODE_MODEL` 환경변수 설정 시 SDK client (v1/v2)가 자동으로 헤더에 포함
- Zen/OpenAI-compatible API에서도 동일 헤더 지원

**관련 파일:**

- `packages/opencode/src/server/instance/session.ts` — `modelHeader()`, `parsedModel()`
- `packages/opencode/src/flag/flag.ts` — `OPENCODE_MODEL` 플래그
- `packages/sdk/js/src/client.ts` — v1 SDK 헤더 전파
- `packages/sdk/js/src/v2/client.ts` — v2 SDK 헤더 전파

---

### 3.4 HTTP 헤더 리네임

`x-opencode-*` → `x-shlifecode-*` 전체 변경. 코드베이스에 `x-opencode-` 잔존 없음 확인 완료.

**변경된 헤더 목록:**

| Before                 | After                    | 용도              |
| ---------------------- | ------------------------ | ----------------- |
| `x-opencode-model`     | `x-shlifecode-model`     | 모델 선택         |
| `x-opencode-directory` | `x-shlifecode-directory` | 프로젝트 디렉토리 |
| `x-opencode-workspace` | `x-shlifecode-workspace` | 워크스페이스      |
| `x-opencode-project`   | `x-shlifecode-project`   | 프로젝트 ID       |
| `x-opencode-session`   | `x-shlifecode-session`   | 세션 ID           |
| `x-opencode-request`   | `x-shlifecode-request`   | 요청 ID           |
| `x-opencode-client`    | `x-shlifecode-client`    | 클라이언트 식별   |
| `x-opencode-proxy-url` | `x-shlifecode-proxy-url` | 프록시 URL        |
| `x-opencode-locale`    | `x-shlifecode-locale`    | 로케일            |

---

### 3.5 config 파일/디렉토리 리네임

**소스 코드 변경:**

| Before                | After              |
| --------------------- | ------------------ |
| `.opencode/` 디렉토리 | `.shlifecode/`     |
| `opencode.json`       | `shlifecode.json`  |
| `opencode.jsonc`      | `shlifecode.jsonc` |

**backward-compat:** 기존 `.opencode`/`opencode.json`도 읽기 지원 — 새 이름을 먼저 탐색하고 없으면 기존 이름으로 fallback.

**migration helper:** 최초 실행 시 자동으로:

- `opencode.json` → `shlifecode.json` 이전
- `.opencode/` → `.shlifecode/` 이전

---

## 4. 전체 API 목록 (serve 모드)

`opencode serve`로 기동 시 사용 가능한 전체 endpoint (~95개).

### 4.1 Control Plane

#### Global (`/global/*`)

| Method  | Path                 | operationId                   | 설명                      |
| ------- | -------------------- | ----------------------------- | ------------------------- |
| `GET`   | `/global/health`     | `global.health`               | 서버 헬스체크 (버전 포함) |
| `GET`   | `/global/event`      | `global.event`                | 글로벌 이벤트 SSE 스트림  |
| `GET`   | `/global/sync-event` | `global.sync-event.subscribe` | 동기화 이벤트 SSE 스트림  |
| `GET`   | `/global/config`     | `global.config.get`           | 글로벌 설정 조회          |
| `PATCH` | `/global/config`     | `global.config.update`        | 글로벌 설정 수정          |
| `POST`  | `/global/dispose`    | `global.dispose`              | 전체 인스턴스 해제        |
| `POST`  | `/global/upgrade`    | `global.upgrade`              | 버전 업그레이드           |

#### Auth (`/auth/*`)

| Method   | Path                | operationId   | 설명           |
| -------- | ------------------- | ------------- | -------------- |
| `PUT`    | `/auth/:providerID` | `auth.set`    | 인증 정보 설정 |
| `DELETE` | `/auth/:providerID` | `auth.remove` | 인증 정보 삭제 |

#### Misc

| Method | Path   | operationId | 설명                            |
| ------ | ------ | ----------- | ------------------------------- |
| `GET`  | `/doc` | —           | OpenAPI 스펙 (JSON) 라이브 제공 |
| `POST` | `/log` | `app.log`   | 서버 로그 기록                  |

### 4.2 Session (`/session/*`)

| Method   | Path                     | operationId         | 설명                             |
| -------- | ------------------------ | ------------------- | -------------------------------- |
| `GET`    | `/session/`              | `session.list`      | 세션 목록 조회                   |
| `GET`    | `/session/status`        | `session.status`    | 전체 세션 상태                   |
| `POST`   | `/session/`              | `session.create`    | 세션 생성                        |
| `GET`    | `/session/:id`           | `session.get`       | 세션 상세 조회                   |
| `PATCH`  | `/session/:id`           | `session.update`    | 세션 수정 (제목, 권한, 아카이브) |
| `DELETE` | `/session/:id`           | `session.delete`    | 세션 삭제                        |
| `GET`    | `/session/:id/children`  | `session.children`  | 하위 세션 조회                   |
| `GET`    | `/session/:id/todo`      | `session.todo`      | 세션 할일 목록                   |
| `GET`    | `/session/:id/diff`      | `session.diff`      | 메시지별 파일 변경분             |
| `POST`   | `/session/:id/init`      | `session.init`      | AGENTS.md 초기화                 |
| `POST`   | `/session/:id/fork`      | `session.fork`      | 세션 포크                        |
| `POST`   | `/session/:id/abort`     | `session.abort`     | 세션 중단                        |
| `POST`   | `/session/:id/share`     | `session.share`     | 세션 공유링크 생성               |
| `DELETE` | `/session/:id/share`     | `session.unshare`   | 공유링크 해제                    |
| `POST`   | `/session/:id/summarize` | `session.summarize` | AI 요약 생성                     |
| `POST`   | `/session/:id/revert`    | `session.revert`    | 메시지 되돌리기                  |
| `POST`   | `/session/:id/unrevert`  | `session.unrevert`  | 되돌리기 복원                    |

#### Messages

| Method   | Path                                       | operationId             | 설명                       |
| -------- | ------------------------------------------ | ----------------------- | -------------------------- |
| `GET`    | `/session/:id/message`                     | `session.messages`      | 메시지 목록 (페이지네이션) |
| `GET`    | `/session/:id/message/:msgID`              | `session.message`       | 단일 메시지 조회           |
| `DELETE` | `/session/:id/message/:msgID`              | `session.deleteMessage` | 메시지 삭제                |
| `DELETE` | `/session/:id/message/:msgID/part/:partID` | `part.delete`           | 파트 삭제                  |
| `PATCH`  | `/session/:id/message/:msgID/part/:partID` | `part.update`           | 파트 수정                  |

#### Prompt / Command

| Method | Path                               | operationId            | 설명                                         |
| ------ | ---------------------------------- | ---------------------- | -------------------------------------------- |
| `POST` | `/session/:id/message`             | `session.prompt`       | 메시지 전송 — `x-shlifecode-model` 헤더 지원 |
| `POST` | `/session/:id/prompt_async`        | `session.prompt_async` | 비동기 메시지 전송                           |
| `POST` | `/session/:id/command`             | `session.command`      | 명령어 전송                                  |
| `POST` | `/session/:id/shell`               | `session.shell`        | 셸 명령 실행                                 |
| `POST` | `/session/:id/permissions/:permID` | `permission.respond`   | 권한 응답 (deprecated)                       |

### 4.3 Provider (`/provider/*`)

| Method | Path                            | operationId                | 설명                        |
| ------ | ------------------------------- | -------------------------- | --------------------------- |
| `GET`  | `/provider/`                    | `provider.list`            | 프로바이더 목록 (모델 포함) |
| `GET`  | `/provider/auth`                | `provider.auth`            | 인증 방법 조회              |
| `POST` | `/provider/:id/oauth/authorize` | `provider.oauth.authorize` | OAuth 인가 시작             |
| `POST` | `/provider/:id/oauth/callback`  | `provider.oauth.callback`  | OAuth 콜백 처리             |

### 4.4 Permission & Question

#### Permission (`/permission/*`)

| Method | Path                    | operationId        | 설명                   |
| ------ | ----------------------- | ------------------ | ---------------------- |
| `GET`  | `/permission/`          | `permission.list`  | 대기 중 권한 요청 목록 |
| `POST` | `/permission/:id/reply` | `permission.reply` | 권한 요청 응답         |

#### Question (`/question/*`)

| Method | Path                   | operationId       | 설명              |
| ------ | ---------------------- | ----------------- | ----------------- |
| `GET`  | `/question/`           | `question.list`   | 대기 중 질문 목록 |
| `POST` | `/question/:id/reply`  | `question.reply`  | 질문 응답         |
| `POST` | `/question/:id/reject` | `question.reject` | 질문 거부         |

### 4.5 Project (`/project/*`)

| Method  | Path                | operationId       | 설명              |
| ------- | ------------------- | ----------------- | ----------------- |
| `GET`   | `/project/`         | `project.list`    | 프로젝트 목록     |
| `GET`   | `/project/current`  | `project.current` | 현재 프로젝트     |
| `POST`  | `/project/git/init` | `project.initGit` | Git 저장소 초기화 |
| `PATCH` | `/project/:id`      | `project.update`  | 프로젝트 수정     |

### 4.6 Config (`/config/*`)

| Method  | Path                | operationId        | 설명                   |
| ------- | ------------------- | ------------------ | ---------------------- |
| `GET`   | `/config/`          | `config.get`       | 설정 조회              |
| `PATCH` | `/config/`          | `config.update`    | 설정 수정              |
| `GET`   | `/config/providers` | `config.providers` | 설정된 프로바이더 목록 |

### 4.7 MCP (`/mcp/*`)

| Method   | Path                           | operationId             | 설명                      |
| -------- | ------------------------------ | ----------------------- | ------------------------- |
| `GET`    | `/mcp/`                        | `mcp.status`            | MCP 서버 상태             |
| `POST`   | `/mcp/`                        | `mcp.add`               | MCP 서버 추가             |
| `POST`   | `/mcp/:name/auth`              | `mcp.auth.start`        | MCP OAuth 시작            |
| `POST`   | `/mcp/:name/auth/callback`     | `mcp.auth.callback`     | MCP OAuth 콜백            |
| `POST`   | `/mcp/:name/auth/authenticate` | `mcp.auth.authenticate` | MCP OAuth 인증 (브라우저) |
| `DELETE` | `/mcp/:name/auth`              | `mcp.auth.remove`       | MCP OAuth 삭제            |
| `POST`   | `/mcp/:name/connect`           | `mcp.connect`           | MCP 서버 연결             |
| `POST`   | `/mcp/:name/disconnect`        | `mcp.disconnect`        | MCP 서버 해제             |

### 4.8 PTY (`/pty/*`)

| Method   | Path               | operationId   | 설명               |
| -------- | ------------------ | ------------- | ------------------ |
| `GET`    | `/pty/`            | `pty.list`    | PTY 세션 목록      |
| `POST`   | `/pty/`            | `pty.create`  | PTY 세션 생성      |
| `GET`    | `/pty/:id`         | `pty.get`     | PTY 세션 조회      |
| `PUT`    | `/pty/:id`         | `pty.update`  | PTY 세션 수정      |
| `DELETE` | `/pty/:id`         | `pty.remove`  | PTY 세션 삭제      |
| `GET`    | `/pty/:id/connect` | `pty.connect` | PTY WebSocket 연결 |

### 4.9 File & Search

| Method | Path            | operationId    | 설명                  |
| ------ | --------------- | -------------- | --------------------- |
| `GET`  | `/find`         | `find.text`    | 텍스트 검색 (ripgrep) |
| `GET`  | `/find/file`    | `find.files`   | 파일 검색             |
| `GET`  | `/find/symbol`  | `find.symbols` | 심볼 검색 (LSP)       |
| `GET`  | `/file`         | `file.list`    | 파일/디렉토리 목록    |
| `GET`  | `/file/content` | `file.read`    | 파일 내용 읽기        |
| `GET`  | `/file/status`  | `file.status`  | Git 파일 상태         |

### 4.10 Event & Instance

| Method | Path                | operationId        | 설명                       |
| ------ | ------------------- | ------------------ | -------------------------- |
| `GET`  | `/event`            | `event.subscribe`  | 인스턴스 이벤트 SSE 스트림 |
| `POST` | `/instance/dispose` | `instance.dispose` | 인스턴스 해제              |
| `GET`  | `/path`             | `path.get`         | 경로 정보                  |
| `GET`  | `/vcs`              | `vcs.get`          | VCS(Git) 정보              |
| `GET`  | `/vcs/diff`         | `vcs.diff`         | Git diff                   |
| `GET`  | `/command`          | `command.list`     | 명령어 목록                |
| `GET`  | `/agent`            | `app.agents`       | 에이전트 목록              |
| `GET`  | `/skill`            | `app.skills`       | 스킬 목록                  |
| `GET`  | `/lsp`              | `lsp.status`       | LSP 상태                   |
| `GET`  | `/formatter`        | `formatter.status` | 포매터 상태                |

### 4.11 Experimental (`/experimental/*`)

| Method   | Path                             | operationId                      | 설명                    |
| -------- | -------------------------------- | -------------------------------- | ----------------------- |
| `GET`    | `/experimental/console`          | `experimental.console.get`       | Console 메타데이터      |
| `GET`    | `/experimental/console/orgs`     | `experimental.console.listOrgs`  | Console 조직 목록       |
| `POST`   | `/experimental/console/switch`   | `experimental.console.switchOrg` | Console 조직 전환       |
| `GET`    | `/experimental/tool/ids`         | `tool.ids`                       | 도구 ID 목록            |
| `GET`    | `/experimental/tool`             | `tool.list`                      | 도구 목록 (스키마 포함) |
| `GET`    | `/experimental/session`          | `experimental.session.list`      | 글로벌 세션 목록        |
| `GET`    | `/experimental/resource`         | `experimental.resource.list`     | MCP 리소스 목록         |
| `POST`   | `/experimental/workspace/`       | `experimental.workspace.create`  | 워크스페이스 생성       |
| `GET`    | `/experimental/workspace/`       | `experimental.workspace.list`    | 워크스페이스 목록       |
| `GET`    | `/experimental/workspace/status` | `experimental.workspace.status`  | 워크스페이스 상태       |
| `DELETE` | `/experimental/workspace/:id`    | `experimental.workspace.remove`  | 워크스페이스 삭제       |
| `POST`   | `/experimental/worktree`         | `worktree.create`                | 워크트리 생성           |
| `GET`    | `/experimental/worktree`         | `worktree.list`                  | 워크트리 목록           |
| `DELETE` | `/experimental/worktree`         | `worktree.remove`                | 워크트리 삭제           |
| `POST`   | `/experimental/worktree/reset`   | `worktree.reset`                 | 워크트리 리셋           |

### 4.12 TUI Control (`/tui/*`)

| Method | Path                    | operationId            | 설명                 |
| ------ | ----------------------- | ---------------------- | -------------------- |
| `POST` | `/tui/append-prompt`    | `tui.appendPrompt`     | TUI 프롬프트 추가    |
| `POST` | `/tui/open-help`        | `tui.openHelp`         | 도움말 열기          |
| `POST` | `/tui/open-sessions`    | `tui.openSessions`     | 세션 다이얼로그 열기 |
| `POST` | `/tui/open-themes`      | `tui.openThemes`       | 테마 다이얼로그 열기 |
| `POST` | `/tui/open-models`      | `tui.openModels`       | 모델 다이얼로그 열기 |
| `POST` | `/tui/submit-prompt`    | `tui.submitPrompt`     | 프롬프트 제출        |
| `POST` | `/tui/clear-prompt`     | `tui.clearPrompt`      | 프롬프트 클리어      |
| `POST` | `/tui/execute-command`  | `tui.executeCommand`   | TUI 명령 실행        |
| `POST` | `/tui/show-toast`       | `tui.showToast`        | 토스트 알림          |
| `POST` | `/tui/publish`          | `tui.publish`          | TUI 이벤트 발행      |
| `POST` | `/tui/select-session`   | `tui.selectSession`    | 세션 선택            |
| `GET`  | `/tui/control/next`     | `tui.control.next`     | TUI 요청 큐 소비     |
| `POST` | `/tui/control/response` | `tui.control.response` | TUI 응답 제출        |

### 4.13 Web UI

| Method | Path | 설명                                                          |
| ------ | ---- | ------------------------------------------------------------- |
| `ALL`  | `/*` | 임베디드 Web UI 제공 또는 `app.opencode.ai` 프록시 (fallback) |

---

## 5. OpenAPI 스펙 추출

### 방법 A: 라이브 엔드포인트 (서버 가동 중)

```bash
# serve 모드 기동
OPENCODE_SERVER_PASSWORD=mypassword opencode serve --port 3000

# OpenAPI 스펙 다운로드
curl -H "Authorization: Bearer mypassword" http://localhost:3000/doc > openapi.json
```

### 방법 B: CLI generate 명령 (서버 불필요)

```bash
# stdout으로 OpenAPI JSON 출력
opencode generate > openapi.json
```

이 명령은 `Server.openapi()`를 호출하여 `hono-openapi`의 `generateSpecs`로 OpenAPI 3.1.1 스펙을 동적 생성합니다.

**소스 위치:**

- `packages/opencode/src/server/server.ts` — `Server.openapi()` 함수
- `packages/opencode/src/cli/cmd/generate.ts` — `opencode generate` CLI 명령

---

## 6. serve 모드 운영 가이드

### 6.1 서버 기동

```bash
# 기본 기동
OPENCODE_SERVER_PASSWORD=secret opencode serve --port 3000 --hostname 0.0.0.0

# 폐쇄망 모드 (외부 접근 차단)
OPENCODE_DISABLE_EXTERNAL_ACCESS=true \
OPENCODE_SERVER_PASSWORD=secret \
opencode serve --port 3000 --hostname 0.0.0.0

# Docker 기동
docker run -e OPENCODE_PORT=3000 \
           -e OPENCODE_HOSTNAME=0.0.0.0 \
           -e OPENCODE_DISABLE_EXTERNAL_ACCESS=true \
           -e OPENCODE_SERVER_PASSWORD=secret \
           shlifecode:latest
```

### 6.2 헬스체크

```bash
curl -H "Authorization: Bearer secret" http://localhost:3000/global/health
# → {"healthy":true,"version":"..."}
```

### 6.3 프로바이더 목록 확인

```bash
curl -H "Authorization: Bearer secret" \
     -H "x-shlifecode-directory: /your/project" \
     http://localhost:3000/provider/
```

### 6.4 세션 생성 + 메시지 전송 (vLLM 모델 지정)

```bash
# 1. 세션 생성
curl -X POST -H "Authorization: Bearer secret" \
     -H "x-shlifecode-directory: /your/project" \
     -H "Content-Type: application/json" \
     -d '{}' http://localhost:3000/session/

# 2. 메시지 전송 (vLLM 모델 헤더로 지정)
curl -X POST -H "Authorization: Bearer secret" \
     -H "x-shlifecode-directory: /your/project" \
     -H "x-shlifecode-model: vllm/my-model" \
     -H "Content-Type: application/json" \
     -d '{"parts":[{"type":"text","text":"Hello"}]}' \
     http://localhost:3000/session/{sessionID}/message
```

### 6.5 이벤트 스트림 구독 (SSE)

```bash
curl -N -H "Authorization: Bearer secret" \
     -H "x-shlifecode-directory: /your/project" \
     http://localhost:3000/event
```

### 6.6 필수 헤더 정리

| 헤더                                   | 필수 여부         | 용도                                        |
| -------------------------------------- | ----------------- | ------------------------------------------- |
| `Authorization: Bearer {password}`     | 필수              | 서버 인증 (`OPENCODE_SERVER_PASSWORD`)      |
| `x-shlifecode-directory: {path}`       | 인스턴스 API 필수 | 프로젝트 디렉토리 지정                      |
| `x-shlifecode-model: {provider/model}` | 선택              | 모델 동적 선택 (body `model` 필드로도 가능) |
| `x-shlifecode-workspace: {id}`         | 선택              | 워크스페이스 지정                           |

---

## 7. 변경 파일 목록

### 7.1 플래그 / 외부 접근 제어

| 파일                                 | 변경 내용                                                 |
| ------------------------------------ | --------------------------------------------------------- |
| `packages/opencode/src/flag/flag.ts` | `OPENCODE_DISABLE_EXTERNAL_ACCESS`, `OPENCODE_MODEL` 추가 |
| `packages/console/core/src/flag.ts`  | 신규 생성 (console-core `external` 플래그)                |
| `packages/console/core/package.json` | `./flag` export 추가                                      |

### 7.2 도구 가드 (외부 접근 차단)

| 파일                                        |
| ------------------------------------------- |
| `packages/opencode/src/tool/webfetch.ts`    |
| `packages/opencode/src/tool/websearch.ts`   |
| `packages/opencode/src/tool/codesearch.ts`  |
| `packages/opencode/src/tool/mcp-exa.ts`     |
| `packages/opencode/src/npm/index.ts`        |
| `packages/opencode/src/share/share-next.ts` |
| `packages/opencode/src/provider/models.ts`  |

### 7.3 Console 가드

| 파일                                                  |
| ----------------------------------------------------- |
| `packages/console/core/src/billing.ts`                |
| `packages/console/core/src/aws.ts`                    |
| `packages/console/app/src/routes/stripe/webhook.ts`   |
| `packages/console/app/src/routes/discord.ts`          |
| `packages/console/app/src/routes/feishu.ts`           |
| `packages/console/app/src/routes/desktop-feedback.ts` |
| `packages/console/app/src/lib/github.ts`              |
| `packages/console/function/src/auth.ts`               |
| `packages/console/function/src/log-processor.ts`      |

### 7.4 컨테이너

| 파일                   |
| ---------------------- |
| `docker-entrypoint.sh` |
| `docker-compose.yml`   |

### 7.5 헤더 리네임 (`x-opencode-*` → `x-shlifecode-*`)

| 파일                                                     |
| -------------------------------------------------------- |
| `packages/opencode/src/server/instance/session.ts`       |
| `packages/opencode/src/server/instance/middleware.ts`    |
| `packages/opencode/src/server/proxy.ts`                  |
| `packages/opencode/src/session/llm.ts`                   |
| `packages/opencode/src/cli/cmd/run.ts`                   |
| `packages/sdk/js/src/client.ts`                          |
| `packages/sdk/js/src/v2/client.ts`                       |
| `packages/app/src/utils/server.ts`                       |
| `packages/console/app/src/lib/language.ts`               |
| `packages/console/app/src/routes/zen/util/handler.ts`    |
| `packages/opencode/test/server/project-init-git.test.ts` |
| `packages/opencode/test/cli/tui/sync-provider.test.tsx`  |

### 7.6 Config 리네임 (`.opencode` → `.shlifecode`)

| 파일                                                  |
| ----------------------------------------------------- |
| `packages/opencode/src/config/config.ts`              |
| `packages/opencode/src/config/paths.ts`               |
| `packages/opencode/src/config/tui.ts`                 |
| `packages/opencode/src/config/tui-migrate.ts`         |
| `packages/opencode/src/cli/cmd/mcp.ts`                |
| `packages/opencode/src/cli/cmd/uninstall.ts`          |
| `packages/opencode/src/cli/cmd/agent.ts`              |
| `packages/opencode/src/cli/error.ts`                  |
| `packages/opencode/src/session/index.ts`              |
| `packages/opencode/src/agent/agent.ts`                |
| `packages/opencode/src/plugin/install.ts`             |
| `packages/opencode/src/cli/cmd/tui/plugin/runtime.ts` |
| `packages/opencode/test/fixture/fixture.ts`           |

### 7.7 서버 / API 라우트

| 파일                                             | 역할                           |
| ------------------------------------------------ | ------------------------------ |
| `packages/opencode/src/server/server.ts`         | 서버 진입점, OpenAPI 스펙 생성 |
| `packages/opencode/src/server/instance/index.ts` | 인스턴스 라우트 조합           |
| `packages/opencode/src/server/control/index.ts`  | Control plane 라우트           |
| `packages/opencode/src/server/ui/index.ts`       | Web UI 라우트                  |
| `packages/opencode/src/cli/cmd/serve.ts`         | `opencode serve` CLI           |
| `packages/opencode/src/cli/cmd/generate.ts`      | `opencode generate` CLI        |

---

## 8. 선택적 추가 작업

아직 수행하지 않은 선택적 작업 목록:

| 항목                         | 설명                                               | 우선순위 |
| ---------------------------- | -------------------------------------------------- | -------- |
| vLLM 전용 provider preset    | `shlifecode.json`에 vLLM provider 설정 예시 추가   | 낮음     |
| `x-opencode-*` 헤더 fallback | 서버에서 `x-opencode-*`도 수용하는 backward-compat | 낮음     |
| 테스트 실행 검증             | `bun test` 전체 실행하여 변경 영향도 확인          | 중간     |
| 실제 serve 기동 테스트       | 서버 기동 후 API 호출 검증                         | 중간     |

---

## Typecheck 상태

| 패키지                  | 결과                                                   |
| ----------------------- | ------------------------------------------------------ |
| `packages/opencode`     | ✅ 통과                                                |
| `packages/sdk/js`       | ✅ 통과                                                |
| `packages/app`          | ✅ 통과                                                |
| `packages/console/core` | ✅ 통과                                                |
| `packages/console/app`  | ❌ 실패 (기존 `@solidjs/start` 타입 문제, 변경과 무관) |

---

## 테스트 파일 참고사항

테스트 파일들에 345개의 `.opencode`/`opencode.json` 참조가 존재하지만 **변경 불필요**:

- `config.ts`에 backward-compat가 구현되어 기존 `opencode.json`과 `.opencode/`를 그대로 읽음
- 테스트는 temp 디렉토리에 fixture를 생성하므로 migration helper와 무관
- 테스트가 `opencode.json`을 쓰면 config 시스템이 정상적으로 읽어들임

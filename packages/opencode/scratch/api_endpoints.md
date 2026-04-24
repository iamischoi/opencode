# API Endpoints

API 엔드포인트 목록 - src/server 폴더의 모든 라우트를 기준으로 작성됨

---

## Global Routes (`/`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/health` | global.health | Get health information about the OpenCode server |
| GET | `/event` | global.event | Subscribe to global events using server-sent events |
| GET | `/config` | global.config.get | Get global configuration |
| PATCH | `/config` | global.config.update | Update global configuration |
| POST | `/dispose` | global.dispose | Dispose all OpenCode instances |
| POST | `/upgrade` | global.upgrade | Upgrade opencode |

---

## Instance Routes (`/instance`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| POST | `/instance/dispose` | instance.dispose | Dispose the current OpenCode instance |
| GET | `/path` | path.get | Get paths (home, state, config, worktree, directory) |
| GET | `/vcs` | vcs.get | Get VCS info |
| GET | `/vcs/diff` | vcs.diff | Get VCS diff |
| GET | `/command` | command.list | List available commands |
| GET | `/agent` | app.agents | List available AI agents |
| GET | `/skill` | app.skills | List available skills |
| GET | `/lsp` | lsp.status | Get LSP server status |
| GET | `/formatter` | formatter.status | Get formatter status |

---

## Project Routes (`/project`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/project` | project.list | List all projects |
| GET | `/project/current` | project.current | Get current project |
| POST | `/project/git/init` | project.initGit | Initialize git repository |
| PATCH | `/project/:projectID` | project.update | Update project |

---

## Session Routes (`/session`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/session` | session.list | List sessions |
| GET | `/session/status` | session.status | Get session status |
| GET | `/session/:sessionID` | session.get | Get session |
| GET | `/session/:sessionID/children` | session.children | Get session children |
| GET | `/session/:sessionID/todo` | session.todo | Get session todos |
| POST | `/session` | session.create | Create session |
| DELETE | `/session/:sessionID` | session.delete | Delete session |
| PATCH | `/session/:sessionID` | session.update | Update session |
| POST | `/session/:sessionID/init` | session.init | Initialize session |
| POST | `/session/:sessionID/fork` | session.fork | Fork session |
| POST | `/session/:sessionID/abort` | session.abort | Abort session |
| POST | `/session/:sessionID/share` | session.share | Share session |
| GET | `/session/:sessionID/diff` | session.diff | Get message diff |
| DELETE | `/session/:sessionID/share` | session.unshare | Unshare session |
| POST | `/session/:sessionID/summarize` | session.summarize | Summarize session |
| GET | `/session/:sessionID/message` | session.messages | Get session messages |
| GET | `/session/:sessionID/message/:messageID` | session.message | Get message |
| DELETE | `/session/:sessionID/message/:messageID` | session.deleteMessage | Delete message |
| DELETE | `/session/:sessionID/message/:messageID/part/:partID` | part.delete | Delete message part |
| PATCH | `/session/:sessionID/message/:messageID/part/:partID` | part.update | Update message part |
| POST | `/session/:sessionID/message` | session.prompt | Send message (streaming) |
| POST | `/session/:sessionID/prompt_async` | session.prompt_async | Send message (async) |
| POST | `/session/:sessionID/command` | session.command | Send command |
| POST | `/session/:sessionID/shell` | session.shell | Run shell command |
| POST | `/session/:sessionID/revert` | session.revert | Revert message |
| POST | `/session/:sessionID/unrevert` | session.unrevert | Restore reverted messages |
| POST | `/session/:sessionID/permissions/:permissionID` | permission.respond | Respond to permission (deprecated) |

---

## Question Routes (`/question`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/question` | question.list | List pending questions |
| POST | `/question/:requestID/reply` | question.reply | Reply to question request |
| POST | `/question/:requestID/reject` | question.reject | Reject question request |

---

## Permission Routes (`/permission`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| POST | `/permission/:requestID/reply` | permission.reply | Respond to permission request |
| GET | `/permission` | permission.list | List pending permissions |

---

## Config Routes (`/config`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/config` | config.get | Get configuration |
| PATCH | `/config` | config.update | Update configuration |
| GET | `/config/providers` | config.providers | List config providers |

---

## Provider Routes (`/provider`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/provider` | provider.list | List providers |
| GET | `/provider/auth` | provider.auth | Get provider auth methods |
| POST | `/provider/:providerID/oauth/authorize` | provider.oauth.authorize | OAuth authorize |
| POST | `/provider/:providerID/oauth/callback` | provider.oauth.callback | OAuth callback |

---

## PTY Routes (`/pty`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/pty` | pty.list | List PTY sessions |
| POST | `/pty` | pty.create | Create PTY session |
| GET | `/pty/:ptyID` | pty.get | Get PTY session |
| PUT | `/pty/:ptyID` | pty.update | Update PTY session |
| DELETE | `/pty/:ptyID` | pty.remove | Remove PTY session |
| GET | `/pty/:ptyID/connect` | pty.connect | Connect to PTY (WebSocket) |

---

## MCP Routes (`/mcp`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/mcp` | mcp.status | Get MCP status |
| POST | `/mcp` | mcp.add | Add MCP server |
| POST | `/mcp/:name/auth` | mcp.auth.start | Start MCP OAuth |
| POST | `/mcp/:name/auth/callback` | mcp.auth.callback | Complete MCP OAuth |
| POST | `/mcp/:name/auth/authenticate` | mcp.auth.authenticate | Authenticate MCP OAuth |
| DELETE | `/mcp/:name/auth` | mcp.auth.remove | Remove MCP OAuth |
| POST | `/mcp/:name/connect` | mcp.connect | Connect MCP server |
| POST | `/mcp/:name/disconnect` | mcp.disconnect | Disconnect MCP server |

---

## File Routes (`/`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/find` | find.text | Find text (ripgrep) |
| GET | `/find/file` | find.files | Find files/directories |
| GET | `/find/symbol` | find.symbols | Find workspace symbols |
| GET | `/file` | file.list | List files |
| GET | `/file/content` | file.read | Read file content |
| GET | `/file/status` | file.status | Get file git status |
| GET | `/file/raw` | file.raw | Download raw file |

---

## Event Routes (`/event`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/event` | event.subscribe | Subscribe to instance events (SSE) |

---

## Sync Routes (`/sync`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| POST | `/sync/start` | sync.start | Start workspace sync |
| POST | `/sync/replay` | sync.replay | Replay sync events |
| POST | `/sync/history` | sync.history.list | List sync events |

---

## OpenAI Routes (`/v1`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/v1` | - | OpenAI connectivity check |
| GET | `/v1/models` | - | List models (agents) |
| POST | `/v1/chat/completions` | openai.chat.completions | Chat completions (streaming/non-streaming) |

---

## TUI Routes (`/tui`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| POST | `/tui/append-prompt` | tui.appendPrompt | Append TUI prompt |
| POST | `/tui/open-help` | tui.openHelp | Open help dialog |
| POST | `/tui/open-sessions` | tui.openSessions | Open sessions dialog |
| POST | `/tui/open-themes` | tui.openThemes | Open themes dialog |
| POST | `/tui/open-models` | tui.openModels | Open models dialog |
| POST | `/tui/submit-prompt` | tui.submitPrompt | Submit TUI prompt |
| POST | `/tui/clear-prompt` | tui.clearPrompt | Clear TUI prompt |
| POST | `/tui/execute-command` | tui.executeCommand | Execute TUI command |
| POST | `/tui/show-toast` | tui.showToast | Show TUI toast |
| POST | `/tui/publish` | tui.publish | Publish TUI event |
| POST | `/tui/select-session` | tui.selectSession | Select session |
| GET | `/tui/control/next` | tui.control.next | Get next TUI request |
| POST | `/tui/control/response` | tui.control.response | Submit TUI response |

---

## Experimental Routes (`/experimental`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/experimental/console` | experimental.console.get | Get active Console provider metadata |
| GET | `/experimental/console/orgs` | experimental.console.listOrgs | List switchable Console orgs |
| POST | `/experimental/console/switch` | experimental.console.switchOrg | Switch active Console org |
| GET | `/experimental/tool/ids` | tool.ids | List tool IDs |
| GET | `/experimental/tool` | tool.list | List tools |
| POST | `/experimental/worktree` | worktree.create | Create worktree |
| GET | `/experimental/worktree` | worktree.list | List worktrees |
| DELETE | `/experimental/worktree` | worktree.remove | Remove worktree |
| POST | `/experimental/worktree/reset` | worktree.reset | Reset worktree |
| GET | `/experimental/session` | experimental.session.list | List sessions (global) |
| GET | `/experimental/resource` | experimental.resource.list | Get MCP resources |

---

## Control Plane Routes (`/control`)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| PUT | `/control/auth/:providerID` | auth.set | Set auth credentials |
| DELETE | `/control/auth/:providerID` | auth.remove | Remove auth credentials |
| GET | `/control/doc` | - | OpenAPI documentation |
| POST | `/control/log` | app.log | Write log entry |

---

## HTTP API Routes (Experimental)

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| GET | `/question` | - | HTTP API question |
| POST | `/question/:requestID/reply` | - | HTTP API question reply |
| POST | `/question/:requestID/reject` | - | HTTP API question reject |
| GET | `/permission` | - | HTTP API permission |
| POST | `/permission/:requestID/reply` | - | HTTP API permission reply |
| GET | `/config/providers` | - | HTTP API providers |
| GET | `/provider` | - | HTTP API provider |
| GET | `/provider/auth` | - | HTTP API provider auth |
| POST | `/provider/:providerID/oauth/authorize` | - | HTTP API oauth authorize |
| POST | `/provider/:providerID/oauth/callback` | - | HTTP API oauth callback |
| GET | `/project` | - | HTTP API project |
| GET | `/project/current` | - | HTTP API project current |

---

## UI Routes

| Method | Endpoint | Operation ID | Description |
|-------|----------|--------------|--------------|
| ALL | `/*` | - | Embedded or proxied web UI |

---

## Notes

- 이 문서는 `FLAG.OPENCODE_EXPERIMENTAL_HTTPAPI`가 활성화된 경우 HTTP API 라우트도 포함합니다.
- 모든 엔드포인트는 Hono 프레임워크를 기반으로 하며 OpenAPI 스키마를 사용하여 문서화되어 있습니다.
- SSE (Server-Sent Events)는 다음 엔드포인트에서 지원됩니다: `/event`, `/instance/event`, `/v1/chat/completions` (streaming)
- WebSocket은 `/pty/:ptyID/connect`에서 지원됩니다.
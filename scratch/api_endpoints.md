# API Endpoints

This document lists all API endpoints available in the opencode server.

## Base Path

- `/api` - Core API endpoints
- `/api/v1` - Versioned API endpoints

## Authentication

The server uses **Basic Authentication** via `AuthMiddleware` when a server password is configured (`OPENCODE_SERVER_PASSWORD`).

- If no password is configured, endpoints are publicly accessible
- Alternatively, an `auth_token` query parameter can be used to provide credentials

## Endpoints

### Instance Routes (`/instance`)

Located in: `src/server/routes/instance/`

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/` | `IndexRoutes` | Root index handler |
| GET | `/vcs` | `VcsRoutes` | Version control system routes |
| GET | `/file` | `FileRoutes` | File operations |
| GET | `/terminal` | `TerminalRoutes` | Terminal/PTY sessions |
| GET | `/search` | `SearchRoutes` | Search functionality |
| GET | `/llm` | `LlmRoutes` | LLM provider routes |
| POST | `/llm/chat` | `LlmRoutes` | LLM chat endpoint |
| GET | `/completion` | `CompletionRoutes` | Code completion routes |
| GET | `/openai` | `OpenAiRoutes` | OpenAI compatible API |
| GET | `/openai/models` | `OpenAiRoutes` | List available models |
| POST | `/openai/chat/completions` | `OpenAiRoutes` | Chat completions endpoint |
| POST | `/openai/embeddings` | `OpenAiRoutes` | Embeddings endpoint |
| GET | `/session` | `SessionRoutes` | Session management |
| GET | `/session/status` | `SessionRoutes` | Get session status |
| GET | `/session/:sessionID` | `SessionRoutes` | Get specific session |
| POST | `/session` | `SessionRoutes` | Create new session |
| POST | `/session/summarize` | `SessionRoutes` | Summarize session |
| POST | `/session/:sessionID/continue` | `SessionRoutes` | Continue session |
| POST | `/session/:sessionID/stop` | `SessionRoutes` | Stop session |
| DELETE | `/session/:sessionID` | `SessionRoutes` | Delete session |
| GET | `/project` | `ProjectRoutes` | Project operations |
| GET | `/project/bootstrap` | `ProjectRoutes` | Bootstrap project |
| GET | `/project/resolve` | `ProjectRoutes` | Resolve project |
| GET | `/workspace` | `WorkspaceRoutes` | Workspace management |
| POST | `/workspace` | `WorkspaceRoutes` | Create workspace |
| PUT | `/workspace/:id` | `WorkspaceRoutes` | Update workspace |
| DELETE | `/workspace/:id` | `WorkspaceRoutes` | Delete workspace |

### Global Routes (`/global`)

Located in: `src/server/routes/global/`

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/global/auth` | `AuthRoutes` | Authentication |
| GET | `/global/config` | `ConfigRoutes` | Configuration |
| GET | `/global/flags` | `FlagRoutes` | Feature flags |
| GET | `/global/permissions` | `PermissionRoutes` | Permissions |
| GET | `/global/subscription` | `SubscriptionRoutes` | Subscription |
| POST | `/global/subscription/webhook` | `SubscriptionRoutes` | Subscription webhook |
| GET | `/global/usage` | `UsageRoutes` | Usage statistics |
| GET | `/global/telemetry` | `TelemetryRoutes` | Telemetry data |
| GET | `/global/mcp` | `McPServerRoutes` | MCP server management |
| POST | `/global/mcp` | `McPServerRoutes` | Create MCP server |
| PUT | `/global/mcp/:serverId` | `McPServerRoutes` | Update MCP server |
| DELETE | `/global/mcp/:serverId` | `McPServerRoutes` | Delete MCP server |

### UI Routes (`/ui`)

Located in: `src/server/routes/ui.ts`

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/ui/*` | UI handler | Static UI files |
| GET | `/` | UI handler | Root UI handler |

### HTTP API Routes (`/httpapi`)

Located in: `src/server/routes/instance/httpapi/`

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/httpapi/files` | `HttpApiFileRoutes` | File operations via HTTP API |
| POST | `/httpapi/files` | `HttpApiFileRoutes` | Create file |
| PUT | `/httpapi/files` | `HttpApiFileRoutes` | Update file |
| DELETE | `/httpapi/files` | `HttpApiFileRoutes` | Delete file |
| GET | `/httpapi/directory` | `HttpApiDirRoutes` | Directory operations |
| POST | `/httpapi/directory` | `HttpApiDirRoutes` | Create directory |
| DELETE | `/httpapi/directory` | `HttpApiDirRoutes` | Delete directory |
| GET | `/httpapi/process` | `ProcessRoutes` | Process operations |
| POST | `/httpapi/process/spawn` | `ProcessRoutes` | Spawn process |
| POST | `/httpapi/process/kill` | `ProcessRoutes` | Kill process |
| GET | `/httpapi/shell` | `ShellRoutes` | Shell operations |
| POST | `/httpapi/shell` | `ShellRoutes` | Execute shell command |
| GET | `/httpapi/permission` | `PermissionRoutes` | Permissions check |
| POST | `/httpapi/permission` | `PermissionRoutes` | Grant permission |

## Middleware

### Global Middleware

| Middleware | File | Description |
|-----------|------|-------------|
| AuthMiddleware | `src/server/middleware.ts` | Basic authentication guard |
| ErrorMiddleware | `src/server/middleware.ts` | Error handling |
| LoggerMiddleware | `src/server/middleware.ts` | Request logging |
| CorsMiddleware | `src/server/middleware.ts` | CORS handling |

### Route-Level Middleware

| Middleware | File | Description |
|-----------|------|-------------|
| InstanceMiddleware | `src/server/routes/instance/middleware.ts` | Workspace/directory context |
| FenceMiddleware | `src/server/routes/instance/middleware.ts` | Fence boundary enforcement |

## Notes

- The server is built using [Hono](https://hono.dev/) framework
- Routes follow RESTful conventions
- Some endpoints support both GET and POST methods for flexibility
- Session management endpoints support continuable operations for AI-assisted workflows
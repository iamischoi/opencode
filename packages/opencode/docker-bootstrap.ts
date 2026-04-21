import { chdir } from "process"
import { mkdirSync } from "fs"
import path from "path"

/**
 * Docker Bootstrap Wrapper
 *
 * This file replaces the direct call to `bun run src/index.ts` to allow us to customize
 * the runtime environment for Docker single-tenant deployments with minimal upstream changes.
 *
 * It does three things before booting the real OpenCode CLI:
 *
 * 1. Sets process.cwd() to OPENCODE_WORKSPACE so that middleware fallback resolves
 *    to the correct repository directory (fixing PTY 404 & SSE stream bugs).
 *
 * 2. Configures OPENCODE_DB to store the SQLite database on the persistent volume
 *    (/repository/.opencode/opencode.db) so session history survives container restarts.
 *
 * 3. Sets XDG_DATA_HOME on the persistent volume so all OpenCode state (logs, cache)
 *    is retained across restarts.
 */

const workspace = process.env.OPENCODE_WORKSPACE
if (workspace) {
  chdir(workspace)

  // Persist SQLite DB on the mounted volume
  const dataDir = path.join(workspace, ".opencode")
  mkdirSync(dataDir, { recursive: true })
  process.env.OPENCODE_DB = path.join(dataDir, "opencode.db")

  // Persist all XDG state/data on the volume as well
  process.env.XDG_DATA_HOME = path.join(workspace, ".opencode", "data")
  process.env.XDG_STATE_HOME = path.join(workspace, ".opencode", "state")
  process.env.XDG_CACHE_HOME = path.join(workspace, ".opencode", "cache")
  process.env.XDG_CONFIG_HOME = path.join(workspace, ".opencode", "config")
}

// Boot the real OpenCode CLI entrypoint.
// Because bun evaluates this file from `packages/opencode`, tsconfig/JSX is resolved correctly.
import "./src/index.ts"

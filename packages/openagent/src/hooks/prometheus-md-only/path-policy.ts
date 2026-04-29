import { resolve, isAbsolute } from "node:path"
import { log } from "../../shared/logger"

import { ALLOWED_PATH_PREFIX } from "./constants"

const normalize = (p: string) => resolve(p).replace(/\\/g, "/").toLowerCase()

/**
 * Returns true if `resolved` (already normalized) is directly under
 * `{root}/.sisyphus/` — i.e. no sub-package nesting between root and .sisyphus.
 */
function isDirectlyUnderSisyphus(resolved: string, root: string): boolean {
  if (!resolved.startsWith(root)) return false
  const rel = resolved.substring(root.length).replace(/^\/+/, "")
  if (rel.startsWith("..")) return false
  return rel.startsWith(`${ALLOWED_PATH_PREFIX.toLowerCase()}/`)
}

/**
 * Cross-platform path validator for Prometheus file writes.
 * Normalizes everything to forward-slash lowercase before comparing
 * so Windows backslash vs. forward-slash differences never cause mismatches.
 *
 * Allowed locations:
 *   1. {workspaceRoot}/.sisyphus/...  (always) — any file type
 *   2. {repositoryBasePath}/{project}/.sisyphus/...  (when repositoryBasePath is set)
 *      — exactly ONE directory level between repositoryBasePath and .sisyphus
 *      — any file type
 */
export function isAllowedFile(
  filePath: string,
  workspaceRoot: string,
  repositoryBasePath?: string,
): boolean {
  const root = normalize(workspaceRoot)
  const resolved = normalize(isAbsolute(filePath) ? filePath : resolve(workspaceRoot, filePath))

  log("[isAllowedFile] debug", { filePath, workspaceRoot, repositoryBasePath, root, resolved, platform: process.platform })

  // Case 1: directly under workspace root's .sisyphus/
  if (isDirectlyUnderSisyphus(resolved, root)) {
    log("[isAllowedFile] ALLOW: under workspace root .sisyphus/", { resolved })
    return true
  }

  // Case 2: {REPOSITORY_BASE_PATH}/{project}/.sisyphus/...
  if (repositoryBasePath) {
    const repoBase = normalize(repositoryBasePath).replace(/\/+$/, "")
    if (resolved.startsWith(repoBase + "/")) {
      const afterBase = resolved.substring(repoBase.length + 1)
      const slashIdx = afterBase.indexOf("/")
      if (slashIdx !== -1) {
        const afterProject = afterBase.substring(slashIdx + 1)
        if (afterProject.startsWith(`${ALLOWED_PATH_PREFIX.toLowerCase()}/`)) {
          log("[isAllowedFile] ALLOW: repository base path project .sisyphus match", { resolved, repoBase })
          return true
        }
      }
    }
  }

  log("[isAllowedFile] FAIL: not under any allowed .sisyphus/ root", { resolved, root, repositoryBasePath })
  return false
}

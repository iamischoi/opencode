import { resolve, isAbsolute } from "node:path"

import { ALLOWED_EXTENSIONS, ALLOWED_PATH_PREFIX } from "./constants"

/**
 * Cross-platform path validator for Prometheus file writes.
 * Uses path.resolve + startsWith instead of path.relative to handle:
 * - Windows backslashes (e.g., .sisyphus\\plans\\x.md)
 * - Mixed separators (e.g., .sisyphus\\plans/x.md)
 * - Case-insensitive directory/extension matching
 * - Workspace confinement (blocks paths outside root or via traversal)
 * - Nested project paths (e.g., parent/.sisyphus/... when ctx.directory is parent)
 */
export function isAllowedFile(filePath: string, workspaceRoot: string): boolean {
  // 1. Normalize both paths to use forward slashes for consistent processing
  const normalizedRoot = resolve(workspaceRoot).replace(/\\/g, "/")
  const absoluteFilePath = (isAbsolute(filePath) ? filePath : resolve(workspaceRoot, filePath)).replace(/\\/g, "/")

  // 2. Drive letter normalization for Windows
  let root = normalizedRoot
  let resolved = absoluteFilePath
  
  if (process.platform === "win32") {
    // Ensure drive letter is consistent (e.g., C:/...)
    if (root.match(/^[a-zA-Z]:/)) {
      root = root.charAt(0).toUpperCase() + root.slice(1)
    }
    if (resolved.match(/^[a-zA-Z]:/)) {
      resolved = resolved.charAt(0).toUpperCase() + resolved.slice(1)
    }
  }

  // 3. Calculate relative path manually to avoid path.relative quirks with drive letters
  let rel = ""
  if (resolved.startsWith(root)) {
    rel = resolved.substring(root.length).replace(/^[/\\]+/, "")
  } else {
    // If it doesn't start with root, it might be outside or a different drive
    return false
  }

  // 4. Reject if escapes root (should be handled by startsWith above, but for safety:)
  if (rel.startsWith("..")) {
    return false
  }

  // 5. Check if ALLOWED_PATH_PREFIX (.sisyphus) directory exists in the relative path
  if (!rel.toLowerCase().includes(`${ALLOWED_PATH_PREFIX.toLowerCase()}/`)) {
    return false
  }

  // 6. Check extension matches one of ALLOWED_EXTENSIONS (case-insensitive)
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some(
    ext => resolved.toLowerCase().endsWith(ext.toLowerCase())
  )
  if (!hasAllowedExtension) {
    return false
  }

  return true
}

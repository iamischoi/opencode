import { getAgentListDisplayName } from "../shared/agent-display-names"

export function remapAgentKeysToDisplayNames(
  agents: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(agents)) {
    const displayName = getAgentListDisplayName(key)
    if (displayName && displayName !== key) {
      result[displayName] = value
      // Keep the original key as an alias, but hide it from UIs to avoid duplicates
      result[key] = { ...(value as any), hidden: true }
    } else {
      result[key] = value
    }
  }

  return result
}

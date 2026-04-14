function env(key: string) {
  return globalThis.process?.env?.[key]
}

function truthy(key: string) {
  const value = env(key)?.toLowerCase()
  return value === "true" || value === "1"
}

export const external = !truthy("OPENCODE_DISABLE_EXTERNAL_ACCESS")

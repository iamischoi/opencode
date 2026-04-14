import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { ServerConnection } from "@/context/server"

export function createSdkForServer({
  server,
  ...config
}: Omit<NonNullable<Parameters<typeof createOpencodeClient>[0]>, "baseUrl"> & {
  server: ServerConnection.HttpBase
}) {
  const auth = (() => {
    if (!server.password) return
    return {
      Authorization: `Basic ${btoa(`${server.username ?? "opencode"}:${server.password}`)}`,
    }
  })()

  const model = globalThis.process?.env?.OPENCODE_MODEL
  const headers = {
    ...config.headers,
    ...auth,
    ...(model ? { "x-shlifecode-model": model } : {}),
  }
  return createOpencodeClient({
    ...config,
    headers,
    baseUrl: server.url,
  })
}

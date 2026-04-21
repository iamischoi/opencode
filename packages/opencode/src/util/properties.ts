import fs from "fs"
import path from "path"

export function loadProperties(filePath: string) {
  if (!fs.existsSync(filePath)) return

  try {
    const content = fs.readFileSync(filePath, "utf-8")
    const lines = content.split(/\r?\n/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue

      const index = trimmed.indexOf("=")
      if (index === -1) continue

      const key = trimmed.substring(0, index).trim()
      const value = trimmed.substring(index + 1).trim()
      
      if (key && process.env[key] === undefined) {
        process.env[key] = value
      }
    }
    console.log(`[Properties] Loaded ${lines.length} lines from ${filePath}`)
  } catch (e) {
    console.error(`[Properties] Failed to load from ${filePath}:`, e)
  }
}

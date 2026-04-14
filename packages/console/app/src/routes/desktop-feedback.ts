import { redirect } from "@solidjs/router"
import { external } from "@opencode-ai/console-core/flag.js"

export async function GET() {
  if (!external) return Response.json({ message: "external access disabled" }, { status: 404 })
  return redirect("https://discord.gg/h5TNnkFVNy")
}

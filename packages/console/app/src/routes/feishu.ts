import { redirect } from "@solidjs/router"
import { external } from "@opencode-ai/console-core/flag.js"

export async function GET() {
  if (!external) return Response.json({ message: "external access disabled" }, { status: 404 })
  return redirect(
    "https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=738j8655-cd59-4633-a30a-1124e0096789&qr_code=true",
  )
}

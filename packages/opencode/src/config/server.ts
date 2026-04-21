import { Schema } from "effect"
import { zod } from "@/util/effect-zod"

export class Server extends Schema.Class<Server>("ServerConfig")({
  port: Schema.optional(Schema.Number.check(Schema.isInt()).check(Schema.isGreaterThan(0))).annotate({
    description: "Port to listen on",
  }),
  hostname: Schema.optional(Schema.String).annotate({ description: "Hostname to listen on" }),
  mdns: Schema.optional(Schema.Boolean).annotate({ description: "Enable mDNS service discovery" }),
  mdnsDomain: Schema.optional(Schema.String).annotate({
    description: "Custom domain name for mDNS service (default: opencode.local)",
  }),
  cors: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description: "Additional domains to allow for CORS",
  }),
  appConfig: Schema.optional(Schema.String).annotate({
    description: "Mapping of application names to codes (e.g. SOLT1:S1,SOLT2:S2)",
  }),
  agentTypes: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description: "List of enabled agent types (e.g. 의뢰, 검토, 개발, 검증)",
  }),
}) {
  static readonly zod = zod(this)
}

export * as ConfigServer from "./server"

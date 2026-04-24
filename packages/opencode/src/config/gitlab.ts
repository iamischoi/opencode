import { Schema } from "effect"
import { zod } from "@/util/effect-zod"

export class Gitlab extends Schema.Class<Gitlab>("GitlabConfig")({
  host: Schema.optional(Schema.String).annotate({ description: "GitLab server host URL" }),
  username: Schema.optional(Schema.String).annotate({ description: "GitLab username for cloning" }),
  token: Schema.optional(Schema.String).annotate({ description: "GitLab personal access token" }),
  autoClone: Schema.optional(Schema.Boolean).annotate({ description: "Whether to auto clone repositories" }),
  appConfig: Schema.optional(Schema.String).annotate({
    description: "Mapping of application names to codes (e.g. SOLT1:S01)",
  }),
  repositories: Schema.optional(Schema.String).annotate({
    description: "List of repositories to clone mapping group to paths (e.g. S01/project-a.git;project-a|S02/project-b.git;project-b)",
  })
}) {
  static readonly zod = zod(this)
}

export * as ConfigGitlab from "./gitlab"

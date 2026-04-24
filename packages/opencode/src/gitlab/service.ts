import { Effect, Context, Layer, Schema } from "effect"
import { ConfigGitlab } from "../config/gitlab"
import { Git } from "../git"
import { Worktree } from "../worktree"
import { loadProperties } from "../util/properties"
import { Global } from "../global"
import { Env } from "../env"
import { AppFileSystem } from "@opencode-ai/shared/filesystem"
import path from "path"
import os from "os"

export interface RepositoryMapping {
  groupCode: string
  gitUrl: string
  folderName: string
}

export interface Interface {
  readonly parseRepositories: () => Effect.Effect<RepositoryMapping[]>
  readonly getGroupCode: (appName: string) => Effect.Effect<string, Error>
  readonly cloneRepositoriesForGroup: (groupCode: string, targetDir: string) => Effect.Effect<string[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Gitlab") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const git = yield* Git.Service

    // Attempt to load properties from workspace root if running locally
    const workspaceRoot = path.resolve(__dirname, "../../../..")
    const propsPath = path.join(workspaceRoot, "opencode-server.properties")
    loadProperties(propsPath)

    const parseRepositories = Effect.fn("Gitlab.parseRepositories")(function* () {
      const reposStr = process.env.REPOSITORIES || ""
      if (!reposStr) return []

      const mappings: RepositoryMapping[] = []
      const entries = reposStr.split("|")

      for (const entry of entries) {
        if (!entry) continue
        const [gitPath, folderName] = entry.split(";")
        if (gitPath && folderName) {
          const groupCode = gitPath.split("/")[0]
          mappings.push({
            groupCode,
            gitUrl: gitPath,
            folderName,
          })
        }
      }
      return mappings
    })

    const getGroupCode = Effect.fn("Gitlab.getGroupCode")(function* (appName: string) {
      const appConfigStr = process.env.OPENCODE_APP_CONFIG || ""
      if (!appConfigStr) return yield* Effect.fail(new Error("OPENCODE_APP_CONFIG is not set"))

      const entries = appConfigStr.split(",")
      for (const entry of entries) {
        const [name, code] = entry.split(":")
        if (name === appName && code) {
          // As requested, load properties from the dynamic group path
          const basePath = process.env.REPOSITORY_BASE_PATH || "/swdata/repository"
          loadProperties(`${basePath}/${code}`)
          return code
        }
      }
      return yield* Effect.fail(new Error(`App name ${appName} not found in OPENCODE_APP_CONFIG`))
    })

    const cloneRepositoriesForGroup = Effect.fn("Gitlab.cloneRepositoriesForGroup")(function* (
      groupCode: string,
      targetDir: string,
    ) {
      const host = process.env.GITLAB_HOST || "https://gitlab.com"
      const username = process.env.GITLAB_USERNAME || ""
      const token = process.env.GITLAB_TOKEN || ""
      const autoClone = process.env.GITLAB_AUTO_CLONE === "true" // Default to false

      let cloneBranch = "main"
      const groupBranchConfig = process.env.OPENCODE_REPOSITORY_GROUP || ""
      if (groupBranchConfig) {
        const entries = groupBranchConfig.split(",")
        for (const entry of entries) {
          const [gCode, gBranch] = entry.split(":")
          if (gCode?.trim() === groupCode && gBranch?.trim()) {
            cloneBranch = gBranch.trim()
            break
          }
        }
      }

      const mappings = yield* parseRepositories()
      const groupMappings = mappings.filter((m) => m.groupCode === groupCode)

      if (groupMappings.length === 0) {
        return []
      }

      // If auto-clone is false, skip cloning/pulling altogether
      if (!autoClone) {
        return groupMappings.map((m) => path.join(targetDir, m.folderName))
      }

      yield* fs.ensureDir(targetDir).pipe(Effect.orDie)
      const clonedPaths: string[] = []

      for (const mapping of groupMappings) {
        const destPath = path.join(targetDir, mapping.folderName)

        // Construct auth URL
        let cloneUrl = mapping.gitUrl
        if (username && token) {
          const urlObj = new URL(host)
          urlObj.username = username
          urlObj.password = token
          urlObj.pathname = `/${mapping.gitUrl}`
          cloneUrl = urlObj.toString()
        } else {
          cloneUrl = `${host}/${mapping.gitUrl}`
        }

        // Skip if already exists, but pull if configured
        const exists = yield* fs.existsSafe(destPath)
        if (exists) {
          // If directory exists, pull latest changes from the specified branch
          yield* git.run(["pull", "origin", cloneBranch], { cwd: destPath }).pipe(Effect.orDie)
          clonedPaths.push(destPath)
          continue
        }

        // We use git clone command directly with branch configuration
        yield* git
          .run(["clone", "-b", cloneBranch, cloneUrl, mapping.folderName], { cwd: targetDir })
          .pipe(Effect.orDie)
        clonedPaths.push(destPath)
      }

      return clonedPaths
    })

    return Service.of({
      parseRepositories,
      getGroupCode,
      cloneRepositoriesForGroup,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(AppFileSystem.defaultLayer), Layer.provide(Git.defaultLayer))

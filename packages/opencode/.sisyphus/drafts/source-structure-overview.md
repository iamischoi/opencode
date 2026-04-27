# Draft: Source Structure Overview

## Requirements (confirmed)
- source structure overview: �ҽ��ڵ� ������ �� �ľ��غ�

## Technical Decisions
- scope: Start with packages/opencode package structure and src responsibilities
- output_style: Summarize concrete modules and entry points, then offer deeper drill-down areas if needed

## Research Findings
- package.json: package uses Bun, Effect, tsgo typecheck, bun test, build via script/build.ts
- src/index.ts: main package entry point used by dev flow
- src/: organized into many feature-oriented directories such as agent, cli, server, session, project, provider, tool, plugin, storage
- src/**/*.sql.ts: Drizzle schema files for storage, session, project, account domains
- package wiring: conditional imports map Bun/Node implementations for db, pty, and hono adapters
- config/runtime files: tsconfig.json extends Bun config, bunfig.toml preloads OpenTUI Solid and test setup, drizzle.config.ts points migrations to migration/

## Open Questions
- which subsystem to inspect next in depth, if any

## Scope Boundaries
- INCLUDE: packages/opencode package structure, src module layout, build/test wiring
- EXCLUDE: implementation changes, full repo-wide architecture outside immediate package unless needed

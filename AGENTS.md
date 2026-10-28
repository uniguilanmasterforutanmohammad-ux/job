# AGENTS.md — Business Platform

Monorepo for the multi-tenant service-business management platform described in
`docs/PRD_fa.md` (17 industry verticals / 70+ jobs, pilot = sports coaching).

## Layout

- `apps/api` — NestJS 12 (ESM) REST API, Prisma 7 + PostgreSQL, Redis, BullMQ-ready.
- `apps/web` — Next.js 16 App Router UI (RTL, Persian, Jalali dates).
- `packages/db` — Prisma schema + generated client + seed (compiled to `dist/`).
- `packages/shared` — Cross-app types, module registry, permissions, industry data.
- `packages/config` — Shared tsconfig/eslint bases.

## Conventions

- **ESM everywhere.** Relative imports in TS source MUST include the `.js`
  extension (NodeNext resolution). Never add `"type": "commonjs"`.
- **Multi-tenant isolation.** Every business query is scoped by `tenantId`
  (taken from the authenticated user, never from client input).
- **Validation with Zod.** Define schemas in `*.schemas.ts` and validate at the
  parameter level: `@Body(new ZodValidationPipe(schema)) dto: XDto`. Do NOT use
  method-level `@UsePipes` — it also validates `@CurrentUser` params.
- **Config via env schema.** All env vars are declared in
  `apps/api/src/config/configuration.ts`; the app fails fast if one is missing.
- **Latest stable deps.** Newer-than-cooldown packages must be listed under
  `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.

## Commands

```bash
pnpm install                 # bootstrap workspace
docker compose -f docker-compose.dev.yml up -d   # postgres + redis + adminer
pnpm db:generate             # prisma client
pnpm db:migrate              # apply migrations (dev)
pnpm db:seed                 # reference data + demo tenant
pnpm dev                     # run api + web together (turbo)
pnpm build                   # build all packages/apps
pnpm typecheck               # typecheck all
pnpm test                    # unit tests (api + shared, vitest)
```

Dev login: phone `09121111111`, OTP bypass code `123456` (development only).
Every seeded/demo account (owner, team, student, platform operator) is listed in
`docs/DEV_ACCOUNTS.md`.

## Tests

- Unit specs live next to source as `*.spec.ts`; run `pnpm test` (turbo).
- `apps/api/test/smoke.e2e.spec.ts` is a live-HTTP smoke suite that auto-skips
  when the API is unreachable — start the stack to actually run it.
- See `docs/TESTING.md` and `docs/SECURITY.md` for coverage and the threat model.

## Agent workflow (mandatory)

`docs/AGENT_RULES.md` is part of these instructions — read it before starting and
follow it for every task:

1. **Commit after every task and every step of a multi-step task.** Use
   `<type>(<scope>): <summary>` (feat/fix/refactor/docs/test/chore/perf) with a
   Persian body describing the change and the commands run, then register the
   commit in the "Commit Registry" table of `docs/AGENT_RULES.md` (a commit is
   logged at the latest in the following commit).
2. **Mark every test you write or run with a comment**: add
   `// TaskForMyAgent — <task title>` at the top of the spec file, and record the
   test + result in the "Test Log" table of `docs/AGENT_RULES.md`.
3. **At the end of every run**, after all steps are done and nothing is left
   open, read `TaskForMyAgent.md` once more and automatically pick up any task
   added there (implement, test, commit, register). If nothing is left, say so
   explicitly in the final answer.

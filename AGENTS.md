# AGENTS.md

## How we work
- I lead the design. Don't change the agreed plan, API contract or schema without asking first.
- Work in small steps: one task at a time, run the tests, then stop and summarise what changed.
- Ask before adding a dependency. Prefer the standard library and the stack below.
- Keep it simple: no extra abstractions or layers until they're needed.

## Spec-driven development (SDD)
For any feature, data model change, or ambiguous behaviour, spec before code:

1. When I ask for a plan or spec, write it to `docs/specs/<nn>-<feature>/` (e.g. `docs/specs/01-create-link/`). Write no code.
   - `requirements.md`: the behaviour and acceptance criteria, with ids (R1, R2…). No file paths.
   - `design.md`: the data model, API contract (requests, responses, status codes), affected files, edge cases, and test plan.
   - `tasks.md`: vertical slices (each one testable end to end, e.g. via curl), traced to requirement ids. Not horizontal layers (DB, then API, then tests).
2. Then stop and wait for my approval. List any open decisions as questions; don't guess them.
3. After approval, implement one task at a time from `tasks.md`, run the tests, tick the task off, and summarise.
4. If implementation shows the spec is wrong or incomplete, pause, update the spec files, then continue.
5. Keep specs as living docs: update them in place when behaviour changes.
6. Skip SDD for tiny fixes (a typo, a one-line change); just do them.


## Default stack (unless the task says otherwise)
- TypeScript (strict), Node 24, ESM, pnpm.
- HTTP: Fastify. Validate every request body and param with Zod; return typed responses.
- Database: Postgres via `docker compose up -d`. Query with Drizzle ORM (`drizzle-orm/node-postgres` over a `pg` pool); tables are defined in `src/db/schema.ts`. Migrations are generated into `migrations/` with `pnpm db:generate` (drizzle-kit) and are forward-only; use `drizzle-kit generate --custom` for hand-written SQL.
- Tests: Vitest. Lint and format: Biome.

## Project layout
- `src/server.ts` (app setup), `src/routes/` (one file per resource), `src/db/` (Drizzle client, schema, queries), `src/lib/` (pure logic).
- Pure logic (code generation, validation, retry rules) lives in `src/lib/` with unit tests.
- Config comes from env vars, validated with Zod at startup. Never hard-code secrets.

## Conventions
- Status codes: 201 for create, 200 for read, 400 for validation errors, 404 for not found, 409 for conflicts. Errors are JSON `{ "error": { "code", "message" } }`.
- Enforce data rules in the database too: primary keys, NOT NULL, unique constraints, foreign keys, indexes on lookup columns.
- Make writes safe to retry (idempotent) where it matters; use transactions for multi-step writes.
- Log with structured JSON (pino), including a request id. Never log secrets or personal data.

## Testing
- Every endpoint gets at least a happy-path test and an error-path test, run against the real local Postgres.
- Run `pnpm test` after each change, and fix failures before moving on.
- `pnpm check` (Biome) and `pnpm typecheck` must pass before you say a task is done.

## Commands
- `docker compose up -d` (start Postgres), `pnpm db:generate`, `pnpm migrate`, `pnpm dev`, `pnpm test`, `pnpm check`, `pnpm typecheck`.

# Tasks — 01 Create link (`POST /links`)

Vertical slices, each testable end to end. Traced to the requirement ids in [requirements.md](./requirements.md).

- [x] **Task 1 — Links table exists in the database** (R7)
  Define the `links` table, generate migration `0001_create_links`, apply it to the local Postgres.
  Verify: `curl`-free check via `psql` (`\d links` shows the PK, unique `code`, and the 2048 CHECK).

- [x] **Task 2 — Happy path: create a link** (R1, R2, R3, R5, R7)
  `POST /links` with a valid URL returns `201 { id, code, url }` and the row is stored.
  Verify: `curl -X POST .../links -d '{"url":"https://example.com/..."}'` → 201; row present in `psql`.

- [x] **Task 3 — Invalid input is rejected** (R2, R6)
  Missing `url`, malformed JSON, non-absolute URL, non-http(s) scheme, and > 2048-char URLs all return `400 validation_error`.
  Verify: curl each case → 400 with the `validation_error` body.

- [x] **Task 4 — Uniqueness and collision handling** (R4, R8)
  Stubbed-DB unit tests cover the collision retry (fresh code per attempt, 3 attempts, then 500) and unexpected DB failure; the real-Postgres test proves a duplicate code inserts nothing.
  Verify: `pnpm test` — stubbed suite passes without Postgres; the real-DB suite passes against the migrated database with a preexisting unrelated row left untouched.

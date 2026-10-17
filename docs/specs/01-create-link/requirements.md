# 01 — Create link (`POST /links`)

Step 1 of the URL shortener: create a shortened link. Retrieval/redirect is step 2 (out of scope here).

## Requirements

- **R1** — The service exposes `POST /links`, which creates a short link for a supplied URL and stores it durably in Postgres.
- **R2** — The request body is `{ "url": string }`. The URL must be an absolute `http`/`https` URL and at most 2048 characters (matching the database limit).
- **R3** — The short code is generated server-side: 7 characters, Base62, drawn from the OS CSPRNG (`node:crypto`).
- **R4** — Codes are unique. The insert uses `ON CONFLICT DO NOTHING`; on a collision the route retries with a fresh code, up to 3 attempts. If all attempts collide, the response is `500` with `internal_error` (collisions are astronomically unlikely; a 409 is not meaningful to API callers here).
- **R5** — On success the response is `201` with `{ "id": number, "code": string, "url": string }`.
- **R6** — Validation failures (missing `url`, non-absolute URL, non-http(s) scheme, URL over 2048 chars, malformed JSON body) return `400` with `{ "error": { "code": "validation_error", "message": string } }`.
- **R7** — The `links` table holds the data: `id` bigint identity primary key, `code` varchar(10) NOT NULL UNIQUE, `url` text NOT NULL with a CHECK constraint `char_length(url) <= 2048` (data rules enforced in the database, not only in the API layer).
- **R8** — Tests run without database side effects by default: unit tests stub the database layer and exercise the server through Fastify's `inject`. One real-Postgres test proves the unique constraint and the duplicate-code behaviour against the migrated database.

## Acceptance criteria

- A valid `POST /links` returns `201` with the id, a 7-char Base62 code, and the original URL, and the row is present in Postgres (R1, R3, R5).
- Each invalid-input case above returns `400` `validation_error` (R2, R6).
- A duplicate code insert does not create a second row; the route recovers by generating another code (R4, R7).
- `pnpm test`, `pnpm check`, `pnpm typecheck` all pass; the stubbed tests never touch Postgres (R8).

## Out of scope (step 2+)

- GET /:code redirect, authentication, client-supplied (custom) codes.

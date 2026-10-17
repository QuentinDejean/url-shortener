# Design — 02 Get link

Implements the requirements in [requirements.md](./requirements.md). Decisions: **Option A (302 redirect)**, route **`GET /links/:code`**.

## Data model

No schema change. Reads the existing `links` table (see [01-create-link/design.md](../01-create-link/design.md)).

## API contract

```
GET /links/:code
```

| Status | Response                                                    | When                        |
|--------|-------------------------------------------------------------|-----------------------------|
| 302    | `Location: <stored url>` (empty body)                       | Code exists                 |
| 404    | `{ "error": { "code": "not_found", "message": string } }`   | Unknown or malformed code   |

The code param is constrained to `^[0-9A-Za-z]{1,10}$` (matches the column, not just the 7-char generator). A malformed code returns `404` `not_found` rather than `400`: a GET lookup is addressed by code, so a wrong-shaped code is simply "no such resource", and the database is never queried for it.

## Affected files

- `src/db/links.ts` — add `findLinkByCode(db, code)`: `SELECT id, code, url ... WHERE code = ?`, returns the row or `null`
- `src/routes/links.ts` — register the GET route on the existing router
- `test/links.test.ts` — stubbed-DB GET cases
- `test/links.db.test.ts` — one real-Postgres retrieval case

## Edge cases

- **Unknown code** → 404 `not_found` (single DB lookup, no retry semantics).
- **Malformed code** (wrong charset/length) → rejected by the route constraint before touching the database → 404.
- **URL stored exactly 2048 chars** → redirected to as-is; no transformation on read (R5).
- **Non-ASCII URLs** → normalized to their percent-encoded href at creation, so every `Location` header is ASCII-safe (see 01-create-link/design.md); a normalized URL over 2048 chars is rejected at POST with 400.
- **Fixed paths** (`/health`) → unaffected: `/:code` lives under `/links/`, so nothing shadows other routes; covered by a regression test.

## Test plan

- `test/links.test.ts` (stubbed DB, `app.inject`): 302 redirect with the stored URL in `Location`; 404 for unknown code; 404 for malformed code with no DB call; regression that `GET /health` still returns 200.
- `test/links.db.test.ts` (real Postgres): create via `POST /links`, retrieve via GET, assert the stored URL comes back and the row is unchanged afterwards; cleanup limited to rows the suite created (same pattern as 01).

# 02 — Get link (`GET /links/:code`)

Step 2 of the URL shortener: retrieve the destination for a short code. Builds on [01-create-link](../01-create-link/).

## Requirements

- **R1** — The service exposes a GET endpoint that takes a short code and returns the stored destination.
- **R2** — A code that exists in the `links` table returns the stored URL.
- **R3** — A code that does not exist returns `404` with `{ "error": { "code": "not_found", "message": string } }`.
- **R4** — A code that does not match the code format (wrong length or characters) returns `404` without hitting the database.
- **R5** — Retrieval must not modify the stored row (no write on read).

## Acceptance criteria

- Create a link via `POST /links`, then GET its code: the response carries the original URL exactly as stored (R1, R2).
- GET a code that was never created returns `404` `not_found` (R3).
- Existing routes (`/health`) keep working unchanged; an unknown path still returns the JSON 404 (R1).
- Stubbed-DB tests cover the lookup paths without Postgres; one real-Postgres test proves end-to-end retrieval of a stored row (R2, R3).

## Open decisions (resolved 2026-10-17)

1. Response shape: **Option A — `302` redirect** with a `Location` header.
2. Route shape: **`GET /links/:code`** (API-style; no path-shadowing concerns).

## Out of scope

- Click analytics/tracking, caching, authentication, custom codes.

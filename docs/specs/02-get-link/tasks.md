# Tasks — 02 Get link

Vertical slices, each testable end to end. Traced to the requirement ids in [requirements.md](./requirements.md). Resolved decisions: **302 redirect**, route **`GET /links/:code`**.

- [x] **Task 1 — Retrieve a stored link** (R1, R2, R5)
  Added `findLinkByCode` and `GET /links/:code`; a code that exists redirects to its URL.
  Verify: curl — `POST /links`, then `GET /links/<code>` → 302 with `Location` set to the exact stored URL; stubbed-DB test passes.

- [x] **Task 2 — Unknown and malformed codes** (R3, R4)
  Unknown code returns 404 `not_found`; malformed codes are rejected before the DB lookup.
  Verify: curl an invented code and a malformed code → 404; stubbed-DB test asserts the lookup mock was never called for malformed codes.

- [x] **Task 3 — Regression and real-database proof** (R2, R3)
  `GET /health` still returns 200 alongside the new route; the real-Postgres test creates a link via POST, retrieves it via GET (302 + correct `Location`), and confirms the row is unchanged afterwards.
  Verify: `pnpm test` green (19 tests, stubbed + real DB suites); live smoke against the running server for all three cases.
